const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');

/**
 * Filters out attendance records that fall on holidays or during approved teacher leaves.
 * @param {Array} records - Array of Attendance Mongoose documents or objects.
 * @returns {Promise<Array>} - The filtered array of attendance records.
 */
async function filterValidAttendance(records) {
  if (!records || records.length === 0) return [];

  // Fetch all holidays
  const holidays = await Holiday.find({});
  const holidayDates = new Set(holidays.map(h => h.date));

  // Fetch all approved leaves
  const approvedLeaves = await LeaveRequest.find({ status: 'approved' });

  // Fetch teacher profiles to map profile ID to user ID
  const Teacher = require('../models/Teacher');
  const teacherProfiles = await Teacher.find({});
  const teacherProfileToUserMap = {};
  teacherProfiles.forEach(t => {
    if (t.user) {
      teacherProfileToUserMap[t._id.toString()] = t.user.toString();
    }
  });

  return records.filter(rec => {
    // 1. Exclude if date is a holiday
    if (holidayDates.has(rec.date)) {
      return false;
    }

    // 2. Exclude if the teacher was on approved leave on that date
    if (rec.teacher) {
      const teacherProfileId = rec.teacher._id ? rec.teacher._id.toString() : rec.teacher.toString();
      const teacherUserId = teacherProfileToUserMap[teacherProfileId] || teacherProfileId;
      const recDateStr = rec.date; // YYYY-MM-DD
      
      const onLeave = approvedLeaves.some(leave => {
        const leaveTeacherId = leave.user ? leave.user.toString() : '';
        if (leaveTeacherId !== teacherUserId) return false;
        
        return recDateStr >= leave.startDate && recDateStr <= leave.endDate;
      });

      if (onLeave) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculates attendance percentage and other stats for students.
 * @param {Array} students - Array of student User/Student objects/documents.
 * @param {Array} allAttendanceRecords - All attendance records for these students.
 * @param {Array} todayRecords - Attendance records marked today.
 */
async function calculateStudentsAttendance(students, allAttendanceRecords, todayRecords = []) {
  const validRecords = await filterValidAttendance(allAttendanceRecords);
  const getStudentKey = student => {
    const id = student?.studentId || student?.studentProfileId || student?._id || '';
    return id ? id.toString() : '';
  };
  
  const studentMap = {};
  students.forEach(u => {
    const id = getStudentKey(u);
    if (id) {
      studentMap[id] = { total: 0, present: 0, absent: 0, late: 0, lastAbsenceDate: null };
    }
  });

  // Sort valid records chronologically to find the last absence date
  const sortedRecords = [...validRecords].sort((a, b) => a.date.localeCompare(b.date));

  sortedRecords.forEach(rec => {
    const sId = rec.student && rec.student._id ? rec.student._id.toString() : (rec.student ? rec.student.toString() : '');
    if (studentMap[sId]) {
      studentMap[sId].total++;
      if (rec.status === 'present') {
        studentMap[sId].present++;
      } else if (rec.status === 'late') {
        studentMap[sId].present++; // Late counts as present for percentage
        studentMap[sId].late++;
      } else if (rec.status === 'absent') {
        studentMap[sId].absent++;
        studentMap[sId].lastAbsenceDate = rec.date;
      }
    }
  });

  const markedTodaySet = new Set((todayRecords || []).map(r => r.student && r.student._id ? r.student._id.toString() : (r.student ? r.student.toString() : '')));

  students.forEach(u => {
    const id = getStudentKey(u);
    const stats = studentMap[id] || { total: 0, present: 0, absent: 0, late: 0, lastAbsenceDate: null };
    u.attendancePct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 100;
    u.isMarkedToday = markedTodaySet.has(id);
    const todayRecord = (todayRecords || []).find(r => {
      const recordStudentId = r.student && r.student._id ? r.student._id.toString() : (r.student ? r.student.toString() : '');
      return recordStudentId === id;
    });
    u.todayAttendanceStatus = todayRecord ? todayRecord.status : '';
    u.attendanceStats = stats;
  });

  return students;
}

module.exports = {
  filterValidAttendance,
  calculateStudentsAttendance
};
