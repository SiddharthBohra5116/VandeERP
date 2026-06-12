const Student = require('../../models/Student');

const logger = require('../../utils/logger');


// GET /admin/students/:id/certificate
exports.getStudentCertificate = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('userId', 'name email phone status')
      .populate('course', 'name code')
      .populate('batch', 'name');

    if (!student || !student.userId || student.userId.status !== 'complete') {
      return res.redirect(
        `/admin/students/${req.params.id || ''}?error=Certificate+not+generated+yet`
      );
    }

    const completeEntry = student.statusHistory?.find(
      history => history.status === 'complete'
    );

    const completionDate =
      completeEntry?.date ||
      student.updatedAt ||
      new Date();

    const studentObj = student.toObject();
    studentObj.name = student.userId?.name || '';
    studentObj.course = student.course?.name || '';
    studentObj.batch = student.batch?.name || '';

    res.render('admin/certificate', {
      title: `${studentObj.name} — Graduation Certificate`,
      layout: false,
      student: studentObj,
      completionDate
    });

  } catch (err) {
    logger.error('Get Student Certificate Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user
    });
  }
};