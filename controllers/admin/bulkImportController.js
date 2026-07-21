const fs = require('fs');
const Student = require('../../models/Student');
const User = require('../../models/User');
const Fee = require('../../models/Fee');
const Attendance = require('../../models/Attendance');
const { parseCsv } = require('../../utils/csvParser');
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
  if (!name) return null;
  const users = await User.find({ role: 'student', name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }).select('_id').limit(2);
  if (users.length !== 1) return null;
  return Student.findOne({ user: users[0]._id });
}

exports.postImportFees = async (req, res) => {
  let imported = 0;
  let failed = 0;
  try {
    const rows = readRows(req);
    const groups = rows.reduce((map, row) => {
      const identifier = String(row.roll_number || row.rollnumber || row.student_name || row.name || '').trim().toLowerCase();
      if (identifier) (map.get(identifier) || map.set(identifier, []).get(identifier)).push(row);
      else failed += 1;
      return map;
    }, new Map());

    for (const items of groups.values()) {
      try {
        const student = await findStudent(items[0]);
        if (!student) throw new Error('Student not found');
        await student.populate('course', 'durationMonths fees');
        const first = items[0];
        const totalAmount = Number(first.total_amount);
        const discount = Number(first.discount || 0);
        if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(discount) || discount < 0 || discount >= totalAmount) throw new Error('Invalid fee total or discount');
        const installments = buildFeeSchedule({
          instName: items.map(row => row.installment_name),
          instAmount: items.map(row => row.installment_amount),
          instDueDate: items.map(row => row.due_date)
        }, totalAmount - discount);
        let fee = await Fee.findOne({ student: student._id });
        if (!fee) fee = new Fee({ student: student._id, course: student.course._id, batch: student.batch, totalAmount, courseDurationMonths: student.course.durationMonths || 3 });
        if (fee.paidAmount > totalAmount - discount) throw new Error('Net fee cannot be below payments already received');
        fee.totalAmount = totalAmount;
        fee.discount = discount;
        fee.discountReason = String(first.discount_reason || '').trim().slice(0, 200);
        fee.installments = installments;
        await fee.save();
        student.fees_total = totalAmount - discount;
        student.fees_paid = fee.paidAmount;
        await student.save();
        imported += 1;
      } catch (err) { failed += 1; }
    }
    res.redirect(`/admin/fees?imported=${imported}&failed=${failed}`);
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
