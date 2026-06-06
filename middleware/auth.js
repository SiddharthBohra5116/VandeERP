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