const User = require('../../models/User');
const Fee = require('../../models/Fee');
const Lead = require('../../models/Lead');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const Progress = require('../../models/Progress');
const Schedule = require('../../models/Schedule');
const DailyUpdate = require('../../models/DailyUpdate');
const { todayIST } = require('../../utils/dateHelper');
const { escapeRegex } = require('../../utils/sanitize');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const logger = require('../../utils/logger');

/**
 * Helper to convert array of objects to CSV formatted string.
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const cleanVal = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
      const escaped = cleanVal.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}

/**
 * GET /admin/attendance
 * Admin only. Renders daily attendance logs list with batch and date filters.
 */
exports.getAttendanceOverview = async (req, res) => {
  try {
    const { batch, date } = req.query;
    const today = date || todayIST();
    const filter = { date: today };
    if (batch) filter.batch = batch;

    const records = await Attendance.find(filter)
      .populate('student', 'name course batch')
      .populate('teacher', 'name');

    const batches = await User.distinct('batch', { role: 'student', isActive: true });
    res.render('admin/attendance', { title: 'Attendance Overview', user: req.user, records, batches, date: today, batch });
  } catch (err) {
    logger.error('getAttendanceOverview Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/reports
 * Admin only. Retrieves advanced analytics, grouping records for 7 operational tabs:
 * 1. general (Overview)
 * 2. revenue (Target vs Actual collections, installment due date anchored)
 * 3. counsellors (KPI roster, conversions, lead times)
 * 4. attendance (Batch-level attendance summary)
 * 5. batch_health (Composite health scores per batch)
 * 6. funnel_velocity (Transition metrics)
 * 7. aging (Overdue fee aging buckets)
 * 8. at_risk (Flagged students alerts)
 * 9. teacher_load (Teacher load statistics)
 *
 * Supports CSV export via ?export=csv
 */
exports.getReports = async (req, res) => {
  try {
    const { tab = 'general', batch = '', export: exportType } = req.query;
    const now = new Date();
    
    // Batches list for filter dropdown
    const batches = await User.distinct('batch', { role: 'student', isActive: true });

    let reportData = [];
    let templateName = 'admin/reports';
    let renderData = {
      title: 'Reports & Analytics',
      user: req.user,
      tab,
      batch,
      batches,
      students: [],
      feeStats: {},
      leadsByStatus: {},
      leadsBySource: {},
      revenueData: [],
      counsellorPerformance: [],
      attendanceSummary: [],
      batchHealthScores: [],
      funnelVelocity: {},
      agingBuckets: {},
      atRiskStudents: [],
      teacherLoad: []
    };

    // ─── TAB 1: GENERAL OVERVIEW ──────────────────────────────────────────────
    if (tab === 'general') {
      const [allStudents, allFees, allLeads] = await Promise.all([
        User.find({ role: 'student', isActive: true }).select('name course batch enrollmentDate'),
        Fee.find().populate('student', 'name course batch'),
        Lead.find().select('status source course createdAt'),
      ]);

      renderData.students = allStudents;
      renderData.leadsByStatus = allLeads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});
      renderData.leadsBySource = allLeads.reduce((acc, l) => { acc[l.source] = (acc[l.source] || 0) + 1; return acc; }, {});
      renderData.feeStats = {
        totalRevenue: allFees.reduce((s, f) => s + f.paidAmount, 0),
        totalDue: allFees.reduce((s, f) => s + Math.max(0, f.totalAmount - f.discount - f.paidAmount), 0),
        count: allFees.length,
      };

      if (exportType === 'csv') {
        reportData = allStudents.map(s => ({
          Name: s.name,
          Course: s.course,
          Batch: s.batch,
          EnrollmentDate: s.enrollmentDate
        }));
      }
    }

    // ─── TAB 2: REVENUE TARGET VS ACTUAL (INSTALLMENT ANCHORED) ───────────────
    else if (tab === 'revenue') {
      const fees = await Fee.find({}).populate('student');
      const monthlyStats = {};

      fees.forEach(f => {
        // Group targets based on installment due dates (with top-level createdAt fallback)
        if (f.installments && f.installments.length > 0) {
          f.installments.forEach(inst => {
            const targetMonth = inst.dueDate ? inst.dueDate.toISOString().slice(0, 7) : f.createdAt.toISOString().slice(0, 7);
            if (!monthlyStats[targetMonth]) {
              monthlyStats[targetMonth] = { month: targetMonth, target: 0, actual: 0 };
            }
            monthlyStats[targetMonth].target += inst.amount;
          });
        } else {
          const targetMonth = f.createdAt ? f.createdAt.toISOString().slice(0, 7) : now.toISOString().slice(0, 7);
          const targetNet = f.totalAmount - (f.discount || 0);
          if (!monthlyStats[targetMonth]) {
            monthlyStats[targetMonth] = { month: targetMonth, target: 0, actual: 0 };
          }
          monthlyStats[targetMonth].target += targetNet;
        }

        // Group actual payments based on payment transaction date
        f.payments.forEach(p => {
          const payMonth = p.paidAt ? p.paidAt.toISOString().slice(0, 7) : now.toISOString().slice(0, 7);
          if (!monthlyStats[payMonth]) {
            monthlyStats[payMonth] = { month: payMonth, target: 0, actual: 0 };
          }
          monthlyStats[payMonth].actual += p.amount;
        });
      });

      renderData.revenueData = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));

      if (exportType === 'csv') {
        reportData = renderData.revenueData.map(r => ({
          Month: r.month,
          TargetTarget: r.target,
          ActualCollections: r.actual
        }));
      }
    }

    // ─── TAB 3: COUNSELLOR PERFORMANCE KPIs ───────────────────────────────────
    else if (tab === 'counsellors') {
      const stats = await Lead.aggregate([
        { $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
          contacted: { $sum: { $cond: [{ $eq: ['$status', 'contacted'] }, 1, 0] } },
          interested: { $sum: { $cond: [{ $eq: ['$status', 'interested'] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } }
        }}
      ]);

      const counsellors = await User.find({ role: 'counsellor' });
      for (const c of counsellors) {
        const leadStat = stats.find(s => String(s._id) === String(c._id)) || { total: 0, converted: 0, contacted: 0, interested: 0, lost: 0 };
        const leads = await Lead.find({ assignedTo: c._id });
        const followUps = leads.reduce((sum, l) => sum + (l.followUpHistory ? l.followUpHistory.length : 0), 0);

        // Average days to convert
        const convertedLeads = leads.filter(l => l.status === 'converted' && l.createdAt);
        let avgDays = 0;
        if (convertedLeads.length > 0) {
          const totalDays = convertedLeads.reduce((sum, l) => {
            const convDate = l.convertedAt || l.updatedAt;
            const diffMs = new Date(convDate) - new Date(l.createdAt);
            return sum + Math.max(0, diffMs / (1000 * 60 * 60 * 24));
          }, 0);
          avgDays = Math.round(totalDays / convertedLeads.length);
        }

        renderData.counsellorPerformance.push({
          counsellor: c,
          total: leadStat.total,
          converted: leadStat.converted,
          contacted: leadStat.contacted,
          interested: leadStat.interested,
          lost: leadStat.lost,
          followUps,
          conversionRate: leadStat.total > 0 ? Math.round((leadStat.converted / leadStat.total) * 100) : 0,
          avgDays
        });
      }

      if (exportType === 'csv') {
        reportData = renderData.counsellorPerformance.map(cp => ({
          Counsellor: cp.counsellor.name,
          TotalLeads: cp.total,
          Converted: cp.converted,
          Contacted: cp.contacted,
          Interested: cp.interested,
          Lost: cp.lost,
          FollowUpsLogged: cp.followUps,
          ConversionRatePct: cp.conversionRate,
          AvgConversionDays: cp.avgDays
        }));
      }
    }

    // ─── TAB 4: BATCH ATTENDANCE SUMMARY ──────────────────────────────────────
    else if (tab === 'attendance') {
      const todayISTStr = todayIST(); // 'YYYY-MM-DD'
      const defaultMonth = todayISTStr.slice(0, 7); // 'YYYY-MM'
      const selectedMonth = req.query.month || defaultMonth;
      
      const [year, monthNum] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      
      const holidaysList = await Holiday.find({ date: { $regex: '^' + selectedMonth } });
      const holidayDates = new Set(holidaysList.map(h => h.date));
      const holidayMap = {};
      holidaysList.forEach(h => { holidayMap[h.date] = h.name; });

      renderData.selectedMonth = selectedMonth;

      // Generate all calendar dates
      const calendarDays = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(year, monthNum - 1, day);
        calendarDays.push({
          dateStr,
          dayNum: day,
          dayOfWeek: dateObj.getDay(), // 0 = Sunday, 1 = Monday, etc.
          isHoliday: holidayDates.has(dateStr),
          holidayName: holidayMap[dateStr] || null,
          attendancePct: null,
          totalStudentsMarked: 0,
          presentCount: 0
        });
      }
      renderData.calendarDays = calendarDays;

      // Fetch students based on batch filter (or all students if no batch filtered)
      const studentFilter = { role: 'student' };
      if (batch) {
        studentFilter.batch = batch;
      }
      const students = await User.find(studentFilter).sort({ name: 1 });
      
      if (students.length > 0) {
        const studentIds = students.map(s => s._id);
        // Query all attendance records for these students in this month
        const attendanceRecords = await Attendance.find({
          student: { $in: studentIds },
          date: { $regex: '^' + selectedMonth }
        }).populate('student', 'name');

        // Calculate daily attendance percentage
        calendarDays.forEach(day => {
          const dayRecs = attendanceRecords.filter(r => r.date === day.dateStr);
          if (dayRecs.length > 0) {
            const total = dayRecs.length;
            const present = dayRecs.filter(r => r.status === 'present' || r.status === 'late').length;
            day.attendancePct = Math.round((present / total) * 100);
            day.totalStudentsMarked = total;
            day.presentCount = present;
          }
        });

        if (batch) {
          // Generate student grid data
          // Skip holidays for grid columns
          const gridDates = calendarDays.filter(day => !day.isHoliday).map(day => day.dateStr);
          renderData.gridDates = gridDates;

          // For each student, map their attendance status per grid date
          const studentGrid = students.map(student => {
            const studentRecs = attendanceRecords.filter(r => String(r.student._id || r.student) === String(student._id));
            const attendanceByDate = {};
            studentRecs.forEach(r => {
              attendanceByDate[r.date] = r.status; // 'present', 'absent', 'late'
            });

            return {
              _id: student._id,
              name: student.name,
              attendanceByDate
            };
          });
          renderData.studentGrid = studentGrid;
          
          // Legacy support (to avoid breaking any other template parts or charts)
          const allBatchAttendanceRecords = await Attendance.find({ student: { $in: studentIds } });
          await calculateStudentsAttendance(students, allBatchAttendanceRecords);
          renderData.attendanceSummary = students;
          renderData.monthlyAttendanceRecords = attendanceRecords;
        } else {
          renderData.monthlyAttendanceRecords = attendanceRecords;
          renderData.gridDates = [];
          renderData.studentGrid = [];
        }
      } else {
        renderData.monthlyAttendanceRecords = [];
        renderData.gridDates = [];
        renderData.studentGrid = [];
      }

      if (exportType === 'csv') {
        reportData = (renderData.attendanceSummary || []).map(s => ({
          Student: s.name,
          RollNumber: s.rollNumber,
          AttendancePct: s.attendancePct,
          ClassesConducted: s.attendanceStats ? (s.attendanceStats.present + s.attendanceStats.absent) : 0,
          Present: s.attendanceStats ? s.attendanceStats.present : 0
        }));
      }
    }

    // ─── TAB 5: BATCH HEALTH SCORE ────────────────────────────────────────────
    else if (tab === 'batch_health') {
      const activeBatches = await User.distinct('batch', { role: 'student', isActive: true });
      for (const b of activeBatches) {
        const students = await User.find({ role: 'student', batch: b, isActive: true });
        if (students.length === 0) continue;

        const studentIds = students.map(s => s._id);
        const [attendanceList, assignments, progressList, fees] = await Promise.all([
          Attendance.find({ student: { $in: studentIds } }),
          Assignment.find({ batch: b }),
          Progress.find({ student: { $in: studentIds } }),
          Fee.find({ student: { $in: studentIds } })
        ]);

        // 1. Avg Attendance Pct
        let avgAttendance = 0;
        if (attendanceList.length > 0) {
          const totalDays = attendanceList.length;
          const presentDays = attendanceList.filter(a => a.status === 'present').length;
          avgAttendance = Math.round((presentDays / totalDays) * 100);
        } else {
          avgAttendance = 100; // default
        }

        // 2. Avg Assignment Submission rate
        let submissionRate = 0;
        if (assignments.length > 0) {
          const totalSubmissionsExpected = students.length * assignments.length;
          const totalSubmissionsActual = progressList.reduce((sum, p) => sum + (p.submissions ? p.submissions.length : 0), 0);
          submissionRate = Math.round((totalSubmissionsActual / totalSubmissionsExpected) * 100);
        } else {
          submissionRate = 100; // default
        }

        // 3. Fee Collection rate
        let totalBillable = 0;
        let totalCollected = 0;
        fees.forEach(f => {
          totalBillable += (f.totalAmount - (f.discount || 0));
          totalCollected += f.paidAmount;
        });
        const collectionRate = totalBillable > 0 ? Math.round((totalCollected / totalBillable) * 100) : 100;

        // Composite Health Score
        const healthScore = Math.round((avgAttendance + submissionRate + collectionRate) / 3);

        renderData.batchHealthScores.push({
          batchName: b,
          studentCount: students.length,
          avgAttendance,
          submissionRate,
          collectionRate,
          healthScore
        });
      }

      if (exportType === 'csv') {
        reportData = renderData.batchHealthScores.map(bh => ({
          Batch: bh.batchName,
          Students: bh.studentCount,
          AttendanceRatePct: bh.avgAttendance,
          SubmissionRatePct: bh.submissionRate,
          CollectionRatePct: bh.collectionRate,
          CompositeHealthScore: bh.healthScore
        }));
      }
    }

    // ─── TAB 6: LEAD FUNNEL VELOCITY ──────────────────────────────────────────
    else if (tab === 'funnel_velocity') {
      const convertedLeads = await Lead.find({ status: 'converted' });
      
      let newToContactedDays = [];
      let contactedToInterestedDays = [];
      let interestedToConvertedDays = [];
      let overallConversionDays = [];

      convertedLeads.forEach(l => {
        const history = l.followUpHistory || [];
        const sortedHistory = [...history].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

        const createdDate = new Date(l.createdAt);
        const convertedDate = new Date(l.convertedAt || l.updatedAt);
        overallConversionDays.push((convertedDate - createdDate) / (1000 * 60 * 60 * 24));

        let contactedDate = null;
        let interestedDate = null;

        sortedHistory.forEach(h => {
          if (h.status === 'contacted' && !contactedDate) {
            contactedDate = new Date(h.date || h.createdAt);
          }
          if (h.status === 'interested' && !interestedDate) {
            interestedDate = new Date(h.date || h.createdAt);
          }
        });

        if (contactedDate) {
          newToContactedDays.push((contactedDate - createdDate) / (1000 * 60 * 60 * 24));
        }
        if (contactedDate && interestedDate && interestedDate > contactedDate) {
          contactedToInterestedDays.push((interestedDate - contactedDate) / (1000 * 60 * 60 * 24));
        }
        if (interestedDate) {
          interestedToConvertedDays.push((convertedDate - interestedDate) / (1000 * 60 * 60 * 24));
        }
      });

      const avg = arr => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

      renderData.funnelVelocity = {
        newToContacted: avg(newToContactedDays),
        contactedToInterested: avg(contactedToInterestedDays),
        interestedToConverted: avg(interestedToConvertedDays),
        overall: avg(overallConversionDays),
        count: convertedLeads.length
      };

      if (exportType === 'csv') {
        reportData = [{
          Metric: 'New to Contacted (Avg Days)',
          Days: renderData.funnelVelocity.newToContacted
        }, {
          Metric: 'Contacted to Interested (Avg Days)',
          Days: renderData.funnelVelocity.contactedToInterested
        }, {
          Metric: 'Interested to Converted (Avg Days)',
          Days: renderData.funnelVelocity.interestedToConverted
        }, {
          Metric: 'Overall Funnel Duration (Avg Days)',
          Days: renderData.funnelVelocity.overall
        }, {
          Metric: 'Total Sample Size',
          Days: renderData.funnelVelocity.count
        }];
      }
    }

    // ─── TAB 7: FEE COLLECTION AGING ──────────────────────────────────────────
    else if (tab === 'aging') {
      const fees = await Fee.find({}).populate('student');
      
      let aging = {
        current: 0,
        days_1_30: 0,
        days_31_60: 0,
        days_61_90: 0,
        days_91_plus: 0
      };

      fees.forEach(f => {
        if (!f.installments || f.installments.length === 0) {
          const due = Math.max(0, f.totalAmount - (f.discount || 0) - f.paidAmount);
          if (due > 0) {
            if (f.dueDate && new Date(f.dueDate) < now) {
              const diffDays = Math.ceil((now - new Date(f.dueDate)) / (1000 * 60 * 60 * 24));
              if (diffDays <= 30) aging.days_1_30 += due;
              else if (diffDays <= 60) aging.days_31_60 += due;
              else if (diffDays <= 90) aging.days_61_90 += due;
              else aging.days_91_plus += due;
            } else {
              aging.current += due;
            }
          }
        } else {
          f.installments.forEach(inst => {
            const due = Math.max(0, inst.amount - inst.paidAmount);
            if (due > 0) {
              if (inst.dueDate && new Date(inst.dueDate) < now) {
                const diffDays = Math.ceil((now - new Date(inst.dueDate)) / (1000 * 60 * 60 * 24));
                if (diffDays <= 30) aging.days_1_30 += due;
                else if (diffDays <= 60) aging.days_31_60 += due;
                else if (diffDays <= 90) aging.days_61_90 += due;
                else aging.days_91_plus += due;
              } else {
                aging.current += due;
              }
            }
          });
        }
      });

      renderData.agingBuckets = aging;

      if (exportType === 'csv') {
        reportData = [
          { Bucket: 'Current (Not Overdue)', Amount: aging.current },
          { Bucket: '1-30 Days Overdue', Amount: aging.days_1_30 },
          { Bucket: '31-60 Days Overdue', Amount: aging.days_31_60 },
          { Bucket: '61-90 Days Overdue', Amount: aging.days_61_90 },
          { Bucket: '90+ Days Overdue', Amount: aging.days_91_plus }
        ];
      }
    }

    // ─── TAB 8: AT-RISK STUDENT ALERTS ────────────────────────────────────────
    else if (tab === 'at_risk') {
      const students = await User.find({ role: 'student', isActive: true });
      const studentIds = students.map(s => s._id);
      
      const [attendanceRecords, feesList, progressList] = await Promise.all([
        Attendance.find({ student: { $in: studentIds } }),
        Fee.find({ student: { $in: studentIds } }),
        Progress.find({ student: { $in: studentIds } })
      ]);

      await calculateStudentsAttendance(students, attendanceRecords);

      const atRisk = [];
      for (const s of students) {
        const fee = feesList.find(f => String(f.student) === String(s._id));
        const progress = progressList.find(p => String(p.student) === String(s._id));

        const dueAmount = fee ? Math.max(0, fee.totalAmount - (fee.discount || 0) - fee.paidAmount) : 0;
        const isFeeOverdue = fee && dueAmount > 0 && fee.dueDate && new Date(fee.dueDate) < now;

        const ungradedSubmissionsCount = progress ? (progress.submissions ? progress.submissions.filter(sub => !sub.graded).length : 0) : 0;

        let riskReasons = [];
        if (s.attendancePct < 75) {
          riskReasons.push(`Low Attendance (${s.attendancePct}%)`);
        }
        if (isFeeOverdue) {
          riskReasons.push(`Overdue Fees (₹${dueAmount})`);
        }
        if (ungradedSubmissionsCount >= 3) {
          riskReasons.push(`${ungradedSubmissionsCount} unsubmitted/pending assignments`);
        }

        if (riskReasons.length > 0) {
          atRisk.push({
            student: s,
            attendance: s.attendancePct,
            overdueFees: dueAmount,
            pendingAssignments: ungradedSubmissionsCount,
            reasons: riskReasons.join(', ')
          });
        }
      }

      renderData.atRiskStudents = atRisk;

      if (exportType === 'csv') {
        reportData = atRisk.map(ar => ({
          StudentName: ar.student.name,
          RollNumber: ar.student.rollNumber,
          AttendancePct: ar.attendance,
          OverdueFees: ar.overdueFees,
          PendingAssignmentsCount: ar.pendingAssignments,
          RiskReasons: ar.reasons
        }));
      }
    }

    // ─── TAB 9: TEACHER LOAD & OUTPUT ─────────────────────────────────────────
    else if (tab === 'teacher_load') {
      const teachers = await User.find({ role: 'teacher', isActive: true });
      for (const t of teachers) {
        const [completedClasses, dailyUpdatesCount, pendingSubmissions] = await Promise.all([
          Schedule.countDocuments({ teacher: t._id, status: 'completed' }),
          DailyUpdate.countDocuments({ teacher: t._id }),
          Progress.countDocuments({ teacher: t._id, 'submissions.graded': false })
        ]);

        renderData.teacherLoad.push({
          teacher: t,
          classesConducted: completedClasses,
          updatesCount: dailyUpdatesCount,
          pendingGradingCount: pendingSubmissions
        });
      }

      if (exportType === 'csv') {
        reportData = renderData.teacherLoad.map(tl => ({
          Teacher: tl.teacher.name,
          ClassesConducted: tl.classesConducted,
          DailyUpdatesPosted: tl.updatesCount,
          PendingGradingSubmissions: tl.pendingGradingCount
        }));
      }
    }

    // ─── RUN EXPORT ACTION ──────────────────────────────────────────────────
    if (exportType === 'csv') {
      const csvStr = convertToCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report_${tab}_${new Date().toISOString().slice(0, 10)}.csv`);
      return res.status(200).send(csvStr);
    }

    // Otherwise render standard EJS views template
    res.render(templateName, renderData);
  } catch (err) {
    logger.error('getReports Error', { err: err.message, stack: err.stack });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};
