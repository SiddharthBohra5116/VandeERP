const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vande_secret_key');
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || (!req.user.isActive && req.user.status !== 'complete')) {
      if (req.accepts('html')) return res.redirect('/auth/login');
      return res.status(401).json({ message: 'Account inactive or not found' });
    }
    
    // If the logged-in user is a student, attach their Student profile fields to req.user
    if (req.user.role === 'student') {
      const Student = require('../models/Student');
      const studentProfile = await Student.findOne({ userId: req.user._id });
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
        req.user.guardianPhone = studentProfile.family?.guardian?.phone || '';
        req.user.pendingProfileUpdate = studentProfile.pendingProfileUpdate;
      }
    }
    
    // Prevent back-button caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    next();
  } catch (err) {
    if (req.accepts('html')) return res.redirect('/auth/login');
    return res.status(401).json({ message: 'Token invalid' });
  }
};

module.exports = protect;