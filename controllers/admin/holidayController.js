const Holiday = require('../../models/Holiday');
const LeaveRequest = require('../../models/LeaveRequest');
const logger = require('../../utils/logger');

/**
 * GET /admin/holidays-leaves
 * Admin only. Retrieves all holidays and leave requests (populated with teacher profiles).
 */
exports.getHolidaysLeaves = async (req, res) => {
  try {
    const [holidays, leaves] = await Promise.all([
      Holiday.find({}).sort({ date: 1 }),
      LeaveRequest.find({}).populate('user', 'name email rollNumber phone').sort({ appliedAt: -1 })
    ]);

    const mappedLeaves = leaves.map(leave => {
      const obj = leave.toObject();
      obj.teacher = obj.user;
      return obj;
    });

    res.render('admin/holidays-leaves', {
      title: 'Holidays & Leaves Management',
      user: req.user,
      holidays,
      leaves: mappedLeaves
    });
  } catch (err) {
    logger.error('Get Holidays & Leaves Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * POST /admin/holidays/create
 * Admin only. Adds a new calendar holiday.
 */
exports.postAddHoliday = async (req, res) => {
  const { name, date } = req.body;
  try {
    await Holiday.create({ name, date });
    logger.info('Holiday added successfully', { name, date });
    res.redirect('/admin/holidays-leaves?saved=1');
  } catch (err) {
    logger.error('Add Holiday Error', { err: err.message });
    res.redirect('/admin/holidays-leaves?error=1');
  }
};

/**
 * POST /admin/holidays/:id/delete
 * Admin only. Deletes a calendar holiday.
 */
exports.postDeleteHoliday = async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    logger.info('Holiday deleted successfully', { holidayId: req.params.id });
    res.redirect('/admin/holidays-leaves?saved=1');
  } catch (err) {
    logger.error('Delete Holiday Error', { err: err.message });
    res.redirect('/admin/holidays-leaves?error=1');
  }
};

/**
 * POST /admin/leaves/:id/approve
 * Admin only. Approves a teacher leave request.
 */
exports.postApproveLeave = async (req, res) => {
  try {
    await LeaveRequest.findByIdAndUpdate(req.params.id, { status: 'approved' });
    logger.info('Teacher leave request approved', { leaveId: req.params.id });
    res.redirect('/admin/holidays-leaves?saved=1');
  } catch (err) {
    logger.error('Approve Leave Error', { err: err.message });
    res.redirect('/admin/holidays-leaves?error=1');
  }
};

/**
 * POST /admin/leaves/:id/reject
 * Admin only. Rejects a teacher leave request.
 */
exports.postRejectLeave = async (req, res) => {
  try {
    await LeaveRequest.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    logger.info('Teacher leave request rejected', { leaveId: req.params.id });
    res.redirect('/admin/holidays-leaves?saved=1');
  } catch (err) {
    logger.error('Reject Leave Error', { err: err.message });
    res.redirect('/admin/holidays-leaves?error=1');
  }
};
