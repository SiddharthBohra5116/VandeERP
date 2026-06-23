const Schedule = require('../models/Schedule');

/**
 * Parses a time string (supports "10:30 AM", "03:00 PM", or 24-hour "10:30", "15:00") into minutes since midnight.
 * @param {string} timeStr 
 * @returns {number} minutes past midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  timeStr = timeStr.trim().toUpperCase();
  let hours = 0;
  let minutes = 0;
  
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    const matches = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/);
    if (matches) {
      hours = parseInt(matches[1], 10);
      minutes = parseInt(matches[2], 10);
      const ampm = matches[3];
      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      }
      if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
    }
  } else {
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    }
  }
  return hours * 60 + minutes;
}

/**
 * Checks if the proposed schedule conflicts with existing classroom bookings or teacher assignments.
 * @param {string} date - YYYY-MM-DD
 * @param {string} startTime - Proposed start time
 * @param {string} endTime - Proposed end time
 * @param {string} classroomId - Target classroom ID
 * @param {string} teacherId - Target teacher ID
 * @param {string} [excludeScheduleId] - Option to exclude a specific schedule (for updates)
 * @returns {Promise<{clashed: boolean, type?: string, reason?: string}>}
 */
async function checkScheduleClash(date, startTime, endTime, classroomId, teacherId, excludeScheduleId = null, batchId = null) {
  const newStart = parseTimeToMinutes(startTime);
  const newEnd = parseTimeToMinutes(endTime);

  if (newStart >= newEnd) {
    return { clashed: true, type: 'invalid', reason: 'Start time must be before end time.' };
  }

  // Build query
  const query = {
    date,
    status: { $ne: 'cancelled' }
  };
  if (excludeScheduleId) {
    query._id = { $ne: excludeScheduleId };
  }

  const existingSchedules = await Schedule.find(query)
    .populate('teacher', 'name')
    .populate('classroom', 'name')
    .populate('batch', 'name');

  for (const sched of existingSchedules) {
    const extStart = parseTimeToMinutes(sched.startTime);
    const extEnd = parseTimeToMinutes(sched.endTime);

    // Overlap condition: S1 < E2 AND S2 < E1
    if (newStart < extEnd && extStart < newEnd) {
      if (batchId && sched.batch && sched.batch._id.toString() === batchId.toString()) {
        return {
          clashed: true,
          type: 'batch',
          reason: `Batch Clash: "${sched.batch.name}" already has a class from ${sched.startTime} to ${sched.endTime}.`
        };
      }

      // 1. Classroom Clash
      if (sched.classroom && sched.classroom._id.toString() === classroomId.toString()) {
        return {
          clashed: true,
          type: 'classroom',
          reason: `Classroom Clash: "${sched.classroom.name}" is already occupied from ${sched.startTime} to ${sched.endTime}.`
        };
      }

      // 2. Teacher Clash
      if (sched.teacher && sched.teacher._id.toString() === teacherId.toString()) {
        return {
          clashed: true,
          type: 'teacher',
         reason: `Teacher Clash: Instructor "${sched.teacher.name}" is already assigned from ${sched.startTime} to ${sched.endTime}.`
        };
      }
    }
  }

  return { clashed: false };
}

module.exports = {
  parseTimeToMinutes,
  checkScheduleClash
};
