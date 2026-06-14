const Timetable = require('../models/Timetable');
const Schedule = require('../models/Schedule');
const Holiday = require('../models/Holiday');

const { todayIST, formatDateLocal } = require('./dateHelper');

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

async function propagateTimetable(timetableId) {
  const timetable = await Timetable.findById(timetableId);

  if (!timetable) {
    return [];
  }

  const todayStr = todayIST();

  await Schedule.deleteMany({
    batch: timetable.batch,
    status: 'scheduled',
    date: { $gte: todayStr }
  });

  const holidays = await Holiday.find({});
  const holidaySet = new Set(holidays.map(holiday => holiday.date));

  let current = new Date(timetable.startDate);
  const end = new Date(timetable.endDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (current < today) {
    current = new Date(today);
  }

  const generatedSchedules = [];

  while (current <= end) {
    const dateStr = formatDateLocal(current);

    if (!holidaySet.has(dateStr)) {
      const dayName = WEEKDAYS[current.getDay()];

      const daySlots = timetable.slots.filter(
        slot => slot.dayOfWeek === dayName
      );

      for (const slot of daySlots) {
        generatedSchedules.push({
          course: timetable.course,
          batch: timetable.batch,
          teacher: slot.teacher,
          classroom: slot.classroom,
          date: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
          moduleId: slot.moduleId || null,
          topicId: slot.topicId || null,
          note: slot.note || '',
          status: 'scheduled'
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  if (generatedSchedules.length > 0) {
    return await Schedule.insertMany(generatedSchedules);
  }

  return [];
}

module.exports = {
  propagateTimetable
};