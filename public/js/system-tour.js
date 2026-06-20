(function() {
  const STORAGE_KEY = 'vda.activeSystemTour';
  const SEEN_KEY_PREFIX = 'vda.seenSystemTour.';

  const S = (route, selector, title, body, extra = {}) => ({ route, selector, title, body, ...extra });
  const C = (route, selector, title, body, extra = {}) => S(route, selector, title, body, { action: 'click', ...extra });

  const sharedAccountSteps = [
    C(null, 'a[href="/auth/inbox"]', 'Open Inbox & Chat', 'This sidebar item opens your message center. Click it now. The guide will continue inside the real inbox page.'),
    S('/auth/inbox', '.notification-list, .chat-shell, .card, form', 'Inbox screen', 'This is where messages live. Depending on your role, contacts are limited to people connected to your work: admin, teachers, counsellors, or assigned students. If a contact is selected, the conversation appears here.'),
    C('/auth/inbox', 'a[href="/auth/profile"]', 'Open My Profile', 'This sidebar item opens your profile. Click it now so the guide can show where personal details and password changes live.'),
    S('/auth/profile', 'form', 'Profile forms', 'Profile is where the user updates phone, address, photo, and password. Student profile edits are not applied immediately; they go to admin approval first. Staff profile edits are applied directly.'),
    C('/auth/profile', '#notificationBellBtn', 'Notification bell', 'Click the bell in the top bar. Notifications are not just decoration: they tell users about messages, fees, attendance, reset requests, grading, leaves, and pending work.', { stayOnRoute: true }),
    S('/auth/profile', '#notificationDropdown', 'Notification dropdown', 'This panel groups alerts. Use filters like All, Tasks, Messages, and Alerts. If there are no notifications, the empty state is normal; it means nothing is waiting right now.', { optional: true })
  ];

  const TOUR_LIBRARY = {
    admin: {
      label: 'Admin Full Tour',
      steps: [
        S('/admin/dashboard', 'a[href="/admin/dashboard"]', 'Admin dashboard', 'This is the admin command center. Start here every day. It summarizes money, schedules, active leads, low attendance, pending leaves, student count, reset requests, and recent communication.'),
        S('/admin/dashboard', '.stat-card', 'Dashboard cards', 'These cards are shortcuts. They are not only numbers. Clicking a card opens the exact module behind that number, such as fees, schedules, interested leads, low attendance, leaves, or students.'),
        S('/admin/dashboard', '.reset-password-btn', 'Password reset requests are conditional', 'This area appears only when someone has submitted forgot password with matching email and phone. If no request exists, nothing will be visible here. When visible, Reset Password opens a modal; Dismiss removes the request without changing the password.', { optional: true, emptyBody: 'No password reset request is visible right now. That is correct when no user has requested one. The workflow still exists and will appear automatically when a request is made.' }),
        S('/admin/dashboard', '#notificationBellBtn', 'Admin notifications', 'The bell shows urgent admin work: reset requests, profile requests, leaves, overdue fees, messages, and security-like alerts. Click it whenever there is a badge.', { optional: true }),
        C('/admin/dashboard', 'a[href="/admin/students"]', 'Open Manage Students', 'Click Manage Students in the sidebar. The guide will continue on the real student list.'),
        S('/admin/students', '.filter-bar', 'Student filters', 'This filter bar is the first thing to use. Search by name, email, phone, roll number, course, or batch. Use attendance filters to find low-attendance students. Clear resets the list.'),
        S('/admin/students', 'a[href^="/admin/students/"]', 'Student name links', 'Student names are clickable. A name opens the full profile with personal details, fees, attendance, progress, CRM history, ID proof, remarks, and status actions.', { optional: true }),
        S('/admin/students', '.reset-password-btn', 'Reset from directory', 'Admin can reset a user password from the directory too. This is useful even when the user did not create a forgot-password request, but use it carefully because it changes login access.', { optional: true }),
        C('/admin/students', 'a[href="/admin/users/create?role=student"], a[href^="/admin/users/create"]', 'Open Add User', 'Click the Add button. This opens the real create form where admin makes a login and role profile.'),
        S('/admin/users/create?role=student', 'form', 'Create user form', 'Every field matters. Email becomes login ID. Role decides the portal. Phone is used for contact and forgot-password matching. For students, course, batch, teacher, counsellor, fee, and initial password affect downstream access.'),
        C('/admin/users/create?role=student', 'a[href="/admin/fees"]', 'Open Fees & Ledger', 'Click Fees & Ledger in the sidebar. This is where financial tracking happens.'),
        S('/admin/fees', '.filter-bar', 'Fee filters', 'Use filters to find students by name, due status, course, or batch. Admin should check this before calling a student or updating a payment.'),
        S('/admin/fees', 'a[href^="/admin/fees/"]', 'Ledger links', 'Clicking a student name or Ledger / Add Payment opens that student’s fee ledger. Ledger pages show total, paid, balance, installments, payment history, and adjustment controls.', { optional: true }),
        C('/admin/fees', 'a[href="/admin/leads"]', 'Open Lead Pipeline', 'Click Lead Pipeline. The tour will move from finance to CRM.'),
        S('/admin/leads', '.filter-bar', 'Lead filters', 'Use filters to narrow leads by status, counsellor, course, or search text. This prevents losing active leads inside a long list.'),
        S('/admin/leads', 'a[href^="/admin/leads/"]', 'Lead detail links', 'Lead names open the lead detail page. That page contains phone, status, assigned counsellor, comments, history, and conversion action when eligible.', { optional: true }),
        S('/admin/leads', 'form[action$="/assign"]', 'Assign lead', 'The assign dropdown gives ownership to a counsellor. After assignment, that counsellor sees the lead in their own pipeline.', { optional: true }),
        C('/admin/leads', 'a[href="/admin/schedules"]', 'Open Class Schedules', 'Click Class Schedules. This is the operational calendar area.'),
        S('/admin/schedules', '.tab-btn, a[href="/admin/schedules/create"], form', 'Schedules page', 'Schedules connect teacher, course, batch, classroom, date, and time. If a class is wrongly scheduled, attendance, teacher dashboard, and student timetable will all be affected.'),
        S('/admin/schedules', 'a[href="/admin/schedules/create"]', 'Create schedule', 'Create Schedule opens the form for a single class. Use this when a class must be added manually instead of generated from a template.', { optional: true }),
        C('/admin/schedules', 'a[href="/admin/reports"]', 'Open Reports', 'Click Reports & Analytics. Admin reports explain whether the academy is healthy.'),
        S('/admin/reports', '.analytics-tab-btn, .filter-bar, .analytics-filter-bar', 'Report tabs and filters', 'Reports are split by overview, financial, enrollment, attendance, academic, and staff. Date, batch, and course filters change the data shown. Export CSV downloads the filtered data.'),
        C('/admin/reports', 'a[href="/admin/holidays-leaves"]', 'Open Holidays & Leaves', 'Click Holidays & Leaves. This page controls official holidays and staff leave requests.'),
        S('/admin/holidays-leaves', '.tab-btn, form', 'Holidays and leaves', 'Academy Holidays affect attendance and schedule context. Staff Leaves are requests from teachers or counsellors; admin must approve or reject them.'),
        C('/admin/holidays-leaves', 'a[href="/admin/security/dashboard"]', 'Open Security Monitor', 'Click Security Monitor. This is admin-only.'),
        S('/admin/security/dashboard', '.card, table', 'Security monitor', 'Security Monitor is for reviewing alerts, suspicious behavior, blacklists, and fee audit information. Treat this as sensitive admin-only data.'),
        ...sharedAccountSteps
      ]
    },

    teacher: {
      label: 'Teacher Full Tour',
      steps: [
        S('/teacher/dashboard', 'a[href="/teacher/dashboard"]', 'Teacher dashboard', 'This is the teacher’s daily workspace. It shows today’s class schedule, admin alerts, active assignments, and recent updates. Start here before taking class actions.'),
        S('/teacher/dashboard', 'button[onclick^="openCompleteScheduleModal"], form[action^="/teacher/schedules/"]', 'Mark class complete', 'When a scheduled class is finished, Mark Complete tells the system the class actually happened. If no class is visible now, this button will not appear, and that is normal.', { optional: true }),
        C('/teacher/dashboard', 'a[href="/teacher/attendance"]', 'Open Mark Attendance', 'Click Mark Attendance in the sidebar. Attendance should be marked from the real attendance page.'),
        S('/teacher/attendance', '.filter-bar', 'Attendance filters', 'Choose the correct batch, course, date, and class context. If the wrong filter is selected, the wrong roster or no roster can appear.'),
        S('/teacher/attendance', '#attendanceForm, #markAllPresentBtn, #markAllAbsentBtn', 'Attendance sheet controls', 'When a roster is visible, mark each student Present, Absent, or Late. Mark All Present and Mark All Absent are shortcuts; review before saving because admin and students will see the result.', { optional: true, emptyBody: 'The attendance sheet controls are not visible until the right class context produces a roster. Use the filters first.' }),
        C('/teacher/attendance', 'a[href="/teacher/attendance/history"]', 'Open Attendance History', 'Click Attendance History. This lets teachers review what was already marked.'),
        S('/teacher/attendance/history', '.filter-bar, table, .session-row', 'Attendance history', 'Use history to review previous sessions. Details can show the roster and marked status for a specific class.'),
        C('/teacher/attendance/history', 'a[href="/teacher/assignments"]', 'Open Assignments', 'Click Assignments. This is where teacher-created tasks live.'),
        S('/teacher/assignments', 'a[href="/teacher/assignments/create"]', 'Create assignment button', 'Use Create Assignment to publish a task to students. The title, instructions, due date, batch, and file attachment must be clear.'),
        S('/teacher/assignments', 'a[href^="/teacher/assignments/"]', 'Assignment detail links', 'Existing assignments open a detail page. That is where teacher reviews submissions, filters by status, downloads files, grades work, and extends deadlines.', { optional: true }),
        C('/teacher/assignments', 'a[href="/teacher/progress"]', 'Open Student Progress', 'Click Student Progress. This area records tests, marks, and remarks.'),
        S('/teacher/progress', '.tab-btn, button[data-tab]', 'Progress tabs', 'Progress has different modes: board view for per-student actions, bulk test entry for many marks at once, and history for editing or deleting tests.'),
        S('/teacher/progress', 'button[onclick^="openTestModal"], button[onclick^="openRemarkModal"]', 'Marks and remarks buttons', 'Use test buttons to add marks. Use remark buttons for teacher feedback. Students and admin can later see this academic record.', { optional: true }),
        C('/teacher/progress', 'a[href="/teacher/curriculum"]', 'Open Curriculum Tracker', 'Click Curriculum Tracker. This is where syllabus completion is maintained.'),
        S('/teacher/curriculum', 'form, a[href^="/teacher/curriculum/"]', 'Curriculum controls', 'Initialize a syllabus tracker, open a curriculum, add topics, and toggle topics only after they are actually taught.'),
        C('/teacher/curriculum', 'a[href="/teacher/updates"]', 'Open Daily Updates', 'Click Daily Updates. This is the class log students can read later.'),
        S('/teacher/updates', 'a[href="/teacher/updates/create"]', 'Post Daily Update', 'Post Daily Update opens the form for lesson summary, homework instructions, remarks, and optional file attachment.'),
        C('/teacher/updates', 'a[href="/teacher/leaves"]', 'Open Leave Requests', 'Click Leave Requests. This is how teachers ask admin for leave.'),
        S('/teacher/leaves', 'form', 'Leave request form', 'Enter dates and reason clearly. After submission, admin approves or rejects it from Holidays & Leaves.'),
        ...sharedAccountSteps
      ]
    },

    counsellor: {
      label: 'Counsellor Full Tour',
      steps: [
        S('/counsellor/dashboard', 'a[href="/counsellor/dashboard"]', 'Counsellor dashboard', 'This is the counsellor workspace. It focuses on assigned leads, due follow-ups, converted students, admissions, and performance.'),
        C('/counsellor/dashboard', 'a[href="/counsellor/leads"]', 'Open All Leads', 'Click All Leads. This is the main CRM list.'),
        S('/counsellor/leads', '.filter-bar, table, .card', 'Lead list', 'Use this page to find leads by status, search term, course, or follow-up priority. Do not rely on memory; log and filter everything.'),
        S('/counsellor/leads', 'a[href^="/counsellor/leads/"]', 'Lead detail links', 'Open a lead to see full information, notes, follow-up history, edit options, ready/lost status actions, and conversion entry point.', { optional: true }),
        C('/counsellor/leads', 'a[href="/counsellor/leads/new"], a[href="/counsellor/leads/create"]', 'Open Add Lead', 'Click Add Lead. The guide will continue on the real lead creation form.'),
        S('/counsellor/leads/new', 'form', 'Add lead form', 'Fill name, phone, email, interested course, source, notes, and next follow-up. A weak lead record makes later follow-up confusing.'),
        C('/counsellor/leads/new', 'a[href="/counsellor/leads/followups"]', 'Open Follow-ups', 'Click Follow-ups. This page tells you who needs attention now.'),
        S('/counsellor/leads/followups', 'table, .card', 'Follow-up list', 'Follow-ups prevent missed calls and stale prospects. A lead with no recent touchpoint should be contacted and logged.'),
        C('/counsellor/leads/followups', 'a[href="/counsellor/admissions"]', 'Open Admissions', 'Click Pipeline Admissions. This is where converted leads become student records.'),
        S('/counsellor/admissions', 'a[href*="/fee"], table, .card', 'Admissions and fee view', 'Admissions show converted students. Fee links show payment status for admitted students, usually read-only for counsellor context.', { optional: true }),
        C('/counsellor/admissions', 'a[href="/counsellor/students"]', 'Open My Students', 'Click My Students. These are students connected to your counselling work.'),
        S('/counsellor/students', '.filter-bar, table, .card', 'My Students', 'This page helps counsellors keep track of converted or assigned students after admission.'),
        C('/counsellor/students', 'a[href="/counsellor/reports"]', 'Open Reports', 'Click Reports. Performance reports show whether follow-ups and conversions are moving well.'),
        S('/counsellor/reports', '.card, table', 'Counsellor reports', 'Reports can show assigned leads, conversion rate, admissions, and follow-up performance. Use this to improve daily work.'),
        C('/counsellor/reports', 'a[href="/counsellor/leaves"]', 'Open Leave Requests', 'Click Leave Requests.'),
        S('/counsellor/leaves', 'form', 'Leave request form', 'Submit leave with correct dates and reason. Admin later approves or rejects it.'),
        ...sharedAccountSteps
      ]
    },

    student: {
      label: 'Student Full Tour',
      steps: [
        S('/student/dashboard', 'a[href="/student/dashboard"]', 'Student dashboard', 'This is the student home screen. It shows attendance, assignments, fee dues, updates, document verification, profile warnings, and certificate access when eligible.'),
        S('/student/dashboard', 'a[href="/auth/profile#document-verification"], form[action="/student/profile/upload-id"]', 'Document verification and KYC', 'If this section is visible, complete it first. Some pages, like assignments or curriculum, can be locked until ID proof and required profile details are complete.', { optional: true }),
        S('/student/dashboard', '.stat-card', 'Dashboard shortcut cards', 'These cards open important areas quickly: attendance, assignments, fees, and other student work.'),
        C('/student/dashboard', 'a[href="/student/attendance"]', 'Open My Attendance', 'Click My Attendance. Attendance is one of the most important student tracking pages.'),
        S('/student/attendance', '.filter-bar, table, .card', 'Attendance page', 'This page shows your own attendance only. Use filters to review a date range or month. Watch percentage, absent days, late days, and history.'),
        C('/student/attendance', 'a[href="/student/updates"]', 'Open Class Updates', 'Click Class Updates. Teachers post what happened in class here.'),
        S('/student/updates', '.filter-bar, a[download], .card', 'Class updates', 'Read updates after class. If a teacher attached a file, use the download button. Updates explain topics covered, homework, and instructions.'),
        C('/student/updates', 'a[href="/student/progress"]', 'Open My Reports', 'Click My Reports. This is where marks and feedback appear.'),
        S('/student/progress', 'table, .card', 'Reports and marks', 'This page shows test scores, total marks, percentages, dates, and teacher remarks. Use it to know what to improve.'),
        C('/student/progress', 'a[href="/student/curriculum"]', 'Open Curriculum View', 'Click Curriculum View. If it is locked, complete KYC first; the guide will explain that too.'),
        S('/student/curriculum', 'table, .card, .alert', 'Curriculum view', 'Curriculum shows completed and pending topics. If Access Denied appears, it means profile/KYC requirements are not complete yet.', { optional: true }),
        C('/student/curriculum', 'a[href="/student/assignments"]', 'Open Assignments', 'Click Assignments. This is where homework and submissions happen.'),
        S('/student/assignments', 'button[onclick^="openSubmitModal"], a[download], .card, .alert', 'Assignments page', 'Download teacher files, read due dates, submit work through the upload modal, and later check marks and feedback. If locked, complete KYC first.', { optional: true }),
        C('/student/assignments', 'a[href="/student/fees"]', 'Open My Fee Ledger', 'Click My Fee Ledger. Students cannot edit fees, but they can always inspect their own ledger.'),
        S('/student/fees', 'table, .card', 'Fee ledger', 'This page shows total fees, paid amount, balance, installments, due dates, and payment history. Use this before asking staff about fee status.'),
        ...sharedAccountSteps
      ]
    }
  };

  const QUICK_TOURS = {
    admin_dashboard: { label: 'Admin Dashboard Tour', steps: TOUR_LIBRARY.admin.steps.slice(0, 4) },
    admin_fees: { label: 'Fees Tour', steps: TOUR_LIBRARY.admin.steps.slice(10, 13) },
    admin_leads: { label: 'Lead Pipeline Tour', steps: TOUR_LIBRARY.admin.steps.slice(13, 17) },
    teacher_attendance: { label: 'Attendance Tour', steps: TOUR_LIBRARY.teacher.steps.slice(2, 7) },
    teacher_assignments: { label: 'Assignment Tour', steps: TOUR_LIBRARY.teacher.steps.slice(7, 10) },
    counsellor_leads: { label: 'Counsellor Lead Tour', steps: TOUR_LIBRARY.counsellor.steps.slice(1, 8) },
    student_dashboard: { label: 'Student Dashboard Tour', steps: TOUR_LIBRARY.student.steps.slice(0, 4) },
    student_fees: { label: 'Student Fee Tour', steps: TOUR_LIBRARY.student.steps.slice(13, 15) }
  };

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      return null;
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
    removeTourUi();
  }

  function sameRoute(targetRoute) {
    if (!targetRoute) return true;
    const target = new URL(targetRoute, window.location.origin);
    return window.location.pathname === target.pathname && (!target.search || window.location.search === target.search);
  }

  function goToStepRoute(step) {
    if (!step.route) return;
    const target = new URL(step.route, window.location.origin);
    window.location.assign(target.pathname + target.search);
  }

  function findTarget(selector) {
    if (!selector) return null;
    const selectors = selector.split(',').map(item => item.trim()).filter(Boolean);
    for (const item of selectors) {
      const target = document.querySelector(item);
      if (target && target.offsetParent !== null) return target;
    }
    for (const item of selectors) {
      const target = document.querySelector(item);
      if (target) return target;
    }
    return null;
  }

  function removeTourUi() {
    document.querySelectorAll('.system-tour-overlay, .system-tour-card').forEach(el => el.remove());
    document.querySelectorAll('.system-tour-highlight').forEach(el => el.classList.remove('system-tour-highlight'));
  }

  function ensureElementVisible(target) {
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  function placeCard(card, target) {
    card.classList.remove('system-tour-card-center', 'system-tour-card-docked');
    card.style.width = '';
    card.style.left = '';
    card.style.top = '';
    card.style.right = '';
    card.style.bottom = '';

    if (!target) {
      card.classList.add('system-tour-card-center');
      return;
    }

    const rect = target.getBoundingClientRect();
    const cardWidth = Math.min(390, window.innerWidth - 28);
    const cardHeight = Math.min(card.offsetHeight || 260, window.innerHeight - 28);
    const margin = 14;

    if (
      rect.height > window.innerHeight * 0.48 ||
      rect.width > window.innerWidth * 0.72 ||
      rect.bottom > window.innerHeight + 120
    ) {
      card.classList.add('system-tour-card-docked');
      card.style.width = cardWidth + 'px';
      return;
    }

    let left = rect.left;
    let top = rect.bottom + margin;

    if (left + cardWidth > window.innerWidth - margin) left = window.innerWidth - cardWidth - margin;
    if (left < margin) left = margin;
    if (top + cardHeight > window.innerHeight - margin && rect.top > cardHeight + margin) top = rect.top - cardHeight - margin;
    if (top + cardHeight > window.innerHeight - margin) top = window.innerHeight - cardHeight - margin;
    if (top < margin) top = margin;

    card.style.width = cardWidth + 'px';
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function renderStep() {
    const state = readState();
    if (!state || !Array.isArray(state.steps) || !state.steps.length) return;
    const step = state.steps[state.index] || state.steps[0];
    if (!step) return clearState();

    if (!sameRoute(step.route)) {
      goToStepRoute(step);
      return;
    }

    removeTourUi();
    const target = findTarget(step.selector);
    if (target) {
      ensureElementVisible(target);
      target.classList.add('system-tour-highlight');
    }

    window.setTimeout(() => {
      const overlay = document.createElement('div');
      overlay.className = 'system-tour-overlay';

      const card = document.createElement('div');
      card.className = 'system-tour-card';
      const isMissing = !target;
      const isClickStep = step.action === 'click' && target;
      const countText = `Step ${state.index + 1} of ${state.steps.length}`;
      const missingText = step.emptyBody || 'This exact item is not visible in the current data state. That can be normal when there are no records, no notifications, no reset requests, no roster, or the user has not completed a required condition.';
      card.innerHTML = `
        <div class="system-tour-kicker">${escapeHtml(state.label || 'System Tour')} - ${escapeHtml(countText)}</div>
        <h3>${escapeHtml(step.title)}</h3>
        <p>${escapeHtml(step.body)}</p>
        ${isClickStep ? '<div class="system-tour-note">Your action: click the highlighted item. The guide will continue after your click.</div>' : ''}
        ${isMissing ? `<div class="system-tour-note">${escapeHtml(missingText)}</div>` : ''}
        <div class="system-tour-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-tour-action="stop">Stop</button>
          <button type="button" class="btn btn-ghost btn-sm" data-tour-action="back">Back</button>
          <button type="button" class="btn ${isClickStep ? 'btn-ghost' : 'btn-primary'} btn-sm" data-tour-action="next">${isClickStep ? 'Skip' : state.index >= state.steps.length - 1 ? 'Finish' : 'Next'}</button>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.appendChild(card);
      placeCard(card, target);
    }, target ? 260 : 0);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function startTour(tourKey) {
    const libraryTour = TOUR_LIBRARY[tourKey] || QUICK_TOURS[tourKey];
    if (!libraryTour) return;
    const state = { key: tourKey, label: libraryTour.label, index: 0, steps: libraryTour.steps };
    writeState(state);
    localStorage.setItem(SEEN_KEY_PREFIX + tourKey, '1');
    renderStep();
  }

  function stopTour() {
    clearState();
  }

  function nextStep() {
    const state = readState();
    if (!state) return;
    if (state.index >= state.steps.length - 1) {
      clearState();
      return;
    }
    state.index += 1;
    writeState(state);
    renderStep();
  }

  function previousStep() {
    const state = readState();
    if (!state) return;
    state.index = Math.max(0, state.index - 1);
    writeState(state);
    renderStep();
  }

  function clickIsInsideTarget(event, step) {
    const target = findTarget(step.selector);
    if (!target) return false;
    const clicked = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
    if (!clicked) return false;
    if (target === clicked || target.contains(clicked)) return true;
    try {
      const firstSelector = step.selector.split(',')[0].trim();
      return !!clicked.closest(firstSelector);
    } catch (err) {
      return false;
    }
  }

  function advanceForUserClick(event) {
    const state = readState();
    if (!state) return false;
    const step = state.steps[state.index];
    if (!step || step.action !== 'click') return false;
    if (!sameRoute(step.route)) return false;
    if (!clickIsInsideTarget(event, step)) return false;

    if (state.index >= state.steps.length - 1) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    state.index += 1;
    writeState(state);

    if (step.stayOnRoute) {
      window.setTimeout(renderStep, 350);
    }
    return true;
  }

  function maybeStartFirstTimeTour(role) {
    if (!role || !TOUR_LIBRARY[role]) return;
    const seenKey = SEEN_KEY_PREFIX + role;
    if (localStorage.getItem(seenKey)) return;
    if (window.location.pathname === '/auth/guide') return;
    localStorage.setItem(seenKey, '1');
    startTour(role);
  }

  document.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-tour-action]');
    if (actionButton) {
      event.preventDefault();
      const action = actionButton.dataset.tourAction;
      if (action === 'stop') stopTour();
      if (action === 'next') nextStep();
      if (action === 'back') previousStep();
      return;
    }

    const launcher = event.target.closest('[data-start-tour]');
    if (launcher) {
      event.preventDefault();
      startTour(launcher.dataset.startTour);
      return;
    }

    advanceForUserClick(event);
  }, true);

  document.addEventListener('keydown', event => {
    if (!readState()) return;
    if (event.key === 'Escape') stopTour();
    if (event.key === 'ArrowRight') nextStep();
    if (event.key === 'ArrowLeft') previousStep();
  });

  window.SystemTour = {
    start: startTour,
    stop: stopTour,
    next: nextStep,
    previous: previousStep,
    tours: TOUR_LIBRARY,
    quickTours: QUICK_TOURS,
    maybeStartFirstTimeTour
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderStep();
    const role = document.body.dataset.userRole;
    if (role) window.setTimeout(() => maybeStartFirstTimeTour(role), 700);
  });
})();
