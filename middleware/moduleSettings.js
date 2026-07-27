const ModuleSettings = require('../models/ModuleSettings');

const DEFAULTS = Object.freeze({
  students: true,
  teachers: true,
  counsellors: true,
  courses: true,
  batches: true,
  attendance: true,
  kyc: true,
  leads: true,
  fees: true,
  schedules: true,
  assignments: true,
  updates: true,
  curriculum: true,
  progress: true,
  announcements: true,
  reports: true,
  leaves: true
});

let cached = null;
let expiresAt = 0;

// ponytail: per-process 30s cache; use shared cache only when module changes must propagate instantly across multiple app instances.
async function getModules() {
  if (cached && Date.now() < expiresAt) return cached;
  const settings = await ModuleSettings.findOne({ key: 'academy-modules' }).lean();
  cached = { ...DEFAULTS, ...(settings?.modules || {}) };
  expiresAt = Date.now() + 30000;
  return cached;
}

const normalizeModules = input => Object.fromEntries(
  Object.keys(DEFAULTS).map(key => [key, input[key] === true || input[key] === 'on'])
);

async function saveModules(input) {
  const modules = normalizeModules(input);
  await ModuleSettings.findOneAndUpdate(
    { key: 'academy-modules' },
    { $set: { modules } },
    { upsert: true, runValidators: true }
  );
  cached = modules;
  expiresAt = Date.now() + 30000;
  return modules;
}

const routeRules = [
  ['students', /^\/(?:admin\/students|student|teacher\/students|counsellor\/students)(?:\/|$)/],
  ['students', /^\/admin\/profile-requests(?:\/|$)/],
  ['students', /^\/counsellor\/admissions(?:\/|$)|^\/(?:admin|counsellor)\/leads\/[^/]+\/convert(?:\/|$)/],
  ['teachers', /^\/(?:admin\/teachers|teacher)(?:\/|$)/],
  ['counsellors', /^\/(?:admin\/counsellors|counsellor)(?:\/|$)/],
  ['courses', /^\/admin\/courses(?:\/|$)/],
  ['batches', /^\/admin\/batches(?:\/|$)/],
  ['attendance', /^\/(?:admin|teacher|student)\/attendance(?:\/|$)/],
  ['kyc', /^\/admin\/students\/(?:bulk-verify-id|[^/]+\/verify-id)$/],
  ['leads', /^\/(?:admin|counsellor)\/leads(?:\/|$)/],
  ['fees', /^\/(?:admin\/fees|student\/fees|counsellor\/admissions\/[^/]+\/fee)(?:\/|$)/],
  ['schedules', /^\/(?:admin\/(?:schedules|timetables|classrooms)|teacher\/schedules)(?:\/|$)/],
  ['assignments', /^\/(?:teacher|student)\/assignments(?:\/|$)/],
  ['updates', /^\/(?:teacher\/updates|student\/updates)(?:\/|$)/],
  ['curriculum', /^\/(?:teacher|student)\/curriculum(?:\/|$)/],
  ['progress', /^\/(?:teacher\/progress|student\/(?:progress|certificate))(?:\/|$)/],
  ['announcements', /^\/(?:admin|teacher|student|counsellor)\/announcements(?:\/|$)/],
  ['reports', /^\/(?:admin|counsellor)\/reports(?:\/|$)|^\/student\/analytics(?:\/|$)/],
  ['leaves', /^\/(?:admin\/holidays-leaves|teacher\/leaves|counsellor\/leaves)(?:\/|$)/]
];

async function moduleSettings(req, res, next) {
  try {
    const modules = await getModules();
    res.locals.modules = modules;
    const path = req.path;
    let disabled = routeRules.find(([key, pattern]) => !modules[key] && pattern.test(path));
    const requestedRole = req.body?.role || req.query?.role;
    if (!disabled && /^\/admin\/users(?:\/create|\/temporary-staff)?$/.test(path)) {
      if (requestedRole === 'student' && !modules.students) disabled = ['students'];
      if (requestedRole === 'teacher' && !modules.teachers) disabled = ['teachers'];
      if (requestedRole === 'counsellor' && !modules.counsellors) disabled = ['counsellors'];
    }
    if (!disabled || req.path === '/admin/modules') return next();
    return res.status(404).render('module-disabled', {
      title: 'Module unavailable',
      moduleName: disabled[0],
      user: req.user || null,
      layout: 'main'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { DEFAULTS, getModules, moduleSettings, normalizeModules, routeRules, saveModules };
