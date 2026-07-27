const assert = require('assert');
const fs = require('fs');
const ejs = require('ejs');

const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
const softNavigation = fs.readFileSync('public/js/soft-navigation.js', 'utf8');
const dashboard = fs.readFileSync('views/admin/dashboard.ejs', 'utf8');
const layout = fs.readFileSync('views/layouts/main.ejs', 'utf8');
assert.match(layout, /document\.querySelectorAll\('details\[open\]'\)/);
const directory = fs.readFileSync('views/admin/users.ejs', 'utf8');
const studentController = fs.readFileSync('controllers/admin/studentManagementController.js', 'utf8');
const leads = fs.readFileSync('views/admin/leads.ejs', 'utf8');
const counsellorProfile = fs.readFileSync('views/admin/counsellor-profile.ejs', 'utf8');
const mainCss = fs.readFileSync('public/css/main.css', 'utf8');
const dropdownEnhancer = fs.readFileSync('public/js/dropdown-enhancer.js', 'utf8');

assert.match(softNavigation, /url\.pathname === '\/logout'/);
assert.match(sidebar, /action="\/logout" method="POST" data-native-submit="true"/);
assert.match(sidebar, /students\?status=complete" class="nav-item">[\s\S]*<circle cx="12" cy="12" r="9"\/>/);
assert.match(sidebar, /<line x1="9" y1="12" x2="21" y2="12"\/>/);
assert.match(sidebar, /nav-flyout-menu[\s\S]*\/admin\/leads\/create/);
assert.doesNotMatch(sidebar, /<span>\+ Manual Add Lead<\/span>/);
assert.match(sidebar, /<span>Academy Modules<\/span>/);
assert.match(sidebar, /modules\?\.teachers !== false[\s\S]*Manage Teachers[\s\S]*<% \} %>[\s\S]*Manage Counsellors/);
assert.match(sidebar, /modules\?\.batches !== false[\s\S]*href="\/admin\/batches"/);
assert.match(dashboard, /admin-dashboard-sections:/);
for (const section of ['pipeline', 'ledgers', 'today']) {
  assert.match(dashboard, new RegExp(`data-dashboard-section="${section}"`));
}
assert.match(layout, /sidebar-collapsed-preload/);
assert.match(layout, /window\.consolidateToasts/);
assert.match(softNavigation, /window\.consolidateToasts\?\.\(\)/);
assert.match(sidebar, /document\.currentScript\.parentElement\.classList\.add\('collapsed'\)/);
assert.match(directory, /vande\.peopleColumns\.v3/);
assert.match(directory, /overflow-x:auto; overflow-y:visible/);
assert.match(directory, /\[data-column="select"\]\s*\{\s*position:sticky;\s*left:0/);
assert.match(directory, /\[data-column="name"\]\s*\{\s*position:sticky;\s*left:64px/);
assert.match(directory, /essential:\s*\[[^\]]*'course'[^\]]*'feeDue'/);
assert.match(directory, /const showStudentColumns = !hasRole \|\| activeRole === 'student'/);
assert.match(directory, /id="courseFilter" name="course"/);
assert.match(studentController, /if \(course\) profileFilter\.course = course/);
assert.match(directory, /class="person-status-menu"/);
assert.doesNotMatch(directory, /class="person-status-select"/);
assert.match(mainCss, /\.sidebar\.collapsed:not\(:hover\) \.nav-flyout-menu\s*\{\s*display:\s*none\s*!important/);

const sidebarTemplate = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
const renderSidebar = role => ejs.render(sidebarTemplate, {
  user: { role, course: true, batch: true },
  page: 'dashboard',
  modules: {},
  sidebarBadges: {},
  leadCount: 0,
  followupCount: 0,
  studentCount: 0
}, { filename: 'views/partials/sidebar.ejs' });
assert.doesNotMatch(renderSidebar('teacher'), /Pipeline Admissions/);
assert.doesNotMatch(renderSidebar('student'), /Pipeline Admissions/);
assert.match(renderSidebar('counsellor'), /Pipeline Admissions/);
assert.match(dropdownEnhancer, /select\.lead-select-badge/);
assert.match(leads, /href="\/admin\/leads\/create" class="btn btn-primary btn-sm">\+ Add Lead/);
assert.match(leads, /id="leadColumnPicker"/);
assert.match(counsellorProfile, /class="counsellor-lead-table"/);
assert.match(counsellorProfile, /<th>Name<\/th>[\s\S]*<th>Phone<\/th>[\s\S]*<th>Email<\/th>/);
assert.match(leads, /vande\.leadColumns\.v2/);
assert.match(leads, /data-lead-column="phone"\]\s*\{\s*min-width:140px;\s*white-space:nowrap/);
assert.match(leads, /class="lead-actions"/);
for (const column of ['name', 'phone', 'email', 'course', 'source', 'referredBy', 'counsellor', 'status', 'followUp', 'actions']) {
  assert.match(leads, new RegExp(`data-lead-column="${column}"`));
}

console.log('Admin shell UX checks passed.');
