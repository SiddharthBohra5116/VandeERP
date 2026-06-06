const Timetable = require('../models/Timetable');
const Schedule = require('../models/Schedule');
const Holiday = require('../models/Holiday');
const { todayIST, formatDateLocal } = require('./dateHelper');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function propagateTimetable(timetableId) {
  const timetable = await Timetable.findById(timetableId);
  if (!timetable) return [];

  const todayStr = todayIST();

  // 1. Delete future scheduled sessions for this batch (status: 'scheduled' and date >= today)
  await Schedule.deleteMany({
    batch: timetable.batch,
    status: 'scheduled',
    date: { $gte: todayStr }
  });

  // 2. Fetch all holidays
  const holidays = await Holiday.find({});
  const holidaySet = new Set(holidays.map(h => h.date));

  // Determine starting point
  let current = new Date(timetable.startDate);
  const end = new Date(timetable.endDate);
  const today = new Date();
  today.setHours(0,0,0,0);

  // If startDate is in the past, only generate from today onwards to protect history
  if (current < today) {
    current = new Date(today);
  }

  const generatedSchedules = [];

  // 3. Loop through date range
  while (current <= end) {
    const dateStr = formatDateLocal(current);
    
    // Check if holiday
    if (!holidaySet.has(dateStr)) {
      const dayName = WEEKDAYS[current.getDay()];
      
      // Find matching slots for this day of week
      const daySlots = timetable.slots.filter(s => s.dayOfWeek === dayName);
      
      for (const slot of daySlots) {
        // Create the schedule
        const sched = new Schedule({
          subject: slot.subject,
          batch: timetable.batch,
          teacher: slot.teacher,
          classroom: slot.classroom,
          date: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'scheduled'
        });
        
        await sched.save();
        generatedSchedules.push(sched);
      }
    }
    
    current.setDate(current.getDate() + 1);
  }

  return generatedSchedules;
}

module.exports = {
  propagateTimetable
};
