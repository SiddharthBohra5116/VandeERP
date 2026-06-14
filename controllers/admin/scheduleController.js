const User = require('../../models/User');
const Student = require('../../models/Student');
const Course = require('../../models/Course');
const Batch = require('../../models/Batch');
const Schedule = require('../../models/Schedule');
const Classroom = require('../../models/Classroom');
const Timetable = require('../../models/Timetable');
const Message = require('../../models/Message');

const { todayIST, formatMonthLocal } = require('../../utils/dateHelper');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');

async function notifyBatchStudents({ adminId, batchId, teacherId, content }) {
  const students = await Student.find({ batch: batchId })
    .populate('userId', '_id status');

  const notifications = [];

  if (teacherId) {
    notifications.push(Message.create({
      sender: adminId,
      recipient: teacherId,
      content
    }));
  }

  students.forEach(student => {
    if (student.userId && student.userId.status === 'active') {
      notifications.push(Message.create({
        sender: adminId,
        recipient: student.userId._id,
        content
      }));
    }
  });

  await Promise.all(notifications);
}


// GET /admin/schedules
exports.getSchedules = async (req, res) => {
  try {
    const { batch, teacherId, status, search } = req.query;

    const monthParam = req.query.month || todayIST().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    const daysInMonth = endOfMonth.getDate();

    let startDayOfWeek = startOfMonth.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

    const prevMonthStr = formatMonthLocal(new Date(year, month - 2, 1));
    const nextMonthStr = formatMonthLocal(new Date(year, month, 1));

    const currentMonthLabel = startOfMonth.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });

    const dayParam = req.query.day || todayIST();

    const [classrooms, teachers, batches] = await Promise.all([
      Classroom.find({ isActive: true }).sort({ name: 1 }),

      User.find({
        role: 'teacher',
        status: 'active'
      }).sort({ name: 1 }),

      Batch.find({ isActive: true })
        .populate('course', 'name code')
        .sort({ name: 1 })
    ]);

    const filter = {};

    if (batch) filter.batch = batch;
    if (teacherId) filter.teacher = teacherId;
    if (status) filter.status = status;

    if (search) {
      const matchedBatches = await Batch.find({
        name: {
          $regex: escapeRegex(search),
          $options: 'i'
        }
      }).select('_id');

      filter.batch = {
        $in: matchedBatches.map(b => b._id)
      };
    }

    const monthSchedules = await Schedule.find({
      ...filter,
      date: {
        $gte: startDateStr,
        $lte: endDateStr
      }
    })
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
      .populate('classroom', 'name')
      .sort({ startTime: 1 });

    const daySchedules = await Schedule.find({
      date: dayParam,
      status: { $ne: 'cancelled' }
    })
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
      .populate('classroom', 'name');

    const allSchedules = await Schedule.find(filter)
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
      .populate('classroom', 'name')
      .sort({ date: -1, startTime: 1 });

    const monthSchedulesGrouped = {};

    for (let day = 1; day <= daysInMonth; day++) {
      monthSchedulesGrouped[day] = [];
    }

    monthSchedules.forEach(schedule => {
      const dayNum = parseInt(schedule.date.split('-')[2], 10);

      if (monthSchedulesGrouped[dayNum]) {
        monthSchedulesGrouped[dayNum].push(schedule);
      }
    });

    const timelineClassroomData = {};

    classrooms.forEach(classroom => {
      timelineClassroomData[classroom._id.toString()] = [];
    });

    daySchedules.forEach(schedule => {
      if (schedule.classroom) {
        const classroomId = schedule.classroom._id.toString();

        if (timelineClassroomData[classroomId]) {
          timelineClassroomData[classroomId].push(schedule);
        }
      }
    });

    const { parseTimeToMinutes } = require('../../utils/clashDetector');

    Object.keys(timelineClassroomData).forEach(classroomId => {
      timelineClassroomData[classroomId].sort(
        (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
      );
    });

    const timetables = await Timetable.find({})
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate({ path: 'slots.teacher', populate: { path: 'user', select: 'name' } })
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
    logger.error('Get Schedules Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};


// GET /admin/schedules/create
exports.getCreateSchedule = async (req, res) => {
  try {
    const [teachers, courses, batches, classrooms] = await Promise.all([
      User.find({
        role: 'teacher',
        status: 'active'
      }).sort({ name: 1 }),

      Course.find({
        isActive: true
      }).sort({ name: 1 }),

      Batch.find({
        isActive: true
      })
        .populate('course', 'name code')
        .sort({ name: 1 }),

      Classroom.find({
        isActive: true
      }).sort({ name: 1 })
    ]);

    res.render('admin/schedule-form', {
      title: 'Add Class Schedule',
      user: req.user,
      teachers,
      courses,
      batches,
      classrooms,
      target: null,
      error: null,
      page: 'schedules'
    });

  } catch (err) {
    logger.error('Get Create Schedule Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};


// POST /admin/schedules/create
exports.postCreateSchedule = async (req, res) => {
  try {
    const {
      course,
      batch,
      teacher,
      classroom,
      date,
      startTime,
      endTime,
      status,
      subject,
      note
    } = req.body;

    const { checkScheduleClash } = require('../../utils/clashDetector');

    const clash = await checkScheduleClash(
      date,
      startTime,
      endTime,
      classroom,
      teacher
    );

    if (clash.clashed) {
      return res.redirect(
        `/admin/schedules?error=${encodeURIComponent(clash.reason)}&openCreate=1`
      );
    }

    const schedule = await Schedule.create({
      course,
      batch,
      teacher,
      classroom,
      date,
      startTime,
      endTime,
      subject: subject || '',
      note: note || '',
      status: status || 'scheduled'
    });

    const [batchObj, courseObj, classroomObj] = await Promise.all([
      Batch.findById(batch),
      Course.findById(course),
      Classroom.findById(classroom)
    ]);

    const dateStrFormatted = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      weekday: 'short'
    });

    const notificationContent =
      `🔔 Class Scheduled: New session for Batch "${batchObj?.name || 'Batch'}" ` +
      `(${courseObj?.name || 'Course'}) is scheduled on ${dateStrFormatted} ` +
      `at ${startTime} - ${endTime} in ${classroomObj?.name || 'Classroom'}.`;

    await notifyBatchStudents({
      adminId: req.user._id,
      batchId: batch,
      teacherId: teacher,
      content: notificationContent
    });

    logger.info('Schedule created successfully', {
      scheduleId: schedule._id,
      batch,
      date
    });

    res.redirect('/admin/schedules?created=1');

  } catch (err) {
    logger.error('Create Schedule Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect('/admin/schedules/create?error=1');
  }
};


// GET /admin/schedules/:id/edit
exports.getEditSchedule = async (req, res) => {
  try {
    const [schedule, teachers, courses, batches, classrooms] = await Promise.all([
      Schedule.findById(req.params.id)
        .populate('course', 'name code')
        .populate('batch', 'name'),

      User.find({
        role: 'teacher',
        status: 'active'
      }).sort({ name: 1 }),

      Course.find({
        isActive: true
      }).sort({ name: 1 }),

      Batch.find({
        isActive: true
      })
        .populate('course', 'name code')
        .sort({ name: 1 }),

      Classroom.find({
        isActive: true
      }).sort({ name: 1 })
    ]);

    if (!schedule) {
      return res.redirect('/admin/schedules');
    }

    res.render('admin/schedule-form', {
      title: 'Edit Class Schedule',
      user: req.user,
      teachers,
      courses,
      batches,
      classrooms,
      target: schedule,
      error: null,
      page: 'schedules'
    });

  } catch (err) {
    logger.error('Get Edit Schedule Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};


// POST /admin/schedules/:id/edit
exports.postEditSchedule = async (req, res) => {
  try {
    const {
      course,
      batch,
      teacher,
      classroom,
      date,
      startTime,
      endTime,
      status,
      subject,
      note
    } = req.body;

    const { checkScheduleClash } = require('../../utils/clashDetector');

    const clash = await checkScheduleClash(
      date,
      startTime,
      endTime,
      classroom,
      teacher,
      req.params.id
    );

    if (clash.clashed) {
      return res.redirect(
        `/admin/schedules?error=${encodeURIComponent(clash.reason)}&openEdit=${req.params.id}`
      );
    }

    await Schedule.findByIdAndUpdate(req.params.id, {
      course,
      batch,
      teacher,
      classroom,
      date,
      startTime,
      endTime,
      subject: subject || '',
      note: note || '',
      status
    });

    const [batchObj, courseObj, classroomObj] = await Promise.all([
      Batch.findById(batch),
      Course.findById(course),
      Classroom.findById(classroom)
    ]);

    const dateStrFormatted = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      weekday: 'short'
    });

    const notificationContent =
      `🔔 Class Rescheduled: Class for Batch "${batchObj?.name || 'Batch'}" ` +
      `(${courseObj?.name || 'Course'}) on ${dateStrFormatted} has been rescheduled ` +
      `to ${startTime} - ${endTime} in ${classroomObj?.name || 'Classroom'}.`;

    await notifyBatchStudents({
      adminId: req.user._id,
      batchId: batch,
      teacherId: teacher,
      content: notificationContent
    });

    logger.info('Schedule updated successfully', {
      scheduleId: req.params.id,
      status
    });

    res.redirect('/admin/schedules?updated=1');

  } catch (err) {
    logger.error('Edit Schedule Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(`/admin/schedules/${req.params.id}/edit?error=1`);
  }
};


// POST /admin/schedules/:id/delete
exports.postDeleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('course', 'name')
      .populate('batch', 'name')
      .populate('classroom', 'name');

    if (schedule) {
      const dateStrFormatted = new Date(schedule.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
      });

      const notificationContent =
        `🔔 Class Cancelled: Class for Batch "${schedule.batch?.name || 'Batch'}" ` +
        `(${schedule.course?.name || 'Course'}) on ${dateStrFormatted} at ${schedule.startTime} ` +
        `in ${schedule.classroom?.name || 'Classroom'} has been cancelled.`;

      await notifyBatchStudents({
        adminId: req.user._id,
        batchId: schedule.batch?._id,
        teacherId: schedule.teacher,
        content: notificationContent
      });

      await Schedule.findByIdAndDelete(req.params.id);
    }

    logger.info('Schedule deleted successfully', {
      scheduleId: req.params.id
    });

    res.redirect('/admin/schedules?deleted=1');

  } catch (err) {
    logger.error('Delete Schedule Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect('/admin/schedules?error=1');
  }
};


// POST /admin/timetables
exports.postSaveTimetable = async (req, res) => {
  try {
    const {
      course,
      batch,
      startDate,
      endDate,
      dayOfWeek,
      teacher,
      classroom,
      startTime,
      endTime
    } = req.body;

    const slots = [];

    if (dayOfWeek) {
      const days = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek];
      const teachers = Array.isArray(teacher) ? teacher : [teacher];
      const classrooms = Array.isArray(classroom) ? classroom : [classroom];
      const starts = Array.isArray(startTime) ? startTime : [startTime];
      const ends = Array.isArray(endTime) ? endTime : [endTime];

      for (let i = 0; i < days.length; i++) {
        if (days[i] && teachers[i] && classrooms[i] && starts[i] && ends[i]) {
          slots.push({
            dayOfWeek: days[i],
            teacher: teachers[i],
            classroom: classrooms[i],
            startTime: starts[i],
            endTime: ends[i]
          });
        }
      }
    }

    let timetable = await Timetable.findOne({ batch });

    if (!timetable) {
      timetable = new Timetable({
        course,
        batch,
        startDate,
        endDate,
        slots
      });
    } else {
      timetable.course = course;
      timetable.startDate = startDate;
      timetable.endDate = endDate;
      timetable.slots = slots;
    }

    await timetable.save();

    const { propagateTimetable } = require('../../utils/timetableGenerator');
    await propagateTimetable(timetable._id);

    logger.info('Timetable saved and propagated successfully', {
      batch,
      course
    });

    res.redirect('/admin/schedules?tab=templates&success=1');

  } catch (err) {
    logger.error('Save Timetable Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(
      `/admin/schedules?tab=templates&error=${encodeURIComponent(err.message)}`
    );
  }
};


// POST /admin/timetables/:id/delete
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

      logger.info('Deleted timetable and future schedules', {
        batch: timetable.batch
      });
    }

    res.redirect('/admin/schedules?tab=templates&deleted=1');

  } catch (err) {
    logger.error('Delete Timetable Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect('/admin/schedules?tab=templates&error=1');
  }
};


// POST /admin/classrooms/create
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
    logger.error('Create Classroom Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect('/admin/schedules?tab=classrooms&error=1');
  }
};


// POST /admin/classrooms/:id/edit
exports.postEditClassroom = async (req, res) => {
  try {
    const { name, capacity, location, isActive } = req.body;

    await Classroom.findByIdAndUpdate(req.params.id, {
      name,
      capacity: capacity ? parseInt(capacity, 10) : 0,
      location,
      isActive: isActive === 'on' || isActive === true
    });

    logger.info('Classroom updated successfully', {
      classroomId: req.params.id
    });

    res.redirect('/admin/schedules?tab=classrooms&updated=1');

  } catch (err) {
    logger.error('Edit Classroom Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect('/admin/schedules?tab=classrooms&error=1');
  }
};


// POST /admin/classrooms/:id/delete
exports.postDeleteClassroom = async (req, res) => {
  try {
    const usedCount = await Schedule.countDocuments({
      classroom: req.params.id
    });

    if (usedCount > 0) {
      await Classroom.findByIdAndUpdate(req.params.id, {
        isActive: false
      });

      return res.redirect('/admin/schedules?tab=classrooms&archived=1');
    }

    await Classroom.findByIdAndDelete(req.params.id);

    logger.info('Classroom deleted successfully', {
      classroomId: req.params.id
    });

    res.redirect('/admin/schedules?tab=classrooms&deleted=1');

  } catch (err) {
    logger.error('Delete Classroom Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect('/admin/schedules?tab=classrooms&error=1');
  }
};