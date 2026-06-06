const User = require('../../models/User');
const Schedule = require('../../models/Schedule');
const Classroom = require('../../models/Classroom');
const Timetable = require('../../models/Timetable');
const Message = require('../../models/Message');
const { todayIST, formatMonthLocal } = require('../../utils/dateHelper');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');

/**
 * GET /admin/schedules
 * Admin only. Retrieves and compiles calendar schedules (monthly calendar, classroom timeline, resource tree).
 */
exports.getSchedules = async (req, res) => {
  try {
    const { batch, teacherId, status, search } = req.query;
    
    // 1. Month calculation for Calendar Grid
    const monthParam = req.query.month || todayIST().slice(0, 7); // e.g. "2026-06"
    const [year, month] = monthParam.split('-').map(Number);
    
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0); 
    const daysInMonth = endOfMonth.getDate();
    
    let startDayOfWeek = startOfMonth.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; 

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

    const prevMonthDate = new Date(year, month - 2, 1);
    const nextMonthDate = new Date(year, month, 1);
    const prevMonthStr = formatMonthLocal(prevMonthDate);
    const nextMonthStr = formatMonthLocal(nextMonthDate);
    const currentMonthLabel = startOfMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // 2. Day calculation for Classroom Timeline
    const dayParam = req.query.day || todayIST(); 
    
    const [classrooms, teachers, batches] = await Promise.all([
      Classroom.find({ isActive: true }).sort({ name: 1 }),
      User.find({ role: 'teacher', isActive: true }).sort({ name: 1 }),
      User.distinct('batch', { role: 'student', isActive: true })
    ]);

    const filter = {};
    if (batch) filter.batch = batch;
    if (teacherId) filter.teacher = teacherId;
    if (status) filter.status = status;
    if (search) {
      filter.subject = { $regex: escapeRegex(search), $options: 'i' };
    }

    const monthSchedules = await Schedule.find({
      ...filter,
      date: { $gte: startDateStr, $lte: endDateStr }
    }).populate('teacher', 'name').populate('classroom', 'name').sort({ startTime: 1 });

    const daySchedules = await Schedule.find({
      date: dayParam,
      status: { $ne: 'cancelled' }
    }).populate('teacher', 'name').populate('classroom', 'name');

    const allSchedules = await Schedule.find(filter)
      .populate('teacher', 'name')
      .populate('classroom', 'name')
      .sort({ date: -1, startTime: 1 });

    const monthSchedulesGrouped = {};
    for (let d = 1; d <= daysInMonth; d++) {
      monthSchedulesGrouped[d] = [];
    }
    monthSchedules.forEach(s => {
      const dayNum = parseInt(s.date.split('-')[2], 10);
      if (monthSchedulesGrouped[dayNum]) {
        monthSchedulesGrouped[dayNum].push(s);
      }
    });

    const timelineClassroomData = {};
    classrooms.forEach(cr => {
      timelineClassroomData[cr._id.toString()] = [];
    });
    daySchedules.forEach(s => {
      if (s.classroom) {
        const rId = s.classroom._id.toString();
        if (timelineClassroomData[rId]) {
          timelineClassroomData[rId].push(s);
        }
      }
    });

    const { parseTimeToMinutes } = require('../../utils/clashDetector');
    Object.keys(timelineClassroomData).forEach(rId => {
      timelineClassroomData[rId].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    });

    const timetables = await Timetable.find({})
      .populate('slots.teacher', 'name')
      .populate('slots.classroom', 'name');

    res.render('admin/schedules', {
      title: 'Class Schedules',
      user: req.user,
      schedules: allSchedules,
      teachers,
      batches,
      classrooms,
      monthParam,
      prevMonthStr,
      nextMonthStr,
      currentMonthLabel,
      dayParam,
      monthSchedulesGrouped,
      timelineClassroomData,
      daysInMonth,
      startDayOfWeek,
      timetables,
      filter: { batch, teacherId, status, search },
      page: 'schedules'
    });
  } catch (err) {
    logger.error('Get Schedules Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/schedules/create
 * Admin only. Renders the add schedule slot form.
 */
exports.getCreateSchedule = async (req, res) => {
  try {
    const [teachers, batches, classrooms] = await Promise.all([
      User.find({ role: 'teacher', isActive: true }).sort({ name: 1 }),
      User.distinct('batch', { role: 'student', isActive: true }),
      Classroom.find({ isActive: true }).sort({ name: 1 })
    ]);

    res.render('admin/schedule-form', {
      title: 'Add Class Schedule',
      user: req.user,
      teachers,
      batches,
      classrooms,
      target: null,
      error: null,
      page: 'schedules'
    });
  } catch (err) {
    logger.error('Get Create Schedule Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/schedules/create
 * Admin only. Saves a new schedule slot, checking for clashes and sending notifications to students and teachers.
 */
exports.postCreateSchedule = async (req, res) => {
  try {
    const { subject, batch, teacher, classroom, date, startTime, endTime, status } = req.body;
    
    // Clash check
    const { checkScheduleClash } = require('../../utils/clashDetector');
    const clash = await checkScheduleClash(date, startTime, endTime, classroom, teacher);
    if (clash.clashed) {
      return res.redirect(`/admin/schedules?error=${encodeURIComponent(clash.reason)}&openCreate=1&date=${date}&subject=${encodeURIComponent(subject)}&batch=${encodeURIComponent(batch)}&teacher=${teacher}&classroom=${classroom}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&status=${status}`);
    }

    await Schedule.create({
      subject,
      batch,
      teacher,
      classroom,
      date,
      startTime,
      endTime,
      status: status || 'scheduled'
    });

    const [teacherUser, students, classroomObj] = await Promise.all([
      User.findById(teacher),
      User.find({ role: 'student', batch, isActive: true }),
      Classroom.findById(classroom)
    ]);
    
    const dateStrFormatted = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
    const notificationContent = `🔔 Class Scheduled: New session for Batch "${batch}" (${subject}) is scheduled on ${dateStrFormatted} at ${startTime} - ${endTime} in ${classroomObj ? classroomObj.name : 'Classroom'}.`;

    const notifications = [];
    if (teacherUser) {
      notifications.push(Message.create({
        sender: req.user._id,
        recipient: teacherUser._id,
        content: notificationContent
      }));
    }
    students.forEach(stu => {
      notifications.push(Message.create({
        sender: req.user._id,
        recipient: stu._id,
        content: notificationContent
      }));
    });
    await Promise.all(notifications);

    logger.info('Schedule created successfully', { subject, batch, date });
    res.redirect('/admin/schedules?created=1');
  } catch (err) {
    logger.error('Create Schedule Error', { err: err.message });
    res.redirect('/admin/schedules/create?error=1');
  }
};

/**
 * GET /admin/schedules/:id/edit
 * Admin only. Renders schedule editor.
 */
exports.getEditSchedule = async (req, res) => {
  try {
    const [schedule, teachers, batches, classrooms] = await Promise.all([
      Schedule.findById(req.params.id),
      User.find({ role: 'teacher', isActive: true }).sort({ name: 1 }),
      User.distinct('batch', { role: 'student', isActive: true }),
      Classroom.find({ isActive: true }).sort({ name: 1 })
    ]);

    if (!schedule) {
      return res.redirect('/admin/schedules');
    }

    res.render('admin/schedule-form', {
      title: 'Edit Class Schedule',
      user: req.user,
      teachers,
      batches,
      classrooms,
      target: schedule,
      error: null,
      page: 'schedules'
    });
  } catch (err) {
    logger.error('Get Edit Schedule Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/schedules/:id/edit
 * Admin only. Modifies a schedule slot.
 */
exports.postEditSchedule = async (req, res) => {
  try {
    const { subject, batch, teacher, classroom, date, startTime, endTime, status } = req.body;
    
    // Clash check
    const { checkScheduleClash } = require('../../utils/clashDetector');
    const clash = await checkScheduleClash(date, startTime, endTime, classroom, teacher, req.params.id);
    if (clash.clashed) {
      return res.redirect(`/admin/schedules?error=${encodeURIComponent(clash.reason)}&openEdit=${req.params.id}`);
    }

    await Schedule.findByIdAndUpdate(req.params.id, {
      subject,
      batch,
      teacher,
      classroom,
      date,
      startTime,
      endTime,
      status
    });

    const [teacherUser, students, classroomObj] = await Promise.all([
      User.findById(teacher),
      User.find({ role: 'student', batch, isActive: true }),
      Classroom.findById(classroom)
    ]);
    
    const dateStrFormatted = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
    const notificationContent = `🔔 Class Rescheduled: Class for Batch "${batch}" (${subject}) on ${dateStrFormatted} has been rescheduled to ${startTime} - ${endTime} in ${classroomObj ? classroomObj.name : 'Classroom'}.`;

    const notifications = [];
    if (teacherUser) {
      notifications.push(Message.create({
        sender: req.user._id,
        recipient: teacherUser._id,
        content: notificationContent
      }));
    }
    students.forEach(stu => {
      notifications.push(Message.create({
        sender: req.user._id,
        recipient: stu._id,
        content: notificationContent
      }));
    });
    await Promise.all(notifications);

    logger.info('Schedule updated successfully', { scheduleId: req.params.id, status });
    res.redirect('/admin/schedules?updated=1');
  } catch (err) {
    logger.error('Edit Schedule Error', { err: err.message });
    res.redirect(`/admin/schedules/${req.params.id}/edit?error=1`);
  }
};

/**
 * POST /admin/schedules/:id/delete
 * Admin only. Deletes a schedule slot and notifies students/teachers.
 */
exports.postDeleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id).populate('classroom');
    if (schedule) {
      const dateStrFormatted = new Date(schedule.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
      const notificationContent = `🔔 Class Cancelled: Class for Batch "${schedule.batch}" (${schedule.subject}) on ${dateStrFormatted} at ${schedule.startTime} in ${schedule.classroom ? schedule.classroom.name : 'Classroom'} has been cancelled.`;

      const [teacherUser, students] = await Promise.all([
        User.findById(schedule.teacher),
        User.find({ role: 'student', batch: schedule.batch, isActive: true })
      ]);

      const notifications = [];
      if (teacherUser) {
        notifications.push(Message.create({
          sender: req.user._id,
          recipient: teacherUser._id,
          content: notificationContent
        }));
      }
      students.forEach(stu => {
        notifications.push(Message.create({
          sender: req.user._id,
          recipient: stu._id,
          content: notificationContent
        }));
      });
      await Promise.all(notifications);
      
      await Schedule.findByIdAndDelete(req.params.id);
    }
    logger.info('Schedule deleted successfully', { scheduleId: req.params.id });
    res.redirect('/admin/schedules?deleted=1');
  } catch (err) {
    logger.error('Delete Schedule Error', { err: err.message });
    res.redirect('/admin/schedules?error=1');
  }
};

/**
 * POST /admin/timetables
 * Admin only. Saves a weekly timetable template and runs propagation.
 */
exports.postSaveTimetable = async (req, res) => {
  try {
    const { batch, startDate, endDate, dayOfWeek, subject, teacher, classroom, startTime, endTime } = req.body;
    
    const slots = [];
    if (dayOfWeek) {
      const days = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek];
      const subs = Array.isArray(subject) ? subject : [subject];
      const tchs = Array.isArray(teacher) ? teacher : [teacher];
      const rms = Array.isArray(classroom) ? classroom : [classroom];
      const starts = Array.isArray(startTime) ? startTime : [startTime];
      const ends = Array.isArray(endTime) ? endTime : [endTime];

      for (let i = 0; i < days.length; i++) {
        if (days[i] && subs[i] && tchs[i] && rms[i] && starts[i] && ends[i]) {
          slots.push({
            dayOfWeek: days[i],
            subject: subs[i],
            teacher: tchs[i],
            classroom: rms[i],
            startTime: starts[i],
            endTime: ends[i]
          });
        }
      }
    }

    let timetable = await Timetable.findOne({ batch });
    if (!timetable) {
      timetable = new Timetable({
        batch,
        startDate,
        endDate,
        slots
      });
    } else {
      timetable.startDate = startDate;
      timetable.endDate = endDate;
      timetable.slots = slots;
    }

    await timetable.save();
    
    const { propagateTimetable } = require('../../utils/timetableGenerator');
    await propagateTimetable(timetable._id);

    logger.info('Timetable template saved & propagated successfully', { batch });
    res.redirect('/admin/schedules?tab=templates&success=1');
  } catch (err) {
    logger.error('Save Timetable Error', { err: err.message });
    res.redirect(`/admin/schedules?tab=templates&error=${encodeURIComponent(err.message)}`);
  }
};

/**
 * POST /admin/timetables/:id/delete
 * Admin only. Deletes a weekly timetable template and future scheduled slots.
 */
exports.postDeleteTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (timetable) {
      const todayStr = todayIST();
      await Schedule.deleteMany({
        batch: timetable.batch,
        status: 'scheduled',
        date: { $gte: todayStr }
      });
      await Timetable.findByIdAndDelete(req.params.id);
      logger.info('Deleted Timetable and cleaned up future schedules', { batch: timetable.batch });
    }
    res.redirect('/admin/schedules?tab=templates&deleted=1');
  } catch (err) {
    logger.error('Delete Timetable Error', { err: err.message });
    res.redirect('/admin/schedules?tab=templates&error=1');
  }
};

/**
 * POST /admin/classrooms/create
 * Admin only. Creates a new classroom.
 */
exports.postCreateClassroom = async (req, res) => {
  try {
    const { name, capacity, location, isActive } = req.body;
    await Classroom.create({
      name,
      capacity: capacity ? parseInt(capacity, 10) : 0,
      location,
      isActive: isActive === 'on' || isActive === true
    });
    logger.info('Classroom created successfully', { name });
    res.redirect('/admin/schedules?tab=classrooms&created=1');
  } catch (err) {
    logger.error('Create Classroom Error', { err: err.message });
    res.redirect('/admin/schedules?tab=classrooms&error=1');
  }
};

/**
 * POST /admin/classrooms/:id/edit
 * Admin only. Modifies a classroom.
 */
exports.postEditClassroom = async (req, res) => {
  try {
    const { name, capacity, location, isActive } = req.body;
    await Classroom.findByIdAndUpdate(req.params.id, {
      name,
      capacity: capacity ? parseInt(capacity, 10) : 0,
      location,
      isActive: isActive === 'on' || isActive === true
    });
    logger.info('Classroom updated successfully', { classroomId: req.params.id });
    res.redirect('/admin/schedules?tab=classrooms&updated=1');
  } catch (err) {
    logger.error('Edit Classroom Error', { err: err.message });
    res.redirect('/admin/schedules?tab=classrooms&error=1');
  }
};

/**
 * POST /admin/classrooms/:id/delete
 * Admin only. Deletes a classroom.
 */
exports.postDeleteClassroom = async (req, res) => {
  try {
    await Classroom.findByIdAndDelete(req.params.id);
    logger.info('Classroom deleted successfully', { classroomId: req.params.id });
    res.redirect('/admin/schedules?tab=classrooms&deleted=1');
  } catch (err) {
    logger.error('Delete Classroom Error', { err: err.message });
    res.redirect('/admin/schedules?tab=classrooms&error=1');
  }
};
