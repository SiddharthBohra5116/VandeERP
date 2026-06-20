const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const behaviorEngine = require('./security/behaviorEngine');

const protect = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    if (req.accepts('html')) return res.redirect('/auth/login');
    return res.status(401).json({ message: 'Not authorized' });
  }

  try {
    // No fallback secret — server.js already crashes at startup if JWT_SECRET is missing.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || (!req.user.isActive && req.user.status !== 'complete')) {
      if (req.accepts('html')) return res.redirect('/auth/login');
      return res.status(401).json({ message: 'Account inactive or not found' });
    }
    
    // If the logged-in user is a student, attach their Student profile fields to req.user
    if (req.user.role === 'student') {
      const Student = require('../models/Student');
      const studentProfile = await Student.findOne({ user: req.user._id });
      if (studentProfile) {
        req.user.studentProfileId = studentProfile._id;
        req.user.batch = studentProfile.batch;
        req.user.course = studentProfile.course;
        req.user.teacher = studentProfile.teacher;
        req.user.counsellor = studentProfile.counsellor;
        req.user.idProof = studentProfile.documents?.idProof || null;
        req.user.idVerified = studentProfile.idVerified;
        req.user.feedback = studentProfile.feedback;
        req.user.remarks = studentProfile.remarks;
        req.user.statusHistory = studentProfile.statusHistory;
        req.user.fatherName = studentProfile.family?.father?.name || '';
        req.user.fatherPhone = studentProfile.family?.father?.phone || '';
        req.user.motherName = studentProfile.family?.mother?.name || '';
        req.user.motherPhone = studentProfile.family?.mother?.phone || '';
        req.user.guardianName = studentProfile.family?.guardian?.name || '';
        req.user.guardianRelation = studentProfile.family?.guardian?.relation || '';
        req.user.guardianPhone = studentProfile.family?.guardian?.phone || '';
        req.user.pendingProfileUpdate = studentProfile.pendingProfileUpdate;
      }
    } else if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacherProfile = await Teacher.findOne({ user: req.user._id });
      if (teacherProfile) {
        req.user.teacherProfileId = teacherProfile._id;
      }
    } else if (req.user.role === 'counsellor') {
      const Counsellor = require('../models/Counsellor');
      const counsellorProfile = await Counsellor.findOne({ user: req.user._id });
      if (counsellorProfile) {
        req.user.counsellorProfileId = counsellorProfile._id;
      }
    }
    
    // Prevent back-button caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const isPasswordChangeRoute = req.path === '/force-change-password';
    const isLogoutRoute = req.path === '/logout';

    if ((req.user.mustChangePassword || req.user.firstLoginCompleted === false) && !isPasswordChangeRoute && !isLogoutRoute) {
      if (req.accepts('html')) return res.redirect('/auth/force-change-password');
      return res.status(403).json({ message: 'Password change required' });
    }

    // Module 1 — Behavior Engine: async anomaly scoring (never blocks response)
    behaviorEngine(req, res, () => {});

    next();
  } catch (err) {
    if (req.accepts('html')) return res.redirect('/auth/login');
    return res.status(401).json({ message: 'Token invalid' });
  }
};

module.exports = protect;
