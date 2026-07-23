const User = require('../../models/User');
const Student = require('../../models/Student');

const logger = require('../../utils/logger');


// GET /admin/profile-requests
exports.getProfileRequests = async (req, res) => {
  try {
    const students = await Student.find({
      'pendingProfileUpdate.requestedAt': { $ne: null }
    })
      .populate('user', 'name email phone profilePic status')
      .sort({ 'pendingProfileUpdate.requestedAt': -1 });

    res.render('admin/profile-requests', {
      title: 'Profile Update Requests',
      user: req.user,
      students,
      page: 'profile-requests'
    });

  } catch (err) {
    logger.error('Get Profile Requests Error', {
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


// POST /admin/students/:id/approve-profile
exports.postApproveProfileUpdate = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('user');

    if (!student || !student.user) {
      return res.redirect('/admin/students');
    }

    const pending = student.pendingProfileUpdate;

    if (pending && pending.requestedAt) {
      if (pending.name !== null && pending.name !== undefined) {
        student.user.name = pending.name;
      }

      if (pending.phone !== null && pending.phone !== undefined) {
        student.user.phone = pending.phone;
      }

      if (pending.address !== null && pending.address !== undefined) {
        student.user.address = pending.address;
      }

      if (pending.city !== null && pending.city !== undefined) {
        student.user.city = pending.city;
      }

      if (pending.dob !== null && pending.dob !== undefined) {
        student.user.dob = pending.dob;
      }

      if (pending.fatherName !== null && pending.fatherName !== undefined) {
        if (!student.family.father) student.family.father = {};
        student.family.father.name = pending.fatherName;
      }

      if (pending.fatherPhone !== null && pending.fatherPhone !== undefined) {
        if (!student.family.father) student.family.father = {};
        student.family.father.phone = pending.fatherPhone;
      }

      if (pending.motherName !== null && pending.motherName !== undefined) {
        if (!student.family.mother) student.family.mother = {};
        student.family.mother.name = pending.motherName;
      }

      if (pending.motherPhone !== null && pending.motherPhone !== undefined) {
        if (!student.family.mother) student.family.mother = {};
        student.family.mother.phone = pending.motherPhone;
      }

      if (pending.guardianName !== null && pending.guardianName !== undefined) {
        if (!student.family.guardian) student.family.guardian = {};
        student.family.guardian.name = pending.guardianName;
      }

      if (pending.guardianRelation !== null && pending.guardianRelation !== undefined) {
        if (!student.family.guardian) student.family.guardian = {};
        student.family.guardian.relation = pending.guardianRelation;
      }

      if (pending.guardianPhone !== null && pending.guardianPhone !== undefined) {
        if (!student.family.guardian) student.family.guardian = {};
        student.family.guardian.phone = pending.guardianPhone;
      }

      student.pendingProfileUpdate = {
        name: null,
        phone: null,
        profilePic: null,
        fatherName: null,
        fatherPhone: null,
        motherName: null,
        motherPhone: null,
        guardianName: null,
        guardianRelation: null,
        guardianPhone: null,
        address: null,
        city: null,
        dob: null,
        requestedAt: null
      };

      await student.user.save();
      await student.save();

      logger.info('Student profile update request approved', {
        studentId: student._id
      });
    }

    res.redirect(
      req.body.redirect ||
      `/admin/students/${student._id}?profile_approved=1`
    );

  } catch (err) {
    logger.error('Approve Profile Update Error', {
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


// POST /admin/students/:id/reject-profile
exports.postRejectProfileUpdate = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.redirect('/admin/students');
    }

    student.pendingProfileUpdate = {
      name: null,
      phone: null,
      profilePic: null,
      fatherName: null,
      fatherPhone: null,
      motherName: null,
      motherPhone: null,
      guardianName: null,
      guardianRelation: null,
      guardianPhone: null,
      address: null,
      city: null,
      dob: null,
      requestedAt: null
    };

    await student.save();

    logger.info('Student profile update request rejected', {
      studentId: student._id
    });

    res.redirect(
      req.body.redirect ||
      `/admin/students/${student._id}?profile_rejected=1`
    );

  } catch (err) {
    logger.error('Reject Profile Update Error', {
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
