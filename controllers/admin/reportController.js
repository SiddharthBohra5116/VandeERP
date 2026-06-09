const User = require('../../models/User');
const Fee = require('../../models/Fee');
const Lead = require('../../models/Lead');
const Expense = require('../../models/Expense');
const RevenueTarget = require('../../models/RevenueTarget');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const Progress = require('../../models/Progress');
const Schedule = require('../../models/Schedule');
const DailyUpdate = require('../../models/DailyUpdate');
const Holiday = require('../../models/Holiday');
const Curriculum = require('../../models/Curriculum');
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
 * Admin only. Advanced executive insights dashboard with Period, Batch, and Course filters, rich visualizations.
 */
exports.getReports = async (req, res) => {
  try {
    const {
      tab = 'overview',
      batch = 'all',
      course = 'all',
      export: exportType
    } = req.query;

    let { startDate, endDate } = req.query;

    const now = new Date();

    // Default to current month if no range is selected
    if (!startDate || !endDate) {
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      startDate = startDate || startOfCurrentMonth.toISOString().slice(0, 10);
      endDate = endDate || endOfCurrentMonth.toISOString().slice(0, 10);
    }

    const startOfPeriod = new Date(startDate + 'T00:00:00');
    const endOfPeriod = new Date(endDate + 'T23:59:59');

    // Calculate comparison period (for trends) of the same duration
    const periodLengthMs = endOfPeriod - startOfPeriod;
    const compStartDate = new Date(startOfPeriod.getTime() - periodLengthMs - 1);
    const compEndDate = new Date(startOfPeriod.getTime() - 1);
    const periodLabel = 'previous period';
    
    // 1. Get Distinct Filter Lists
    const [batches, courses] = await Promise.all([
      User.distinct('batch', { role: 'student', batch: { $ne: null } }),
      User.distinct('course', { role: 'student', course: { $ne: null } })
    ]);

    // Build DB query filters
    const studentQuery = { role: 'student' };
    if (batch !== 'all') studentQuery.batch = batch;
    if (course !== 'all') studentQuery.course = course;
    
    // Filter students enrolled or created within the range
    studentQuery.$or = [
      { enrollmentDate: { $gte: startOfPeriod, $lte: endOfPeriod } },
      { createdAt: { $gte: startOfPeriod, $lte: endOfPeriod } }
    ];

    // Fetch filtered students
    const dbStudents = await User.find(studentQuery);
    const studentIds = dbStudents.map(s => s._id);

    // Active students count
    const activeCount = dbStudents.filter(s => s.status === 'active').length;
    const newThisMonth = dbStudents.length;

    // Collections & Outstandings calculations
    const fees = await Fee.find({ student: { $in: studentIds } });

    
    let currentPeriodCollection = 0;
    let compPeriodCollection = 0;
    let totalBilled = 0;
    let totalCollected = 0;

    // Payment methods map
    const paymentMethods = { UPI: 0, 'Bank Transfer': 0, Cash: 0, Other: 0 };

    fees.forEach(f => {
      // Calculate amount billed within range
      let billedInRange = 0;
      if (f.installments && f.installments.length > 0) {
        f.installments.forEach(inst => {
          if (inst.dueDate && inst.dueDate >= startOfPeriod && inst.dueDate <= endOfPeriod) {
            billedInRange += inst.amount;
          }
        });
      } else if (f.createdAt && f.createdAt >= startOfPeriod && f.createdAt <= endOfPeriod) {
        billedInRange += (f.totalAmount - (f.discount || 0));
      }
      totalBilled += billedInRange;

      f.payments.forEach(p => {
        if (p.paidAt) {
          const payDate = new Date(p.paidAt);
          if (payDate >= startOfPeriod && payDate <= endOfPeriod) {
            currentPeriodCollection += p.amount;
            totalCollected += p.amount;

            // Method tally
            const m = p.method || 'Other';
            if (paymentMethods.hasOwnProperty(m)) {
              paymentMethods[m] += p.amount;
            } else {
              paymentMethods.Other += p.amount;
            }
          }
          
          if (compStartDate && compEndDate && payDate >= compStartDate && payDate <= compEndDate) {
            compPeriodCollection += p.amount;
          }
        }
      });
    });

    const outstandingAmount = Math.max(0, totalBilled - totalCollected);
    
    // Outstanding trend percentage vs total billed
    let outstandingDiffPct = 0;
    if (totalBilled > 0) {
      outstandingDiffPct = Math.round((outstandingAmount / totalBilled) * 100);
    }

    // Collection trend
    let collDiffPct = 0;
    if (compPeriodCollection > 0) {
      collDiffPct = Math.round(((currentPeriodCollection - compPeriodCollection) / compPeriodCollection) * 100);
    }

    // Attendance
    const attFilter = { student: { $in: studentIds } };
    attFilter.date = { $gte: startDate, $lte: endDate };
    const attendanceRecords = await Attendance.find(attFilter);
    let avgAtt = 0;
    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
      avgAtt = Math.round((present / attendanceRecords.length) * 100);
    }

    // Leads & Conversion Rate
    const leadFilter = {};
    if (course !== 'all') leadFilter.course = course;
    leadFilter.createdAt = { $gte: startOfPeriod, $lte: endOfPeriod };
    const leads = await Lead.find(leadFilter);
    const openLeadsCount = leads.filter(l => ['new', 'contacted', 'interested'].includes(l.status)).length;
    const convertedCount = leads.filter(l => l.status === 'converted').length;
    const totalLeads = leads.length;
    const cRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    // Leads Trend: new leads this week
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newLeadsThisWeek = leads.filter(l => l.createdAt >= oneWeekAgo).length;

    // Format overview metrics
    const overviewStats = {
      activeStudents: { value: activeCount, trend: `▲ ${newThisMonth} in date range`, isPositive: true },
      collection: { 
        value: `₹${(currentPeriodCollection / 100000).toFixed(1)}L`, 
        trend: collDiffPct >= 0 ? `▲ ${collDiffPct}% vs ${periodLabel}` : `▼ ${Math.abs(collDiffPct)}% vs ${periodLabel}`, 
        isPositive: collDiffPct >= 0 
      },
      outstanding: { 
        value: `₹${(outstandingAmount / 100000).toFixed(1)}L`, 
        trend: `▼ ${outstandingDiffPct}% of total billed`, 
        isPositive: outstandingAmount === 0 
      },
      avgAttendance: { 
        value: `${avgAtt}%`, 
        trend: avgAtt >= 75 ? `▲ Above 75% threshold` : `▼ Below 75% threshold`, 
        isPositive: avgAtt >= 75 
      },
      openLeads: { 
        value: openLeadsCount, 
        trend: `▲ ${newLeadsThisWeek} new this week`, 
        isPositive: true 
      },
      convRate: { 
        value: `${cRate}%`, 
        trend: `Converted ${convertedCount} leads`, 
        isPositive: cRate >= 35 
      },
      keyInsight: `Collection efficiency is ${totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0}% under the selected filters. Open leads volume stands at ${openLeadsCount} with a conversion rate of ${cRate}%. Average attendance is ${avgAtt}%.`
    };

    // Populate chart datasets dynamically
    // 1. Revenue vs Collection monthly datasets
    const revenueVsCollectionMonths = [];
    const revenueVsCollectionBilled = [];
    const revenueVsCollectionCollected = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toLocaleDateString('en-US', { month: 'short' });
      const yearMonth = d.toISOString().slice(0, 7); // 'YYYY-MM'

      revenueVsCollectionMonths.push(mStr);

      let billedInMonth = 0;
      let collectedInMonth = 0;

      fees.forEach(f => {
        if (f.installments && f.installments.length > 0) {
          f.installments.forEach(inst => {
            if (inst.dueDate && inst.dueDate.toISOString().slice(0, 7) === yearMonth) {
              billedInMonth += inst.amount;
            }
          });
        } else if (f.createdAt && f.createdAt.toISOString().slice(0, 7) === yearMonth) {
          billedInMonth += (f.totalAmount - (f.discount || 0));
        }
        
        f.payments.forEach(p => {
          if (p.paidAt && p.paidAt.toISOString().slice(0, 7) === yearMonth) {
            collectedInMonth += p.amount;
          }
        });
      });

      revenueVsCollectionBilled.push(billedInMonth);
      revenueVsCollectionCollected.push(collectedInMonth);
    }

    // 2. Enrollment trend datasets
    const enrollmentTrendMonths = [];
    const enrollmentTrendCounts = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toLocaleDateString('en-US', { month: 'short' });
      const yearMonth = d.toISOString().slice(0, 7);

      enrollmentTrendMonths.push(mStr);
      const enrolledCount = dbStudents.filter(s => s.enrollmentDate && s.enrollmentDate.toISOString().slice(0, 7) === yearMonth).length;
      enrollmentTrendCounts.push(enrolledCount);
    }

    // 3. Attendance 7-day daily percent datasets
    const attendanceTrendDays = [];
    const attendanceTrendPct = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateKey = d.toISOString().slice(0, 10);

      attendanceTrendDays.push(dStr);
      
      const dayRecs = attendanceRecords.filter(r => r.date === dateKey);
      if (dayRecs.length > 0) {
        const present = dayRecs.filter(r => r.status === 'present' || r.status === 'late').length;
        attendanceTrendPct.push(Math.round((present / dayRecs.length) * 100));
      } else {
        attendanceTrendPct.push(0);
      }
    }

    // 4. Lead Funnel Stage counts
    const funnelStages = {
      Leads: leads.length,
      Contacted: leads.filter(l => ['contacted', 'interested', 'ready_to_convert', 'converted'].includes(l.status)).length,
      Interested: leads.filter(l => ['interested', 'ready_to_convert', 'converted'].includes(l.status)).length,
      Enrolled: leads.filter(l => l.status === 'converted').length
    };

    // 5. Lead Channels (Sources) distribution count
    const leadSourcesData = leads.reduce((acc, l) => {
      acc[l.source] = (acc[l.source] || 0) + 1;
      return acc;
    }, {});

    // 6. Student distribution per batch
    const studentBatchDistribution = dbStudents.reduce((acc, s) => {
      if (s.batch) {
        acc[s.batch] = (acc[s.batch] || 0) + 1;
      }
      return acc;
    }, {});

    // 7. Cumulative billed revenue monthly growth
    const cumulativeBillingMonths = [];
    const cumulativeBillingGrowth = [];
    let runningBilledSum = 0;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toLocaleDateString('en-US', { month: 'short' });
      const yearMonth = d.toISOString().slice(0, 7);

      cumulativeBillingMonths.push(mStr);
      
      let billedInMonth = 0;
      fees.forEach(f => {
        if (f.installments && f.installments.length > 0) {
          f.installments.forEach(inst => {
            if (inst.dueDate && inst.dueDate.toISOString().slice(0, 7) === yearMonth) {
              billedInMonth += inst.amount;
            }
          });
        } else if (f.createdAt && f.createdAt.toISOString().slice(0, 7) === yearMonth) {
          billedInMonth += (f.totalAmount - (f.discount || 0));
        }
      });
      runningBilledSum += billedInMonth;
      cumulativeBillingGrowth.push(runningBilledSum);
    }

    // 8. Homework Submission Activity vs Grading Activity by week
    const weeklyHomeworkLabels = [];
    const weeklyHomeworkSubmitted = [];
    const weeklyHomeworkGraded = [];
    
    // Fetch all assignments for batches in the student pool
    const weeklyAssignments = await Assignment.find({
      batch: { $in: [...new Set(dbStudents.map(s => s.batch).filter(Boolean))] }
    });

    for (let i = 3; i >= 0; i--) {
      const startOfWeek = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const endOfWeek   = new Date(now.getTime() - i       * 7 * 24 * 60 * 60 * 1000);
      weeklyHomeworkLabels.push(`Wk -${i}`);

      let submissionsCount = 0;
      let gradedCount = 0;

      weeklyAssignments.forEach(a => {
        a.submissions.forEach(sub => {
          if (sub.submittedAt) {
            const submittedAt = new Date(sub.submittedAt);
            if (submittedAt >= startOfWeek && submittedAt <= endOfWeek) {
              submissionsCount++;
              if (sub.status === 'graded') gradedCount++;
            }
          }
        });
      });

      weeklyHomeworkSubmitted.push(submissionsCount);
      weeklyHomeworkGraded.push(gradedCount);
    }

    let reportData = [];
    let templateName = 'admin/reports';
    let renderData = {
      title: 'Reports & Analytics',
      user: req.user,
      tab,
      startDate,
      endDate,
      batch,
      course,
      batches,
      courses,
      overviewStats,
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
      teacherLoad: [],
      calendarDays: [],
      studentGrid: [],
      gridDates: [],
      selectedMonth: now.toISOString().slice(0, 7),
      charts: {
        revenueVsCollection: {
          months: revenueVsCollectionMonths,
          billed: revenueVsCollectionBilled,
          collected: revenueVsCollectionCollected
        },
        enrollmentTrend: {
          months: enrollmentTrendMonths,
          counts: enrollmentTrendCounts
        },
        attendanceTrend: {
          days: attendanceTrendDays,
          pct: attendanceTrendPct
        },
        leadFunnel: funnelStages,
        leadSources: {
          labels: Object.keys(leadSourcesData),
          values: Object.values(leadSourcesData)
        },
        batchDistribution: {
          labels: Object.keys(studentBatchDistribution),
          values: Object.values(studentBatchDistribution)
        },
        paymentMethods: {
          labels: Object.keys(paymentMethods),
          values: Object.values(paymentMethods)
        },
        cumulativeBilling: {
          months: cumulativeBillingMonths,
          growth: cumulativeBillingGrowth
        },
        weeklyHomework: {
          labels: weeklyHomeworkLabels,
          submitted: weeklyHomeworkSubmitted,
          graded: weeklyHomeworkGraded
        }
      }
    };

    // Populate data depending on active tab
    // ─── TAB: OVERVIEW ──────────────────────────────────────────────
    if (tab === 'overview') {
      const [allStudents, allFees, allLeads] = await Promise.all([
        User.find(studentQuery).select('name course batch enrollmentDate'),
        Fee.find().populate('student'),
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

    // ─── TAB: FINANCIAL ─────────────────────────────────────────────
    else if (tab === 'financial') {
      const monthlyStats = {};
      const [expensesList, customTargets] = await Promise.all([
        Expense.find({}).sort({ date: -1 }),
        RevenueTarget.find({})
      ]);

      const customTargetsMap = {};
      customTargets.forEach(t => {
        customTargetsMap[t.month] = t.amount;
      });

      const monthlyExpenses = {};
      expensesList.forEach(exp => {
        if (!monthlyExpenses[exp.month]) {
          monthlyExpenses[exp.month] = { total: 0, rent: 0, electricity: 0, staff: 0, miscellaneous: 0 };
        }
        monthlyExpenses[exp.month].total += exp.amount;
        monthlyExpenses[exp.month][exp.category] += exp.amount;
      });
      
      fees.forEach(f => {
        if (f.installments && f.installments.length > 0) {
          f.installments.forEach(inst => {
            const targetMonth = inst.dueDate ? inst.dueDate.toISOString().slice(0, 7) : f.createdAt.toISOString().slice(0, 7);
            if (!monthlyStats[targetMonth]) {
              monthlyStats[targetMonth] = { month: targetMonth, target: 0, actual: 0, expense: 0, netProfit: 0 };
            }
            monthlyStats[targetMonth].target += inst.amount;
          });
        } else {
          const targetMonth = f.createdAt ? f.createdAt.toISOString().slice(0, 7) : now.toISOString().slice(0, 7);
          const targetNet = f.totalAmount - (f.discount || 0);
          if (!monthlyStats[targetMonth]) {
            monthlyStats[targetMonth] = { month: targetMonth, target: 0, actual: 0, expense: 0, netProfit: 0 };
          }
          monthlyStats[targetMonth].target += targetNet;
        }

        f.payments.forEach(p => {
          const payMonth = p.paidAt ? p.paidAt.toISOString().slice(0, 7) : now.toISOString().slice(0, 7);
          if (!monthlyStats[payMonth]) {
            monthlyStats[payMonth] = { month: payMonth, target: 0, actual: 0, expense: 0, netProfit: 0 };
          }
          monthlyStats[payMonth].actual += p.amount;
        });
      });

      const allMonths = new Set([...Object.keys(monthlyStats), ...Object.keys(monthlyExpenses), ...Object.keys(customTargetsMap)]);
      allMonths.forEach(m => {
        if (!monthlyStats[m]) {
          monthlyStats[m] = { month: m, target: 0, actual: 0, expense: 0, netProfit: 0 };
        }
        if (customTargetsMap[m] !== undefined) {
          monthlyStats[m].target = customTargetsMap[m];
        }
        const expData = monthlyExpenses[m] || { total: 0 };
        monthlyStats[m].expense = expData.total;
        monthlyStats[m].netProfit = monthlyStats[m].actual - monthlyStats[m].expense;
      });

      renderData.revenueData = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));
      renderData.expensesList = expensesList;

      // Calculate Outstanding Aging Buckets
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
        reportData = renderData.revenueData.map(r => ({
          Month: r.month,
          Target: r.target,
          Actual: r.actual,
          Expenses: r.expense,
          NetProfit: r.netProfit
        }));
      }
    }

    // ─── TAB: ENROLLMENT ────────────────────────────────────────────
    else if (tab === 'enrollment') {
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

      // Funnel Velocity
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
          if (h.status === 'contacted' && !contactedDate) contactedDate = new Date(h.date || h.createdAt);
          if (h.status === 'interested' && !interestedDate) interestedDate = new Date(h.date || h.createdAt);
        });

        if (contactedDate) newToContactedDays.push((contactedDate - createdDate) / (1000 * 60 * 60 * 24));
        if (contactedDate && interestedDate && interestedDate > contactedDate) contactedToInterestedDays.push((interestedDate - contactedDate) / (1000 * 60 * 60 * 24));
        if (interestedDate) interestedToConvertedDays.push((convertedDate - interestedDate) / (1000 * 60 * 60 * 24));
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
        reportData = renderData.counsellorPerformance.map(cp => ({
          Counsellor: cp.counsellor.name,
          Leads: cp.total,
          Converted: cp.converted,
          Rate: cp.conversionRate
        }));
      }
    }

    // ─── TAB: ATTENDANCE ────────────────────────────────────────────
    else if (tab === 'attendance') {
      const todayISTStr = todayIST();
      const defaultMonth = todayISTStr.slice(0, 7);
      const selectedMonth = req.query.month || defaultMonth;
      
      const [year, monthNum] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      
      const holidaysList = await Holiday.find({ date: { $regex: '^' + selectedMonth } });
      const holidayDates = new Set(holidaysList.map(h => h.date));
      const holidayMap = {};
      holidaysList.forEach(h => { holidayMap[h.date] = h.name; });

      renderData.selectedMonth = selectedMonth;

      const calendarDays = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(year, monthNum - 1, day);
        calendarDays.push({
          dateStr,
          dayNum: day,
          dayOfWeek: dateObj.getDay(),
          isHoliday: holidayDates.has(dateStr),
          holidayName: holidayMap[dateStr] || null,
          attendancePct: null,
          totalStudentsMarked: 0,
          presentCount: 0
        });
      }
      renderData.calendarDays = calendarDays;

      const students = await User.find(studentQuery).sort({ name: 1 });
      
      if (students.length > 0) {
        const studentIds = students.map(s => s._id);
        const attendanceRecords = await Attendance.find({
          student: { $in: studentIds },
          date: { $regex: '^' + selectedMonth }
        }).populate('student', 'name');

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

        if (batch !== 'all') {
          const gridDates = calendarDays.filter(day => !day.isHoliday).map(day => day.dateStr);
          renderData.gridDates = gridDates;

          const studentGrid = students.map(student => {
            const studentRecs = attendanceRecords.filter(r => String(r.student._id || r.student) === String(student._id));
            const attendanceByDate = {};
            studentRecs.forEach(r => {
              attendanceByDate[r.date] = r.status;
            });

            return {
              _id: student._id,
              name: student.name,
              attendanceByDate
            };
          });
          renderData.studentGrid = studentGrid;
          
          const allBatchAttendanceRecords = await Attendance.find({ student: { $in: studentIds } });
          await calculateStudentsAttendance(students, allBatchAttendanceRecords);
          renderData.attendanceSummary = students;
          renderData.monthlyAttendanceRecords = attendanceRecords;
        } else {
          renderData.monthlyAttendanceRecords = attendanceRecords;
        }
      }
    }

    // ─── TAB: ACADEMIC ──────────────────────────────────────────────
    else if (tab === 'academic') {
      const activeBatches = batch === 'all' ? batches : [batch];
      
      for (const b of activeBatches) {
        const students = await User.find({ role: 'student', batch: b, isActive: true });
        if (students.length === 0) continue;

        const studentIds = students.map(s => s._id);
        const [attendanceList, assignments, progressList, fees] = await Promise.all([
          Attendance.find({ student: { $in: studentIds }, date: { $gte: startDate, $lte: endDate } }),
          Assignment.find({ batch: b, createdAt: { $gte: startOfPeriod, $lte: endOfPeriod } }),
          Progress.find({ student: { $in: studentIds }, createdAt: { $gte: startOfPeriod, $lte: endOfPeriod } }),
          Fee.find({ student: { $in: studentIds }, createdAt: { $gte: startOfPeriod, $lte: endOfPeriod } })
        ]);

        let avgAttendance = 0;
        if (attendanceList.length > 0) {
          const totalDays = attendanceList.length;
          const presentDays = attendanceList.filter(a => a.status === 'present').length;
          avgAttendance = Math.round((presentDays / totalDays) * 100);
        } else {
          avgAttendance = 100;
        }

        let submissionRate = 0;
        if (assignments.length > 0) {
          const totalSubmissionsExpected = students.length * assignments.length;
          const totalSubmissionsActual = assignments.reduce((sum, a) =>
            sum + a.submissions.filter(s => studentIds.some(id => id.toString() === s.student.toString())).length, 0);
          submissionRate = totalSubmissionsExpected > 0 ? Math.round((totalSubmissionsActual / totalSubmissionsExpected) * 100) : 100;
        } else {
          submissionRate = 100;
        }

        let totalBilled = 0;
        let totalCollected = 0;
        fees.forEach(f => {
          totalBilled += (f.totalAmount - (f.discount || 0));
          totalCollected += f.paidAmount;
        });
        const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

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

      // Populate At-Risk Students Alerts via aggregate queries (Issue 3.8)
      const students = await User.find(studentQuery);
      const studentIds = students.map(s => s._id);

      // Fetch fees and progress in parallel
      const [feesList, progressList, allAssignments] = await Promise.all([
        Fee.find({ student: { $in: studentIds } }),
        Progress.find({ student: { $in: studentIds } }),
        Assignment.find({ 'submissions.student': { $in: studentIds } })
      ]);

      // Optimize Attendance calculation via aggregate join
      const attendanceStats = await Attendance.aggregate([
        { $match: { student: { $in: studentIds } } },
        {
          $group: {
            _id: '$student',
            totalCount: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0]
              }
            }
          }
        }
      ]);

      const attendanceMap = {};
      attendanceStats.forEach(stat => {
        attendanceMap[stat._id.toString()] = {
          total: stat.totalCount,
          present: stat.presentCount,
          pct: stat.totalCount > 0 ? Math.round((stat.presentCount / stat.totalCount) * 100) : 0
        };
      });

      const atRisk = [];
      for (const s of students) {
        const fee = feesList.find(f => String(f.student) === String(s._id));
        const progress = progressList.find(p => String(p.student) === String(s._id));

        const att = attendanceMap[s._id.toString()] || { total: 0, present: 0, pct: 0 };
        s.attendancePct = att.pct;

        const dueAmount = fee ? Math.max(0, fee.totalAmount - (fee.discount || 0) - fee.paidAmount) : 0;
        const isFeeOverdue = fee && dueAmount > 0 && fee.dueDate && new Date(fee.dueDate) < now;

        const ungradedSubmissionsCount = allAssignments.reduce((count, a) => {
          const sub = a.submissions.find(sub => String(sub.student) === String(s._id) && sub.status !== 'graded');
          return count + (sub ? 1 : 0);
        }, 0);

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
    }

    // ─── TAB: STAFF ─────────────────────────────────────────────────
    else if (tab === 'staff') {
      const teachers = await User.find({ role: 'teacher', isActive: true });
      for (const t of teachers) {
        const [
          completedClasses,
          assignmentsCreated,
          assignmentsList,
          attendanceSessions,
          curriculums
        ] = await Promise.all([
          Schedule.countDocuments({ teacher: t._id, status: 'completed', date: { $gte: startDate, $lte: endDate } }),
          Assignment.countDocuments({ teacher: t._id, createdAt: { $gte: startOfPeriod, $lte: endOfPeriod } }),
          Assignment.find({ teacher: t._id }),
          Attendance.aggregate([
            { $match: { teacher: t._id, date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: { date: '$date', batch: '$batch', subject: '$subject' } } }
          ]),
          Curriculum.find({ teacher: t._id })
        ]);

        let gradedCount = 0;
        assignmentsList.forEach(a => {
          a.submissions.forEach(sub => {
            if (sub.status === 'graded') {
              gradedCount++;
            }
          });
        });

        let totalPct = 0;
        curriculums.forEach(c => {
          totalPct += c.completionPct || 0;
        });
        const curriculumCompletion = curriculums.length > 0 ? Math.round(totalPct / curriculums.length) : 0;

        renderData.teacherLoad.push({
          teacher: t,
          classesConducted: completedClasses, // Classes Taught
          assignmentsCreated, // Assignments Created
          submissionsGraded: gradedCount, // Submissions Graded
          attendanceSessionsMarked: attendanceSessions.length, // Attendance Sessions
          curriculumCompletion // Curriculum Completion %
        });
      }
    }

    // ─── RUN EXPORT ACTION ──────────────────────────────────────────
    if (exportType === 'csv') {
      const csvStr = convertToCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report_${tab}_${new Date().toISOString().slice(0, 10)}.csv`);
      return res.status(200).send(csvStr);
    }

    // Render EJS
    res.render(templateName, renderData);
  } catch (err) {
    logger.error('getReports Error', { err: err.message, stack: err.stack });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

// POST /admin/reports/financial/target
exports.postSetRevenueTarget = async (req, res) => {
  const { month, amount } = req.body;
  try {
    await RevenueTarget.findOneAndUpdate(
      { month },
      { amount: Number(amount) },
      { upsert: true, new: true }
    );
    logger.info('Revenue target set successfully', { month, amount: Number(amount) });
    res.redirect('/admin/reports?tab=financial&target_saved=1');
  } catch (err) {
    logger.error('postSetRevenueTarget Error', { err: err.message });
    res.redirect('/admin/reports?tab=financial&error=1');
  }
};

// POST /admin/reports/financial/expense
exports.postAddExpense = async (req, res) => {
  const { month, category, amount, description } = req.body;
  try {
    await Expense.create({
      month,
      category,
      amount: Number(amount),
      description: description || ''
    });
    logger.info('Expense created successfully', { month, category, amount: Number(amount) });
    res.redirect('/admin/reports?tab=financial&expense_saved=1');
  } catch (err) {
    logger.error('postAddExpense Error', { err: err.message });
    res.redirect('/admin/reports?tab=financial&error=1');
  }
};

// POST /admin/reports/financial/expense/:id/delete
exports.postDeleteExpense = async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    logger.info('Expense deleted successfully', { expenseId: req.params.id });
    res.redirect('/admin/reports?tab=financial&expense_deleted=1');
  } catch (err) {
    logger.error('postDeleteExpense Error', { err: err.message });
    res.redirect('/admin/reports?tab=financial&error=1');
  }
};
