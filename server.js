const http     = require('http');
const express  = require('express');
const path     = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./config/db');
if (!process.env.JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is missing!');
  process.exit(1);
}

// Connect to Database
connectDB();

const fs = require('fs');
const privateUploadsDir = path.join(__dirname, 'private-uploads');
if (!fs.existsSync(privateUploadsDir)) {
  fs.mkdirSync(privateUploadsDir);
}

const app    = express();
const server = http.createServer(app);

// ── Socket.IO setup ───────────────────────────────────────────────────────
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: false } });
app.set('io', io);

// Security namespace for Security admin dashboard
const securityNs = io.of('/security');
securityNs.on('connection', socket => {
  socket.join('security');
  socket.emit('connected', { message: 'Security Security Feed connected' });
});

// View Engine Setup
const ejs = require('ejs');

// Register custom EJS template engine to intercept internal variables (e.g. layout = 'main')
app.engine('ejs', (filePath, options, callback) => {
  ejs.renderFile(filePath, options, (err, html) => {
    if (err) return callback(err);

    const layoutName = options.layout;
    if (layoutName) {
      let layoutPath = '';

      // Fix: Use a clean switch-like structure to avoid path conflicts
      if (layoutName === 'auth') {
        layoutPath = path.join(__dirname, 'views', 'layouts', 'auth.ejs');
      } else {
        // This handles 'main', 'counsellor' (if file exists), or any other custom layout
        layoutPath = path.join(__dirname, 'views', 'layouts', `${layoutName}.ejs`);
      }

      // Safeguard recursion
      delete options.layout;
      options.body = html;

      ejs.renderFile(layoutPath, options, (err, layoutHtml) => {
        if (err) return callback(err);
        callback(null, layoutHtml);
      });
    } else {
      callback(null, html);
    }
  });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
const helmet = require('helmet');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
        "script-src-attr": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
        "style-src-elem": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "https:"],
      },
    },
  })
);
app.use(cookieParser());
// Body size limits — prevent 100MB JSON DoS payloads
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// ── Security: Input Sanitization Guard ──────────────────────────────────────
// MUST come after body parsers (req.body only exists after parsing)
const inputMutationGuard = require('./middleware/security/inputMutationGuard');
app.use(inputMutationGuard);

// ── Belt-and-suspenders NoSQL sanitize (strips remaining $-prefixed keys) ─
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());

app.use((req, res, next) => {
  res.locals.csrfToken = ''; // safe default initialization
  next();
});

const csurf = require('csurf');
const csrfProtection = csurf({ cookie: true });
app.use((req, res, next) => {
  // CSRF bypass ONLY in test environment — never port-based in production
  if (process.env.NODE_ENV === 'test') {
    res.locals.csrfToken = 'test-token';
    return next();
  }
  csrfProtection(req, res, (err) => {
    if (err) return next(err);
    res.locals.csrfToken = req.csrfToken();
    next();
  });
});

// Support method-override in forms via ?_method query parameter
app.use((req, res, next) => {
  if (req.query && req.query._method) {
    const method = req.query._method.toUpperCase();
    if (['PUT', 'PATCH', 'DELETE'].includes(method)) {
      req.method = method;
    }
  }
  next();
});

// Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to populate defaults, authenticated user, and query flash messages
app.use((req, res, next) => {
  res.locals.layout = undefined;
  res.locals.title = '';
  res.locals.csrfToken = res.locals.csrfToken || '';
  res.locals.subtitle = '';
  res.locals.page = '';
  res.locals.success = [];
  res.locals.error = [];
  res.locals.user = req.user || null;
  res.locals.filters = {};
  res.locals.filter = {};

  const successMessages = {
    created: 'Record created successfully!',
    updated: 'Record updated successfully!',
    saved: 'Record saved successfully!',
    posted: 'Update posted successfully!',
    pwd_reset: 'Password reset successfully!',
    pwd_changed: 'Password changed successfully!',
    pwd_request: 'Password reset request submitted successfully. Please contact your administrator to approve.',
    paid: 'Payment recorded successfully!',
    converted: 'Lead converted to student successfully!',
    followup: 'Follow-up registered successfully!',
    submitted: 'Assignment submitted successfully!',
    graded: 'Submission graded successfully!',
    verified: 'Student ID verified successfully!',
    deleted: 'Record deleted successfully!',
    walkin: 'Walk-in lead registered successfully!',
    request_submitted: 'Profile update request submitted successfully for admin approval.',
    profile_approved: 'Profile update request approved successfully!',
    profile_rejected: 'Profile update request rejected successfully.',
  };

  const errorMessages = {
    error: 'An error occurred. Please try again.',
    exists: 'Record already exists.',
    already: 'You have already submitted this assignment.'
  };

  for (const [key, val] of Object.entries(req.query)) {
    if (successMessages[key]) {
      res.locals.success.push(successMessages[key]);
    }
    if (errorMessages[key]) {
      res.locals.error.push(errorMessages[key]);
    }
  }
  next();
});

// Import & register dynamic notifications pre-processor
const { populateNotifications, calculateNotifications, calculateSidebarBadges } = require('./middleware/notificationMiddleware');
app.use(populateNotifications);

// Import protect middleware for root checks
const protect = require('./middleware/auth');

// Dedicated API endpoint for notifications (JSON)
app.get('/api/notifications', protect, async (req, res) => {
  try {
    const notifications = await calculateNotifications(req.user);
    const sidebarBadges = await calculateSidebarBadges(req.user);
    res.json({ notifications, sidebarBadges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Security: Rate Limiter on public auth routes ─────────────────────────
const { getRateLimiter } = require('./middleware/security/intelligentRateLimiter');
app.use('/auth/login', getRateLimiter('anonymous'));
app.use('/auth/forgot-password', getRateLimiter('anonymous'));

// ── Security: Fee Payment Integrity Checks ───────────────────────────────
const feeIntegrityValidator = require('./middleware/security/feeIntegrityValidator');
app.use(['/admin/fees', '/counsellor/admission', '/student/fees', '/student/payment'], feeIntegrityValidator);

// ── Security: Admin Security Dashboard ──────────────────────────────────
app.use('/admin/security', require('./routes/security/adminSecurityRoutes'));

// Mount Modules
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/teacher', require('./routes/teacher'));
app.use('/student', require('./routes/student'));
app.use('/counsellor', require('./routes/counsellor'));

// Root route redirect logic
app.get('/', protect, (req, res) => {
  const redirectMap = {
    admin: '/admin/dashboard',
    teacher: '/teacher/dashboard',
    counsellor: '/counsellor/dashboard',
    student: '/student/dashboard',
  };
  res.redirect(redirectMap[req.user.role] || '/auth/login');
});

// Authenticated private file streaming route
app.get('/files/:filename', protect, (req, res) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(__dirname, 'private-uploads', safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).render('404', { title: 'File Not Found', layout: 'main' });
  }

  res.sendFile(filePath);
});

// Post logout form submissions handling
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.redirect('/auth/login');
});

// Catch-all 404 Route
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found', layout: 'main' });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🛡️  Security: ${process.env.SECURITY_ENABLED !== 'false' ? 'ENABLED' : 'DISABLED'}`);
});
