// Usage: role('admin') or role('admin', 'teacher')
const role = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      if (req.accepts('html')) return res.redirect('/auth/login');
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      if (req.accepts('html')) return res.status(403).render('403', { title: 'Access Denied', user: req.user });
      return res.status(403).json({ message: 'Access denied' });
    }

    next();
  };
};

module.exports = role;