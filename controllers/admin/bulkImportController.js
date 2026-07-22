const fs = require('fs');
const crypto = require('crypto');
const Student = require('../../models/Student');
const User = require('../../models/User');
const Fee = require('../../models/Fee');
const Lead = require('../../models/Lead');
const Course = require('../../models/Course');
const Attendance = require('../../models/Attendance');
const { importedCourseCode, importedDate, importedMoney, normalizeCourseName, normalizePhone, parseCsv } = require('../../utils/csvParser');
const buildFeeSchedule = require('../../utils/feeSchedule');
const { isValidDateString, todayIST } = require('../../utils/dateHelper');
const { ATTENDANCE_STATUSES } = require('../../config/constants');
const logger = require('../../utils/logger');
const syncCourseCompletion = require('../../utils/syncCourseCompletion');
const { escapeRegex } = require('../../utils/sanitize');

function readRows(req) {
  if (!req.file) throw new Error('Choose a CSV, TSV, or TXT file.');
  return parseCsv(fs.readFileSync(req.file.path, 'utf8'));
}

async function findStudent(row) {
  const name = String(row.student_name || row.name || '').trim();
  const rollNumber = String(row.roll_number || row.rollnumber || '').trim();
  if (rollNumber) return Student.findOne({ rollNumber });
  const email = String(row.email || row.student_email || '').trim().toLowerCase();
  const phone = normalizePhone(row.contact_no || row.phone || row.phone_number);
  let users = email ? await User.find({ role: 'student', email }).select('_id').limit(2) : [];
  if (!users.length && phone) {
    users = (await User.find({ role: 'student', phone: { $ne: '' } }).select('_id phone'))
      .filter(user => normalizePhone(user.phone) === phone)
      .slice(0, 2);
  }
  if (!users.length && name) users = await User.find({ role: 'student', name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }).select('_id').limit(2);
  if (users.length !== 1) return null;
  return Student.findOne({ user: users[0]._id });
}

async function findLead(row) {
  const email = String(row.email || row.student_email || '').trim().toLowerCase();
  const phone = normalizePhone(row.contact_no || row.phone || row.phone_number);
  let leads = email ? await Lead.find({ email, convertedStudent: null }).limit(2) : [];
  if (!leads.length && phone) {
    leads = (await Lead.find({ convertedStudent: null, phone: { $ne: '' } }))
      .filter(lead => normalizePhone(lead.phone) === phone)
      .slice(0, 2);
  }
  return leads.length === 1 ? leads[0] : null;
}

async function resolveImportedCourse(row, lead) {
  const value = String(row.pursuing_course || row.course || '').replace(/\s*\(drop\)\s*$/i, '').trim();
  if (!value && lead?.interestedCourse) return Course.findById(lead.interestedCourse);
  if (!value) return null;
  const courses = await Course.find().select('name code durationMonths fees');
  const existing = courses.find(course => normalizeCourseName(course.name) === normalizeCourseName(value) || String(course.code).toLowerCase() === value.toLowerCase());
  if (existing) return existing;
  const baseCode = importedCourseCode(value);
  let code = baseCode;
  let suffix = 2;
  while (await Course.exists({ code })) code = `${baseCode.slice(0, 8)}${suffix++}`;
  return Course.create({ name: value, code, durationMonths: /1\s*month/i.test(value) ? 1 : 3 });
}

async function convertImportedLead(lead, course, row, adminId) {
  const email = String(row.email || row.student_email || lead.email || `lead-${lead._id}@pending.local`).trim().toLowerCase();
  const user = await User.create({
    name: String(row.student_name || row.name || lead.name).trim(),
    email,
    phone: row.contact_no || row.phone || lead.phone,
    password: crypto.randomBytes(16).toString('hex'),
    role: 'student',
    status: 'active',
    mustChangePassword: true,
    passwordSetByAdmin: true,
    firstLoginCompleted: false,
    profileIncomplete: true
  });
  try {
    const student = await Student.create({
      user: user._id,
      course: course._id,
      counsellor: lead.assignedTo || null,
      enrollmentDate: importedDate(row.joining_date) || new Date(),
      statusHistory: [{ status: 'active', changedBy: adminId, reason: 'Converted during enrolled-student fee import' }]
    });
    lead.status = 'admission_completed';
    lead.convertedStudent = student._id;
    lead.convertedAt = new Date();
    await lead.save();
    return student;
  } catch (err) {
    await User.findByIdAndDelete(user._id).catch(() => {});
    throw err;
  }
}

async function createImportedStudent(course, row, adminId) {
  const phone = normalizePhone(row.contact_no || row.phone || row.phone_number);
  const name = String(row.student_name || row.name || '').trim();
  if (!name || !phone) throw new Error('Student name and phone are required to create a missing student');
  const email = String(row.email || row.student_email || `import-${phone}@pending.local`).trim().toLowerCase();
  const user = await User.create({
    name,
    email,
    phone: String(row.contact_no || row.phone || row.phone_number).trim(),
    password: crypto.randomBytes(16).toString('hex'),
    role: 'student',
    status: 'active',
    mustChangePassword: true,
    passwordSetByAdmin: true,
    firstLoginCompleted: false,
    profileIncomplete: true
  });
  try {
    return await Student.create({
      user: user._id,
      course: course._id,
      enrollmentDate: importedDate(row.joining_date) || new Date(),
      statusHistory: [{ status: 'active', changedBy: adminId, reason: 'Created from enrolled-student fee import' }]
    });
  } catch (err) {
    await User.findByIdAndDelete(user._id).catch(() => {});
    throw err;
  }
}

function importedSchedule(row, totalAmount, paidAmount, fallbackDate) {
  const joiningDate = importedDate(row.joining_date) || fallbackDate || new Date();
  const balance = Math.max(0, totalAmount - paidAmount);
  const schedule = [];
  if (paidAmount > 0) schedule.push({ name: paidAmount >= totalAmount ? 'Full Fee' : 'Paid Amount', amount: Math.min(paidAmount, totalAmount), dueDate: joiningDate, paidAmount: 0 });
  if (balance > 0) schedule.push({ name: 'Balance EMI', amount: balance, dueDate: importedDate(row.next_emi_date) || new Date(), paidAmount: 0 });
  return schedule;
}

exports.postImportFees = async (req, res) => {
  let imported = 0;
  let failed = 0;
  const failureReasons = [];
  try {
    const rows = readRows(req);
    const groups = rows.reduce((map, row) => {
      const identifier = String(row.roll_number || row.rollnumber || row.email || normalizePhone(row.contact_no || row.phone || row.phone_number) || row.student_name || row.name || '').trim().toLowerCase();
      if (identifier) (map.get(identifier) || map.set(identifier, []).get(identifier)).push(row);
      else failed += 1;
      return map;
    }, new Map());

    for (const items of groups.values()) {
      try {
        const first = items[0];
        const snapshotFormat = first.total_fee != null || first.amount_paid != null || first.pending_amount != null;
        const totalAmount = importedMoney(snapshotFormat ? first.total_fee : first.total_amount);
        const discount = importedMoney(first.discount || 0);
        if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(discount) || discount < 0 || discount >= totalAmount) throw new Error('Invalid fee total or discount');
        const netTotal = totalAmount - discount;
        const importedPaid = snapshotFormat ? importedMoney(first.amount_paid || 0) : null;
        if (snapshotFormat && (!Number.isFinite(importedPaid) || importedPaid < 0 || importedPaid > netTotal)) throw new Error('Invalid paid amount');
        let student = await findStudent(first);
        let course = await resolveImportedCourse(first, null);
        if (!student) {
          const lead = await findLead(first);
          course = course || await resolveImportedCourse(first, lead);
          if (!course) throw new Error('Course not found');
          student = lead
            ? await convertImportedLead(lead, course, first, req.user._id)
            : await createImportedStudent(course, first, req.user._id);
        }
        await student.populate('course', 'durationMonths fees');
        course = course || student.course;
        const installments = snapshotFormat
          ? importedSchedule(first, netTotal, importedPaid, student.enrollmentDate)
          : buildFeeSchedule({
            instName: items.map(row => row.installment_name),
            instAmount: items.map(row => row.installment_amount),
            instDueDate: items.map(row => row.due_date)
          }, netTotal);
        let fee = await Fee.findOne({ student: student._id });
        if (!fee) fee = new Fee({ student: student._id, course: course._id, batch: student.batch, totalAmount, courseDurationMonths: course.durationMonths || 3 });
        const recordedPayments = fee.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const alreadyPaid = Math.max(fee.paidAmount || 0, recordedPayments);
        if (alreadyPaid > netTotal || (snapshotFormat && importedPaid + 0.01 < alreadyPaid)) throw new Error('CSV paid amount is below payments already recorded');
        fee.totalAmount = totalAmount;
        fee.discount = discount;
        fee.discountReason = String(first.discount_reason || '').trim().slice(0, 200);
        fee.installments = installments;
        fee.course = course._id;
        if (snapshotFormat && importedPaid > recordedPayments) {
          fee.payments.push({
            amount: importedPaid - recordedPayments,
            method: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'].includes(String(first.payment_method || '').trim()) ? String(first.payment_method).trim() : 'Other',
            note: 'Imported historical payment adjustment',
            receivedBy: req.user._id,
            paidAt: importedDate(first.joining_date) || new Date()
          });
        }
        await fee.save();
        student.course = course._id;
        if (snapshotFormat && importedDate(first.joining_date)) student.enrollmentDate = importedDate(first.joining_date);
        student.fees_total = netTotal;
        student.fees_paid = fee.paidAmount;
        await student.save();
        if (snapshotFormat) {
          const user = await User.findById(student.user);
          if (user) {
            user.status = /^drop$/i.test(String(first.status || '').trim()) ? 'drop' : 'active';
            await user.save();
          }
        }
        imported += 1;
      } catch (err) {
        failed += 1;
        if (failureReasons.length < 5) failureReasons.push(`${items[0].student_name || items[0].name || 'Unknown row'}: ${err.message}`);
      }
    }
    const detail = failureReasons.length ? `&error=${encodeURIComponent(failureReasons.join(' | '))}` : '';
    res.redirect(`/admin/fees?imported=${imported}&failed=${failed}${detail}`);
  } catch (err) {
    logger.error('Fee CSV import failed', { err: err.message });
    res.redirect(`/admin/fees?error=${encodeURIComponent(err.message)}`);
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
};

exports.postImportAttendance = async (req, res) => {
  let imported = 0;
  let failed = 0;
  const touchedStudents = [];
  try {
    const rows = readRows(req);
    for (const row of rows) {
      try {
        const date = String(row.date || '').trim();
        const status = String(row.status || '').trim().toLowerCase();
        const reason = String(row.reason || 'Historical attendance import').trim().slice(0, 300);
        if (!isValidDateString(date) || date > todayIST() || !ATTENDANCE_STATUSES.includes(status)) throw new Error('Invalid row');
        const student = await findStudent(row);
        if (!student || !student.batch || new Date(`${date}T23:59:59Z`) < student.enrollmentDate) throw new Error('Student is not enrolled for this date');
        const existing = await Attendance.findOne({ student: student._id, date });
        if (existing && (existing.status !== status || existing.note !== String(row.note || '').trim())) {
          existing.revisions.push({ status: existing.status, note: existing.note, changedBy: req.user._id, reason });
        }
        const record = existing || new Attendance({ student: student._id, date, markedBy: req.user._id });
        Object.assign(record, { course: student.course, batch: student.batch, status, note: String(row.note || '').trim().slice(0, 300), updatedBy: req.user._id, changeReason: reason, entrySource: 'admin' });
        await record.save();
        touchedStudents.push(student._id);
        imported += 1;
      } catch (err) { failed += 1; }
    }
    await syncCourseCompletion(touchedStudents, req.user._id);
    res.redirect(`/admin/attendance?imported=${imported}&failed=${failed}`);
  } catch (err) {
    logger.error('Attendance CSV import failed', { err: err.message });
    res.redirect(`/admin/attendance?error=${encodeURIComponent(err.message)}`);
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
};
