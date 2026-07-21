'use strict';

function calculateCourseProgress(student, attendance, futureSchedules = []) {
  const target = Number(student.requiredClassesOverride || student.course?.requiredClasses || 0);
  const attended = attendance.filter(item => ['present', 'late'].includes(item.status)).length;
  const remaining = target ? Math.max(0, target - attended) : 0;
  const dates = [...new Set(futureSchedules.map(item => item.date))].sort();
  return {
    target,
    attended,
    remaining,
    complete: target > 0 && attended >= target,
    estimatedCompletionDate: remaining > 0 && dates.length >= remaining ? dates[remaining - 1] : null,
    additionalSchedulesNeeded: Math.max(0, remaining - dates.length)
  };
}

module.exports = calculateCourseProgress;
