# BasicERPAcademy Live QA Audit

Date: 2026-06-18

Environment:

- App: `http://localhost:3000`
- Database: local MongoDB `vande_academy`
- Browser: in-app browser until local navigation was blocked by the browser client
- Server command used: `node server.js`
- Written functional audit reference: `FUNCTIONAL_AUDIT.md`

Important testing note:

- I did not run the seeder because `seeder.js` deletes and recreates existing collections.
- Existing data was preserved.
- I avoided destructive actions like delete/archive.
- I opened modals and tested non-destructive UI controls, but I did not submit password changes, delete records, or create bulk test data.

---

## 1. Test Accounts Used

| Role | Email | Password Used | Result |
| --- | --- | --- | --- |
| Admin | `admin@vandeacademy.com` | `123456` | Login passed |
| Teacher | `rohan.sharma@vandeacademy.com` | `12345678` | Login passed |
| Counsellor | `kavya.joshi@vandeacademy.com` | `123456` | Login passed |
| Student | `student1@demo.com` | `123456` | Login passed |

Credential note:

- The seed file says teacher password is `123456`, but the live database has `rohan.sharma@vandeacademy.com` set to `12345678`.
- I verified this locally against the password hash instead of repeatedly trying browser logins.

---

## 2. Authentication QA

### Login Page

Route: `/auth/login`

Result: Pass

Verified:

- Page loads successfully.
- Email field is visible.
- Password field is visible.
- `Forgot Password?` link is visible.
- `Sign In` button is visible.
- Password eye toggle works:
  - initial type: `password`
  - after click: `text`
  - second click: `password`

### Admin Login

Result: Pass

Observed redirect:

- Login as admin redirects to `/admin/dashboard`.
- Admin dashboard title loads as `Admin Dashboard — Vande Digital Academy`.
- Admin portal sidebar is visible.

### Teacher Login

Result: Pass

Observed redirect:

- Login as teacher redirects to `/teacher/dashboard`.
- Teacher dashboard title loads as `Teacher Dashboard — Vande Digital Academy`.

Issue found:

- Seed documentation and live DB are not aligned for the teacher password.

Severity: Low for app functionality, medium for QA/developer onboarding.

### Counsellor Login

Result: Pass

Observed redirect:

- Login as counsellor redirects to `/counsellor/dashboard`.
- Counsellor dashboard title loads as `Counsellor Dashboard — Vande Digital Academy`.

### Student Login

Result: Pass

Observed redirect:

- Login as `student1@demo.com` redirects to `/student/dashboard`.
- Student dashboard title loads as `My Dashboard — Vande Digital Academy`.

### Forgot Password Invalid Request

Route: `/auth/forgot-password`

Result: Pass

Test:

- Entered an email/phone combination that does not exist.

Observed:

- Page stayed in forgot password flow.
- Error appeared: no user matches the provided email and phone number.

### Password Reset Modal

Screen tested: Admin user directory

Result: Pass

Verified:

- `Reset Password` buttons exist in user list.
- Clicking a reset button opens the reset modal.
- Modal binds the selected user's name.
- Reset password modal Show/Hide button works:
  - after Show: input type becomes `text`
  - after Hide: input type becomes `password`

Not submitted:

- I did not save a new password because that would intentionally change a user's credentials.

---

## 3. Admin QA

Admin account: `admin@vandeacademy.com`

### Route Sweep

| Route | Expected Area | Result |
| --- | --- | --- |
| `/admin/dashboard` | Dashboard | Pass |
| `/admin/students` | Manage Students | Pass |
| `/admin/teachers` | Manage Teachers | Pass |
| `/admin/counsellors` | Manage Counsellors | Pass |
| `/admin/profile-requests` | Profile approvals | Pass |
| `/admin/batches` | Batch management | Pass |
| `/admin/announcements` | Announcements | Pass |
| `/admin/fees` | Fee management | Pass |
| `/admin/leads` | Lead pipeline | Pass |
| `/admin/attendance` | Attendance overview | Pass |
| `/admin/schedules` | Class schedules | Pass |
| `/admin/reports` | Reports and analytics | Pass |
| `/admin/holidays-leaves` | Holidays and leaves | Pass |
| `/admin/security/dashboard` | Security dashboard | Pass |

### Admin UI Observations

Verified:

- Admin sidebar renders all expected modules.
- Dashboard cards navigate to major modules.
- User directory has reset buttons.
- Reset modal opens without page crash.
- Security dashboard route is admin-accessible.

Not submitted:

- User creation/edit.
- User activation toggle.
- Fee payment.
- Lead conversion.
- Schedule delete.
- Batch delete.
- Expense delete.
- Leave approve/reject.

Reason:

- These mutate live data and several are destructive or business-significant. They should be tested with a disposable QA dataset.

---

## 4. Teacher QA

Teacher account: `rohan.sharma@vandeacademy.com`

### Route Sweep

| Route | Expected Area | Result |
| --- | --- | --- |
| `/teacher/dashboard` | Teacher dashboard | Pass |
| `/teacher/students` | My Students | Pass |
| `/teacher/attendance` | Mark Attendance | Pass |
| `/teacher/attendance/history` | Attendance History | Pass |
| `/teacher/assignments` | Assignments | Pass |
| `/teacher/assignments/create` | Create Assignment | Pass |
| `/teacher/updates` | Daily Updates | Pass |
| `/teacher/updates/create` | Post Class Update | Pass |
| `/teacher/leaves` | Leave Requests | Pass |
| `/teacher/announcements` | Announcements | Pass |
| `/teacher/announcements/create` | Create Announcement | Pass |
| `/teacher/curriculum` | Curriculum Tracker | Pass |
| `/teacher/progress` | Student Progress | Pass |

### Teacher UI Observations

Verified:

- Teacher dashboard loads.
- Teacher sidebar renders expected teacher modules.
- Attendance page route loads.
- Assignment list route loads.
- Assignment creation route loads.
- Progress page route loads.
- Curriculum page route loads.

Conditional limitation:

- The default attendance page state did not render an attendance roster or `Mark All Present` / `Mark All Absent` buttons during the interaction check. This appears dependent on selected class/date/batch context, not a route crash.
- Assignment detail/grading modal could not be verified for this teacher session because no assignment detail links were visible in the checked state after browser session issues began.

Recommended follow-up:

- Use a controlled teacher account with a known active batch, roster, and at least one submitted assignment to test:
  - mark all present/absent
  - save attendance
  - open assignment detail
  - grade submission
  - extend deadline

---

## 5. Counsellor QA

Counsellor account: `kavya.joshi@vandeacademy.com`

### Route Sweep

| Route | Expected Area | Result |
| --- | --- | --- |
| `/counsellor/dashboard` | Counsellor dashboard | Pass |
| `/counsellor/leads` | All Leads | Pass |
| `/counsellor/leads/new` | Add Lead | Pass |
| `/counsellor/leads/followups` | Follow-ups | Pass |
| `/counsellor/students` | My Students | Pass |
| `/counsellor/admissions` | Admissions | Pass |
| `/counsellor/leaves` | Leave Requests | Pass |
| `/counsellor/reports` | Reports | Pass |
| `/counsellor/announcements` | Announcements | Pass |
| `/counsellor/announcements/create` | Create Announcement | Pass |

### Counsellor UI Observations

Verified:

- Counsellor dashboard loads.
- Counsellor sidebar renders lead/admission modules.
- Lead list route loads.
- Add lead route loads.
- Follow-ups route loads.
- Admissions route loads.
- Reports route loads.

Not submitted:

- New lead creation.
- Follow-up creation/edit.
- Mark lost/ready.
- Lead conversion.
- Leave application.

Reason:

- These actions create or update CRM/admission records. They should be run on a disposable QA lead.

---

## 6. Student QA

Student account: `student1@demo.com`

### Route Sweep

| Route | Expected Area | Result |
| --- | --- | --- |
| `/student/dashboard` | Student dashboard | Pass |
| `/student/attendance` | My Attendance | Pass |
| `/student/updates` | Class Updates | Pass |
| `/student/progress` | My Reports | Pass |
| `/student/fees` | My Fee Ledger | Pass |
| `/student/analytics` | Analytics | Pass |
| `/auth/profile` | My Profile | Pass |
| `/auth/inbox` | Inbox & Chat | Pass |
| `/auth/guide` | System Guide | Pass |

### Conditional Access: Assignments And Curriculum

Routes:

- `/student/assignments`
- `/student/curriculum`

Result: Expected restriction / conditional pass

Observed:

- Both routes return Access Denied for `student1@demo.com`.
- The page explains the condition:
  - complete profile KYC
  - identity proof
  - father's name
  - guardian phone

Interpretation:

- This is not a crash.
- This is a business rule gate.
- The student dashboard should clearly guide the student to complete document/profile verification before accessing assignments and curriculum.

Data note:

- The seeded students checked in the database do not have ID proof, father name, or guardian phone populated.
- Because of this, assignment submission and curriculum viewing cannot be fully tested using `student1@demo.com` without first completing KYC.

---

## 7. Role Boundary QA

Logged in as: `student1@demo.com`

| Direct URL Attempt | Result |
| --- | --- |
| `/admin/dashboard` | Access Denied |
| `/teacher/dashboard` | Access Denied |
| `/counsellor/dashboard` | Access Denied |

Result: Pass

Observation:

- Student cannot directly open admin, teacher, or counsellor dashboards.
- Access denied page renders inside the authenticated student layout.

---

## 8. Issues And Risks Found

### Finding 1: Seeded credential documentation does not match live teacher password

Severity: Medium for QA reliability

Details:

- `seeder.js` advertises `123456` as demo password.
- Current database accepts `12345678` for `rohan.sharma@vandeacademy.com`.
- This caused initial teacher login failure.

Recommendation:

- Add a small `TEST_CREDENTIALS.md` file or update README with the current expected QA credentials.
- If the database is reseeded, confirm all demo users share the documented password.

### Finding 2: Student assignments and curriculum are blocked until KYC

Severity: Not a bug if intentional; medium if this was not expected

Details:

- `student1@demo.com` can access dashboard, attendance, updates, progress, fees, analytics, profile, inbox, and guide.
- Assignments and curriculum are blocked with a KYC completion message.

Recommendation:

- Keep this behavior if it is a policy.
- Make dashboard CTA very clear: students must complete ID proof, father's name, and guardian phone before assignments/curriculum.
- Create one fully KYC-complete demo student for QA so assignment and curriculum flows can be tested.

### Finding 3: Live browser navigation became blocked after several localhost checks

Severity: Low for application, medium for automated QA continuity

Details:

- Initial in-app browser checks worked.
- Later navigation to `localhost` and `127.0.0.1` returned `ERR_BLOCKED_BY_CLIENT`.
- Before this, I successfully verified login page, admin login, admin route sweep, reset modal, teacher route sweep, counsellor route sweep, student route sweep, auth eye toggle, forgot password invalid request, and student role boundary.

Recommendation:

- For repeatable QA, add a Playwright test suite in the repo that runs outside the in-app browser.
- Use isolated test DB and disposable seed data.

### Finding 4: Some workflows need disposable data before safe full submission testing

Severity: Medium

Workflows not submitted in this run:

- Admin create/edit/toggle user.
- Admin fee payment and adjustment.
- Admin lead conversion.
- Admin schedule/timetable/classroom deletion.
- Teacher attendance save.
- Teacher assignment creation/grading.
- Counsellor lead creation/conversion.
- Student assignment submission.
- Profile approve/reject.

Recommendation:

- Add a QA seed mode that creates:
  - one complete student
  - one incomplete student
  - one teacher with active roster
  - one assignment with pending/submitted/graded submissions
  - one disposable lead ready to convert
  - one disposable fee ledger
  - one pending leave
  - one pending profile request

---

## 9. Overall Result

Overall status: Partial pass with clear follow-up requirements.

Passed:

- Server starts.
- MongoDB connection works.
- Admin login and dashboard work.
- Teacher login and main pages work.
- Counsellor login and main pages work.
- Student login and most student pages work.
- Admin core route sweep passes.
- Teacher core route sweep passes.
- Counsellor core route sweep passes.
- Student core route sweep passes except KYC-gated modules.
- Login password visibility toggle works.
- Forgot password invalid request validation works.
- Admin reset password modal opens and Show/Hide works.
- Student role boundary protection works.

Needs follow-up:

- Full form submission testing with disposable data.
- Fully KYC-complete student account for assignment/curriculum QA.
- Dedicated browser/Playwright regression suite.
- Documentation update for live demo credentials.

