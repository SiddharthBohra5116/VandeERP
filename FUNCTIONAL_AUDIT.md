# BasicERPAcademy Functional Audit

Date: 2026-06-18

Scope: Full functional audit of the ERP/CRM application across the four major roles: Admin, Teacher, Counsellor, and Student. This document covers visible screens, buttons, role access, workflows, data visibility, and the expected result after each action.

Source reviewed: Express routes, controllers, EJS views, shared layouts, and frontend scripts currently present in the workspace.

---

## 1. Role And Access Overview

### Shared Access Rules

- Login is available at `/auth/login`.
- Forgot password request is available at `/auth/forgot-password`.
- Force password update is available at `/auth/force-change-password`.
- Logged-in users can access:
  - `/auth/profile`
  - `/auth/change-password`
  - `/auth/inbox`
  - `/auth/guide`
  - notification read actions
- The application uses JWT cookie authentication through the `token` cookie.
- Protected routes require a logged-in user.
- Role routes are guarded:
  - Admin routes require `admin`.
  - Teacher routes allow `teacher` and `admin`.
  - Counsellor routes allow `counsellor` and `admin`.
  - Student routes allow `student` and `admin`.
- If a user is not allowed, the app is expected to show access denied behavior through the role middleware and error views.

### Four Roles

| Role | Main Area | Primary Responsibility |
| --- | --- | --- |
| Admin | `/admin/dashboard` | Full system control: users, fees, leads, schedules, reports, profile requests, holidays, leaves, password reset, security |
| Teacher | `/teacher/dashboard` | Classes, attendance, assignments, curriculum, student progress, daily updates, leave requests |
| Counsellor | `/counsellor/dashboard` | CRM leads, follow-ups, admissions, student conversion, assigned student tracking, leave requests |
| Student | `/student/dashboard` | Self-service academics, assignments, attendance, fees, updates, profile, ID proof, certificate |

---

## 2. Shared Authentication And Account Workflows

### 2.1 Login Workflow

Screen: `/auth/login`

Visible fields and controls:

- Email Address input.
- Password input.
- Eye icon button beside password field.
- `Forgot Password?` link.
- `Sign In` button.

Detailed flow:

1. User opens the login screen.
2. User enters registered email.
3. User enters password.
4. User can click the eye icon:
   - When password is hidden, click changes input type from `password` to `text`.
   - Eye icon changes to eye-off icon.
   - Click again changes it back to hidden.
5. User clicks `Sign In`.
6. Server searches user by lowercased trimmed email.
7. User must exist and must be active/complete.
8. Password is checked with the stored hashed password.
9. If invalid:
   - Login page is shown again.
   - Error shown: invalid credentials.
10. If valid:
   - JWT cookie is created.
   - `lastLoginAt` is updated.
   - If `mustChangePassword` is true or `firstLoginCompleted` is false, user is redirected to `/auth/force-change-password`.
   - Otherwise user goes to role dashboard:
     - Admin: `/admin/dashboard`
     - Teacher: `/teacher/dashboard`
     - Counsellor: `/counsellor/dashboard`
     - Student: `/student/dashboard`

Audit notes:

- Login has a rate limit of 5 attempts per 15 minutes, skipped in test mode.
- Current controller contains debug `console.log` statements; architecture guidelines say controllers should use `utils/logger.js`.

### 2.2 Forgot Password Request Workflow

Screen: `/auth/forgot-password`

Visible fields and controls:

- Email Address input.
- Phone Number input.
- `Submit Request` button.
- `Back to Sign In` button.

Detailed flow:

1. User clicks `Forgot Password?` from login.
2. User enters registered email and phone.
3. User clicks `Submit Request`.
4. Server searches for a user with matching email and phone.
5. If no match:
   - Forgot password page is shown again.
   - Error states no user matches those details.
6. If the user is admin and there is only one active admin:
   - Request is blocked.
   - User is told recovery must be done through server command: `npm run reset-admin-password`.
7. If valid:
   - User field `resetRequested` becomes true.
   - User is redirected to login with `pwd_request=1`.

Admin visibility after request:

- Admin dashboard shows a `Pending Password Reset Requests` table.
- Admin sidebar dashboard badge can show reset request count.
- Admin user directory also exposes reset password action.

Rate limiting:

- Forgot password has a limit of 3 requests per hour, skipped in test mode.

### 2.3 Admin Password Reset Approval Workflow

Screens:

- `/admin/dashboard`
- `/admin/users`
- Reset password modal partial: `views/partials/admin-password-reset-modal.ejs`

Visible admin controls:

- `Reset Password` button.
- `Dismiss` button for reset requests on admin dashboard.
- Modal close `x`.
- New Password input.
- Show/Hide password toggle.
- `Cancel` button.
- `Save New Password` button.

Detailed flow:

1. Student/staff requests password reset from forgot-password page.
2. Admin logs in and opens dashboard.
3. Admin sees the pending request row with:
   - user name
   - role
   - email
   - phone
   - request date
   - reset/dismiss actions
4. Admin clicks `Reset Password`.
5. Modal opens and sets form action to `/admin/users/:id/reset-password`.
6. Admin enters a temporary password.
7. Admin can click `Show`:
   - password input changes to visible text.
   - button text changes to `Hide`.
8. Admin clicks `Save New Password`.
9. Frontend validates password length is at least 8.
10. Browser sends JSON request to reset endpoint.
11. Server validates again:
    - password must be at least 8 characters.
    - target user must exist.
12. Server updates the user:
    - `password` is replaced and hashed by model hook.
    - `resetRequested` becomes false.
    - `mustChangePassword` becomes true.
    - `passwordSetByAdmin` becomes true.
    - `firstLoginCompleted` becomes false.
    - `passwordChangedAt` is updated.
13. Server returns JSON success and redirect URL.
14. Frontend builds a WhatsApp Web URL using the user's phone number and temporary password.
15. Browser opens WhatsApp Web in a new tab/window.
16. Admin sends the generated message manually through WhatsApp.
17. Reset modal closes and page redirects with `pwd_reset=1`.
18. Pending request row is removed from view.

Important implementation detail:

- The app currently opens WhatsApp Web with a prefilled message. It does not automatically send WhatsApp through an API.

### 2.4 User Force Change Password Workflow

Screen: `/auth/force-change-password`

When it appears:

- First login after admin-created password.
- First login after admin reset.
- Any login where `mustChangePassword` is true or `firstLoginCompleted` is false.

Detailed flow:

1. User logs in with temporary/admin-set password.
2. App redirects to force change password page before dashboard.
3. User enters new password and confirmation.
4. Server validates:
   - password exists.
   - password length is at least 8.
   - confirmation matches.
   - password is different from current temporary password.
5. If invalid, same page shows error.
6. If valid:
   - password is updated.
   - `mustChangePassword` becomes false.
   - `passwordSetByAdmin` becomes false.
   - `firstLoginCompleted` becomes true.
   - `resetRequested` becomes false.
   - `passwordChangedAt` is updated.
7. User is redirected to their role dashboard with `pwd_changed=1`.

### 2.5 Logout Workflow

Visible control:

- Sidebar `Sign Out` button.

Detailed flow:

1. User clicks `Sign Out`.
2. App clears `token` cookie.
3. User is redirected to login.

Audit note:

- Sidebar form posts to `/logout`; `server.js` handles this route and redirects the user to `/auth/login`.

---

## 3. Shared Sidebar And Navigation Controls

The sidebar changes by role. Every role also gets:

- Inbox & Chat
- My Profile
- System Guide
- Collapse Sidebar button
- Sign Out button

Admin sidebar:

- Dashboard
- Manage Students
- Profile Requests
- Manage Teachers
- Manage Counsellors
- Manage Batches
- Announcements
- Fees & Ledger
- Lead Pipeline
- Attendance Summary
- Class Schedules
- Reports & Analytics
- Holidays & Leaves
- Security Monitor

Teacher sidebar:

- Dashboard
- My Students
- Mark Attendance
- Attendance History
- Assignments
- Daily Updates
- Leave Requests
- Announcements
- Curriculum Tracker
- Student Progress

Student sidebar:

- My Dashboard
- Assignments
- My Attendance
- Class Updates
- My Reports
- Curriculum View
- My Fee Ledger

Counsellor sidebar:

- Dashboard
- All Leads
- Add Lead
- Follow-ups
- My Students
- Pipeline Admissions
- Leave Requests
- Announcements

Badge visibility:

- Admin can see badges for reset requests, profile requests, overdue fees, pending leaves, unread messages.
- Teacher can see ungraded assignment count and unread messages.
- Counsellor can see stale lead count, total lead count, follow-up count, student count, unread messages.

---

## 4. Admin Functional Audit

### 4.1 Admin Dashboard

Screen: `/admin/dashboard`

Visible data:

- Stats cards for fees, schedules, interested leads, low-attendance students, holidays/leaves, and students.
- Pending password reset requests.
- Recent/important messages.
- Student overview links.
- Lead overview links.

Clickable controls:

- Stat cards navigate to the matching module.
- `Reset Password` opens reset modal.
- `Dismiss` clears a password reset request.
- Reply buttons navigate to student, teacher, or counsellor profile depending on sender role.
- `All Students` opens student directory.
- `All Leads` opens lead pipeline.

Expected behavior:

- Dashboard is the command center for admin.
- It should show urgent items first: password reset requests, profile requests, leaves, fees, messages.

### 4.2 User Directory

Screens:

- `/admin/users`
- `/admin/students`
- `/admin/teachers`
- `/admin/counsellors`
- `/admin/users/create`
- `/admin/users/:id/edit`

Visible controls:

- Search input.
- Role filter.
- Attendance filter on student-focused view.
- `Clear` button.
- `+ Add Student/Teacher/Counsellor/User` button.
- User name links.
- Status badge button.
- `Edit` button.
- `Reset Password` button.

Data visible:

- User name, email, phone, role, status.
- Student-specific academic and attendance context where available.
- Role profile links:
  - student opens `/admin/students/:studentProfileId`
  - teacher opens `/admin/teachers/:userId`
  - counsellor opens `/admin/counsellors/:userId`

Create/edit workflow:

1. Admin opens Add User.
2. Admin selects role and fills details.
3. Admin can upload profile picture.
4. Server validates input.
5. User is created or updated.
6. Role profile is created/updated:
   - Student profile for students.
   - Teacher profile for teachers.
   - Counsellor profile for counsellors.
7. For student creation, fee ledger and academic relation data may also be created.
8. Admin is redirected back to the role directory with success/error query.

Status toggle workflow:

1. Admin clicks status badge.
2. POST `/admin/users/:id/toggle`.
3. User active/inactive state changes.
4. Directory reloads.

Audit notes:

- Toggle is a small badge button, so it should have clear confirmation or visual status feedback to avoid accidental activation/deactivation.

### 4.3 Student Management

Screens:

- `/admin/students`
- `/admin/students/:id`
- `/admin/students/:id/certificate`

Visible data on student profile:

- Basic identity information.
- Profile picture and contact information.
- Course, batch, assigned teacher, assigned counsellor.
- Fee ledger.
- Attendance summary and records.
- Progress/test records.
- CRM/source history where available.
- Messages.
- ID verification status.
- Admin remarks.
- Student status.

Controls:

- Back to student list.
- Edit through user edit route.
- Verify ID.
- Add remark.
- Update student status.
- View certificate.
- Fee/payment links.
- Attendance/progress tabs or sections.

Workflows:

- Verify ID:
  1. Admin clicks verify.
  2. Student profile is marked verified.
  3. Student profile reloads with success state.
- Add remark:
  1. Admin enters note/remark.
  2. Server appends/admin-updates remark data.
  3. Profile reloads.
- Update status:
  1. Admin selects/sets student status.
  2. User/student status is updated.
  3. Profile reloads.
- Certificate:
  1. Admin opens certificate page.
  2. Certificate page has `Back to Portal` and `Print / Save PDF`.
  3. Browser print dialog handles PDF saving.

### 4.4 Teacher Management

Screens:

- `/admin/teachers`
- `/admin/teachers/:id`

Visible data:

- Teacher identity and contact.
- Timetable/schedules.
- Curriculum progress.
- Lesson/daily update logs.
- Messages received by teacher.

Controls:

- `Back to Teachers`.
- `Edit Profile`.
- Tabs for schedule/curriculum/updates/messages.
- Admin message form.
- `Send Note to Teacher`.

Workflow:

1. Admin opens teacher profile.
2. Admin can inspect academic activity and class schedule.
3. Admin types a message.
4. POST `/admin/messages/send`.
5. Message becomes visible to the teacher in dashboard/inbox depending on rendering.

### 4.5 Counsellor Management

Screens:

- `/admin/counsellors`
- `/admin/counsellors/:id`

Visible data:

- Counsellor identity and contact.
- Assigned lead pipeline.
- Lead statuses and ownership.
- Message history.

Controls:

- `Back to Counsellors`.
- `Edit Profile`.
- Tabs:
  - Assigned Lead Pipeline
  - Admin Messenger
- Assign lead form.
- `Send Note to Counsellor`.

Workflow:

1. Admin opens counsellor profile.
2. Admin can view assigned leads.
3. Admin can reassign a lead.
4. Admin can send a direct message to counsellor.

### 4.6 Profile Requests

Screen: `/admin/profile-requests`

Visible data:

- Student profile update requests.
- Current data and requested data should be compared in the request list.

Controls:

- `Approve`.
- `Reject`.

Workflow:

1. Student submits profile update from their profile.
2. Student update is stored as pending, not immediately applied.
3. Admin sees request.
4. Admin clicks Approve:
   - Requested fields are applied to user/student profile.
   - Pending request is cleared.
5. Admin clicks Reject:
   - Pending request is cleared without applying changes.

### 4.7 Batch Management

Screens:

- `/admin/batches`
- `/admin/batches/create`
- `/admin/batches/:id/edit`

Visible controls:

- Search/filter.
- `Clear`.
- `+ Create Batch`.
- `Edit`.
- `Delete`.
- Create/Edit form fields.
- `Cancel`.
- `Create Batch` or `Save Changes`.

Workflow:

1. Admin creates batch with course, teacher, counsellor, schedule-related details.
2. Batch is stored active.
3. On edit, related students can be synchronized with updated course/batch data.
4. Delete behavior:
   - If students exist, batch may be archived instead of deleted.
   - If no students exist, batch is deleted.
   - Confirmation prompt appears before delete.

### 4.8 Fees And Ledger

Screens:

- `/admin/fees`
- `/admin/fees/:studentId`

Visible data:

- Student fee summary.
- Total fee amount.
- Paid amount.
- Balance.
- Installments.
- Payment history.
- Discount/scholarship adjustments where present.

Controls:

- Fee filters.
- `Clear`.
- Student name link.
- `Ledger / Add Payment`.
- Add payment form.
- `Record Payment` style submit button.
- Fee adjustment form.
- `+ Add Row`.
- `X` remove installment row.
- `Save Adjustments`.

Payment workflow:

1. Admin opens a student's ledger.
2. Admin enters payment amount, mode/reference/date/note.
3. Server validates payment.
4. Payment is appended to ledger.
5. Paid amount and balance are recalculated.
6. Student user denormalized fee fields should stay synced.

Adjustment workflow:

1. Admin edits fee total/installments.
2. Admin can add/remove installment rows.
3. Admin saves adjustments.
4. Fee ledger updates.
5. Student-facing fee page should reflect changed balance/installments.

### 4.9 Lead Pipeline

Screens:

- `/admin/leads`
- `/admin/leads/:id`
- `/admin/leads/:id/convert`

Visible data:

- Lead name, phone, course interest, source, status, assigned counsellor, comments/history.
- Status and conversion state.

Controls:

- Filters.
- `Clear`.
- Lead name link.
- Assign form.
- `Assign`.
- `Convert`.
- `Back to Pipeline`.
- Phone call link.
- `Save Log Note`.
- Convert form.
- `Back to Lead`.
- `Add Installment`.
- Installment `Delete`.
- `Cancel`.
- `Confirm & Enroll Student`.

Lead assignment workflow:

1. Admin selects counsellor.
2. Clicks `Assign`.
3. Lead `assignedTo` is updated.
4. Lead is visible in counsellor pipeline.

Lead comment workflow:

1. Admin opens lead detail.
2. Admin enters comment/log note.
3. Server appends comment/history.
4. Lead timeline updates.

Admin conversion workflow:

1. Admin opens lead convert page.
2. Admin fills student enrollment details, course, batch, teacher, counsellor, credentials, fee, paid amount, installments.
3. Admin can add/remove installment rows.
4. Admin clicks `Confirm & Enroll Student`.
5. Server validates email/password and duplicate student/fee conditions.
6. User is created with student role.
7. Student profile is created.
8. Fee ledger is created.
9. Lead status becomes admission completed/converted and linked to student.
10. Student can now log in and should be forced to change password.

Policy detail:

- Counsellor conversion requires minimum 50 percent down payment.
- Admin conversion can bypass the 50 percent rule, but should record discount/bypass note.

### 4.10 Attendance Summary

Screen: `/admin/attendance`

Visible data:

- Monthly attendance calendar.
- Batch filters.
- Student attendance rows.
- Holiday indicators.
- Present/absent/late counts and percentages.

Controls:

- Month and batch filter form.
- Clickable day cards.
- Batch attendance links.

Expected behavior:

- Admin can inspect attendance but does not mark attendance here.
- Teacher is responsible for marking attendance.
- Holidays are displayed as non-working context.

### 4.11 Schedules, Timetables, Classrooms

Screens:

- `/admin/schedules`
- `/admin/schedules/create`
- `/admin/schedules/:id/edit`

Visible controls:

- Schedule filters/tabs.
- `Create Schedule`.
- Edit schedule.
- Delete schedule.
- Timetable save/delete.
- Classroom create/edit/delete.
- `Cancel`.
- `Schedule Class` or `Update Schedule`.

Workflow:

1. Admin creates class schedule with teacher, course, batch, classroom, date, time.
2. Schedule is saved.
3. Notifications may be created for assigned teacher and students.
4. Admin can edit schedule; notifications may be updated.
5. Admin can delete schedule.
6. Admin can save timetable templates.
7. Admin can delete timetable templates and related generated schedules.
8. Admin can manage classrooms.

### 4.12 Reports And Analytics

Screen: `/admin/reports`

Visible tabs:

- Overview
- Financial
- Enrollment
- Attendance
- Academic
- Staff

Visible controls:

- Date/batch/course filters.
- `Export CSV`.
- Chart toggles:
  - Target
  - Actual
  - Expenses
  - Net Profit
- Save revenue target form.
- Log expense form.
- Delete expense.
- Send Message from report rows.
- View Fee.
- View Attendance.

Workflow:

1. Admin selects date range and filters.
2. Reports recalculate on GET query.
3. Admin exports CSV using current filter params.
4. Admin can set revenue target.
5. Admin can log expense.
6. Admin can delete expense after confirmation.

### 4.13 Holidays And Leaves

Screen: `/admin/holidays-leaves`

Visible controls:

- Tabs:
  - Academy Holidays
  - Staff Leaves
- Holiday creation form.
- `Save Holiday`.
- Holiday `Delete`.
- Staff leave `Approve`.
- Staff leave `Reject`.

Workflow:

1. Admin adds holiday.
2. Holiday becomes visible in attendance/report contexts.
3. Teacher or counsellor submits leave request.
4. Admin approves or rejects.
5. Leave status updates and should be visible to staff member.

### 4.14 Announcements

Screens:

- `/admin/announcements`
- `/admin/announcements/create`

Controls:

- `+ Create Announcement`.
- Announcement form.
- `Cancel`.
- `Create Announcement`.
- Toggle active/inactive button.

Workflow:

1. Admin creates announcement with audience targeting.
2. Announcement becomes visible to relevant users.
3. Admin can toggle announcement active/inactive.

### 4.15 Security Monitor

Screen:

- `/admin/security/dashboard`

Related routes:

- `/admin/security/alerts`
- `/admin/security/blacklist`
- `/admin/security/unblacklist`
- `/admin/security/otp/:userId`
- `/admin/security/fee-audit`

Expected admin capabilities:

- View security dashboard.
- View alerts.
- Blacklist/unblacklist tokens or users depending on route implementation.
- Inspect OTP/security helper data.
- Inspect fee audit logs.

Audit note:

- Security route should be reviewed separately for data sensitivity, because admin-only security pages can expose highly sensitive behavior logs.

---

## 5. Teacher Functional Audit

### 5.1 Teacher Dashboard

Screen: `/teacher/dashboard`

Visible data:

- Today/upcoming schedule.
- Attendance summary card.
- Assignment summary card.
- Admin alerts/messages.
- Active assignments.
- Daily updates.

Controls:

- Stat card to attendance.
- Stat card to assignments.
- `Mark Complete` on schedule.
- Complete schedule modal:
  - `Cancel`
  - `Submit & Complete`
- `All Assignments`.
- Assignment title link.
- `All Updates`.

Workflow:

1. Teacher sees today's work.
2. Teacher clicks `Mark Complete`.
3. Modal opens.
4. Teacher submits completion.
5. Schedule status becomes complete.

### 5.2 Attendance Marking

Screen: `/teacher/attendance`

Visible controls:

- Batch/course/date filters.
- `Reset`.
- `Mark All Present`.
- `Mark All Absent`.
- Per-student attendance controls.
- `Save Attendance Sheet`.

Workflow:

1. Teacher filters/selects class/date.
2. Student roster is displayed.
3. Teacher marks each student present/absent/late or uses bulk buttons.
4. Teacher clicks save.
5. Server upserts attendance records.
6. Admin summary and student attendance pages reflect the update.

### 5.3 Attendance History

Screen: `/teacher/attendance/history`

Visible controls:

- Filters.
- `Reset Filters`.
- Session `Details` button.
- Details modal close button.

Workflow:

1. Teacher filters attendance history.
2. Teacher opens session details.
3. Modal shows roster/status data.

### 5.4 Assignments

Screens:

- `/teacher/assignments`
- `/teacher/assignments/create`
- `/teacher/assignments/:id`

Visible controls:

- `+ Create Assignment`.
- Assignment title link.
- `View Submissions`.
- Assignment create form.
- File upload.
- `Publish Assignment`.
- `Cancel`.
- Assignment detail back button.
- `Extend Deadline`.
- Download assignment file.
- Submission status filters:
  - All
  - Pending
  - Submitted
  - Graded
  - Late
  - Overdue
- Download submitted file.
- `Grade`.
- Grade modal:
  - marks input
  - feedback input
  - `Cancel`
  - `Save Grade`
- Extend modal:
  - new due date
  - `Cancel`
  - `Extend Deadline`

Workflow:

1. Teacher publishes assignment for batch/course with optional file.
2. Students see it on assignment page.
3. Student uploads submission.
4. Teacher opens assignment detail and filters submissions.
5. Teacher downloads submission if needed.
6. Teacher opens grade modal.
7. Teacher enters marks/feedback and saves.
8. Student sees graded status, marks, and feedback.
9. Teacher may extend deadline; due date changes for all students.

### 5.5 Daily Updates

Screens:

- `/teacher/updates`
- `/teacher/updates/create`

Controls:

- `+ Post Daily Update`.
- File download links.
- Create update form.
- File upload.
- `Post Updates`.
- `Cancel`.

Workflow:

1. Teacher posts class update.
2. Update appears to assigned students.
3. Attached file can be downloaded by students.

### 5.6 Curriculum Tracker

Screens:

- `/teacher/curriculum`
- `/teacher/curriculum/:id`

Controls:

- Curriculum link.
- `Edit / Toggle Topics`.
- Initialize syllabus form.
- `Initialize Syllabus Track`.
- Topic completion toggle.
- Add topic form.
- `Append Topic Module`.

Workflow:

1. Teacher initializes curriculum tracking for course/batch.
2. Teacher opens detail.
3. Teacher adds topics.
4. Teacher toggles completed topics.
5. Student curriculum view shows topic completion/progress.

### 5.7 Student Progress

Screen: `/teacher/progress`

Controls:

- Filters.
- `Reset`.
- Tabs:
  - Progress Board
  - Bulk Test Entry
  - Test History
- View student tests.
- Add test result.
- Save remark.
- Bulk score form.
- `Save Test Scores`.
- `Cancel Edit`.
- Edit test.
- Delete test with confirmation.
- Single test modal:
  - `Cancel`
  - `Log Test Score`
- Remark modal:
  - `Cancel`
  - `Save Remarks`
- View tests modal:
  - `Close`

Workflow:

1. Teacher filters by batch/course.
2. Teacher logs individual or bulk test scores.
3. Server stores progress records.
4. Teacher can add remarks per student.
5. Student progress page and admin student profile show updated academic performance.
6. Teacher can edit/delete test history.

### 5.8 My Students

Screen: `/teacher/students`

Visible controls:

- Search/filter.
- `Clear`.
- Student rows.
- `Grade Tasks`.
- `Add test result`.
- Student profile modal close.
- Modal tabs:
  - Attendance
  - Assignments
  - Test Marks

Workflow:

1. Teacher opens My Students.
2. Teacher filters students.
3. Teacher clicks a student row/profile control.
4. Frontend fetches student profile summary.
5. Modal shows student attendance, assignments, and grades.
6. Teacher can jump to assignments or progress entry.

### 5.9 Leave Requests

Screen: `/teacher/leaves`

Controls:

- Leave request form.
- `Submit Leave Request`.

Workflow:

1. Teacher fills leave type/date/reason.
2. Request is stored pending.
3. Admin sees it in Holidays & Leaves.
4. Admin approves/rejects.
5. Teacher sees status in leave page.

### 5.10 Teacher Announcements

Screens:

- `/teacher/announcements`
- `/teacher/announcements/create`

Controls:

- `+ Post to Batch`.
- Form.
- `Post Announcement`.
- `Cancel`.
- Toggle active/inactive.

Workflow:

1. Teacher creates batch announcement.
2. Relevant students see announcement.
3. Teacher can toggle announcement active/inactive.

---

## 6. Counsellor Functional Audit

### 6.1 Counsellor Dashboard

Screen: `/counsellor/dashboard`

Expected visible data:

- Assigned lead count.
- Active pipeline.
- Due follow-ups.
- Conversion/admission metrics.
- Recent leads or follow-ups.

Controls:

- Links to all leads, follow-ups, students, and admissions.

### 6.2 Leads

Screens:

- `/counsellor/leads`
- `/counsellor/leads/create`
- `/counsellor/leads/new`
- `/counsellor/leads/:id`
- `/counsellor/leads/:id/edit`

Visible controls:

- Lead filters.
- Create/add lead.
- Edit lead.
- Add follow-up.
- Edit follow-up.
- Mark ready.
- Mark lost.
- Convert.
- Phone/contact links where present.

Lead creation workflow:

1. Counsellor opens Add Lead.
2. Counsellor fills lead name, phone, email/course/source/status/follow-up information.
3. Server validates through lead validator.
4. Lead is created and assigned to counsellor.
5. Lead appears in All Leads and dashboard counts.

Follow-up workflow:

1. Counsellor opens lead detail.
2. Counsellor adds follow-up comment/date/outcome.
3. Lead history is updated.
4. If next follow-up is due, count appears in sidebar/dashboard.
5. Existing follow-up can be edited through indexed edit route.

Status workflow:

1. Counsellor can mark lead ready for admission.
2. Counsellor can mark lead lost.
3. Status controls should follow allowed transition rules from architecture guide.

### 6.3 Walk-in Leads

Route:

- POST `/counsellor/leads/walkin`

Expected workflow:

1. Counsellor records walk-in enquiry.
2. Lead is created quickly from minimal data.
3. Lead appears in counsellor pipeline.

### 6.4 Lead Conversion And Admission

Screens:

- `/counsellor/leads/:id/convert`
- `/counsellor/admissions`
- `/counsellor/admissions/:id/fee`

Controls:

- Convert form.
- Fee/payment details display.
- Admissions list filters.
- Student fee detail view.

Counsellor conversion workflow:

1. Counsellor opens a ready lead.
2. Counsellor starts conversion.
3. Counsellor fills student details, batch/course/teacher, login credentials, total fees, paid amount, installments.
4. Server validates email uniqueness and password length.
5. Server enforces minimum 50 percent down payment.
6. If paid amount is less than required:
   - Conversion fails.
   - Convert form re-renders with error.
7. If valid:
   - Student user is created.
   - Student profile is created.
   - Fee ledger is created.
   - Lead status becomes admission completed.
   - Student is linked back to lead/counsellor.
8. Student can log in and should be forced to change temporary password.

### 6.5 My Students And Admissions

Screens:

- `/counsellor/students`
- `/counsellor/admissions`
- `/counsellor/admissions/:id/fee`

Visible data:

- Students assigned to counsellor.
- Converted leads/admissions.
- Fee status for admitted students.

Controls:

- Student links.
- Fee detail link.

Workflow:

1. Counsellor reviews converted/admitted students.
2. Counsellor can inspect fee ledger in read-oriented admissions fee view.
3. Counsellor should only see students related to own counsellor profile unless admin is accessing.

### 6.6 Follow-ups

Screen:

- `/counsellor/leads/followups`

Visible data:

- Leads with due/upcoming follow-ups.
- Lead contact information.
- Next follow-up date.
- Follow-up status.

Workflow:

1. Counsellor opens follow-ups.
2. Counsellor calls/messages lead outside system as needed.
3. Counsellor records follow-up on lead detail.
4. Lead moves through pipeline statuses.

### 6.7 Leave Requests

Screen:

- `/counsellor/leaves`

Controls:

- Leave request form.
- `Submit Leave Request`.

Workflow:

1. Counsellor submits leave.
2. Admin approves/rejects under Holidays & Leaves.
3. Counsellor sees current status.

### 6.8 Counsellor Reports

Screen:

- `/counsellor/reports`

Expected visible data:

- Lead conversion metrics.
- Assigned lead performance.
- Admissions and follow-up outcomes.

### 6.9 Counsellor Announcements

Screens:

- `/counsellor/announcements`
- `/counsellor/announcements/create`

Controls:

- Create announcement.
- `Post Announcement`.
- Toggle active/inactive.

Workflow:

1. Counsellor creates announcement.
2. Target audience sees it based on controller rules.
3. Counsellor can toggle active/inactive.

---

## 7. Student Functional Audit

### 7.1 Student Dashboard

Screen:

- `/student/dashboard`

Visible data:

- Attendance summary.
- Assignment summary.
- Fee due summary.
- Document verification reminder.
- Profile completion/update prompt.
- Certificate availability if eligible.
- Recent assignments.
- Recent class updates.

Controls:

- `Complete Document Verification`.
- `Update profile`.
- `Download Completion Certificate`.
- Attendance stat card.
- Assignments stat card.
- Fees stat card.
- Upload ID proof form.
- `Upload ID Proof`.
- `All Assignments`.
- Assignment title link.
- `All Updates`.

Workflow:

1. Student opens dashboard.
2. Student sees urgent tasks: ID proof, fees, assignments.
3. Student can upload ID proof.
4. Admin later verifies ID.
5. If student qualifies, certificate link opens certificate.

### 7.2 Student Assignments

Screen:

- `/student/assignments`

Visible data:

- Assignment title, due date, status.
- Teacher file download.
- Submission status.
- Existing submitted file download.
- Grade and feedback where available.

Controls:

- Download assignment file.
- `Submit` / upload button.
- Submit modal close.
- File input.
- `Cancel`.
- `Upload Submission`.

Workflow:

1. Student opens assignments.
2. Student downloads assignment file if present.
3. Student clicks submit/upload.
4. Modal opens.
5. Student selects file.
6. Student clicks `Upload Submission`.
7. Server stores submission in assignment.
8. Teacher sees submission in assignment detail.
9. Teacher grades it.
10. Student sees graded result.

### 7.3 Student Attendance

Screen:

- `/student/attendance`

Controls:

- Filter form.
- `Clear`.

Visible data:

- Student's own attendance only.
- Attendance percentage.
- Daily/session status history.

Workflow:

1. Teacher marks attendance.
2. Student opens attendance.
3. Student can filter by month/date context.
4. Student sees present/absent/late records.

### 7.4 Class Updates

Screen:

- `/student/updates`

Controls:

- Filter form.
- `Clear`.
- Download attached update file.

Visible data:

- Updates from assigned teacher/batch.
- Date, title/content, file attachment.

Workflow:

1. Teacher posts daily update.
2. Student sees update in dashboard and updates page.
3. Student downloads attachment if present.

### 7.5 Student Progress / Reports

Screen:

- `/student/progress`

Visible data:

- Test scores.
- Marks, total marks, percentage.
- Teacher remarks.
- Academic history.

Workflow:

1. Teacher logs score or remark.
2. Student opens My Reports.
3. Student sees updated academic record.

### 7.6 Curriculum View

Screen:

- `/student/curriculum`

Visible data:

- Course curriculum.
- Topics/modules.
- Completion status.
- Completion percentage.

Workflow:

1. Teacher initializes curriculum and toggles topics.
2. Student sees completed and pending topics.

### 7.7 Fee Ledger

Screen:

- `/student/fees`

Visible data:

- Total fee.
- Paid amount.
- Balance.
- Installments.
- Payment history.

Workflow:

1. Admin creates or updates fee ledger.
2. Student opens My Fee Ledger.
3. Student sees current financial status.
4. Student cannot directly edit ledger.

### 7.8 Feedback

Route:

- POST `/student/feedback`

Visible screen:

- `views/student/feedback.ejs`

Controls:

- Feedback form.
- `Submit Feedback & Open Dashboard`.

Workflow:

1. Student submits feedback.
2. Server stores feedback ratings/comments.
3. Student is redirected/opened to dashboard.

### 7.9 Certificate

Route:

- `/student/certificate`

Workflow:

1. Student opens certificate if eligible.
2. Certificate renders for download/print depending on certificate view behavior.

---

## 8. Shared Inbox, Chat, Notifications, And Profile

### 8.1 Inbox And Chat

Screen:

- `/auth/inbox`

Routes:

- GET `/auth/inbox`
- GET `/auth/inbox/messages`
- POST `/auth/inbox/send`
- POST `/auth/inbox/react`
- POST `/auth/messages/:id/edit`
- PUT `/auth/messages/:id/edit`
- GET `/auth/inbox/user-profile/:id`

Expected visible controls:

- Contact list.
- Chat selection.
- Message input.
- Attachment upload, up to 5 files.
- Send button.
- Read state.
- Reaction controls.
- Edit message control inside allowed edit window.

Role-based visibility:

- Admin can access broad user contacts.
- Teacher can access relevant students/counsellors/admin depending on controller contact logic.
- Counsellor can access assigned students/teachers/admin depending on controller contact logic.
- Student can access assigned teacher/counsellor/admin contacts depending on controller contact logic.

Workflow:

1. User opens inbox.
2. User selects contact.
3. Chat history loads.
4. User sends text and optional attachments.
5. Message appears in recipient inbox/notifications.
6. Recipient opens chat; unread messages become read.
7. User can react to message.
8. User can edit message if permitted.

### 8.2 Notifications

Routes:

- POST `/auth/notifications/:id/read`
- POST `/auth/notifications/read-all`

Workflow:

1. User receives system/message notification.
2. User marks one as read or all as read.
3. Badge counts update.

### 8.3 Profile Update

Screen:

- `/auth/profile`

Controls:

- Profile form.
- Profile picture upload.
- Change password form.

Workflow for students:

1. Student edits profile.
2. Student submits.
3. Changes are stored in `pendingProfileUpdate`.
4. Admin sees request in Profile Requests.
5. Admin approves or rejects.

Workflow for staff/admin:

1. Staff/admin edits profile.
2. Server updates user immediately.
3. Profile reloads with success.

Change password workflow:

1. User enters current password and new password.
2. Server validates current password.
3. New password must meet length rule.
4. Password is updated and hashed.

---

## 9. Data Visibility Matrix

| Data | Admin | Teacher | Counsellor | Student |
| --- | --- | --- | --- | --- |
| All users | Full | No | No | No |
| Own profile | Yes | Yes | Yes | Yes |
| Student profile | Full | Assigned/teaching context | Assigned counselling context | Own only |
| Fees | Full edit | No direct edit | View assigned admission fee detail | Own ledger only |
| Attendance | Full overview | Mark and history for assigned classes | No main marking flow | Own records only |
| Assignments | View through reports/profiles | Create, manage, grade | No | View and submit own |
| Curriculum | View through teacher/student context | Create/toggle | No | View only |
| Leads | Full pipeline | No | Assigned pipeline | No |
| Schedules | Full create/edit/delete | View and complete own classes | No main schedule control | View through dashboard where implemented |
| Holidays | Create/delete | View indirectly | View indirectly | View indirectly |
| Leaves | Approve/reject | Submit own | Submit own | No |
| Announcements | Create/toggle broad | Create/toggle teacher announcements | Create/toggle counsellor announcements | View relevant |
| Messages | Broad | Role-related contacts | Role-related contacts | Assigned contacts |
| Security | Full admin-only | No | No | No |

---

## 10. High-Risk Or Follow-up Audit Items

These are items that should be verified or cleaned up before considering the audit complete.

1. Debug logging in controllers:
   - `authController.js` and `admin/passwordController.js` contain `console.log`/`console.error`.
   - Architecture guide says controllers should use `utils/logger.js`.

2. WhatsApp password delivery:
   - Current system opens WhatsApp Web with prefilled text.
   - It does not automatically send the message.
   - Product wording should say "admin sends via WhatsApp" unless WhatsApp API integration is added.

3. Password reset security:
   - Temporary password is visible in browser and inserted into WhatsApp text.
   - This is operationally convenient but should be treated as sensitive.
   - Audit should decide whether to keep manual temporary password, generate one server-side, or send a one-time reset link.

4. Status transition enforcement:
   - Architecture guide defines lead status transitions.
   - Confirm every admin/counsellor lead route enforces the transition rules.

5. Accidental destructive actions:
   - Delete buttons exist for batches, holidays, schedules, classrooms, expenses, tests.
   - Some have confirmation prompts.
   - Verify all destructive actions have confirmation and success/error feedback.

6. Role data boundaries:
   - Counsellor and teacher controllers should be checked for ownership filtering so staff cannot see unrelated students/leads.
   - Admin bypass is expected, but staff bypass should be blocked.

7. Student profile requests:
   - Verify admin view clearly shows old value vs requested value before approve/reject.

8. Fee audit:
   - Because fee edits and payments affect financial records, confirm fee audit logging covers add payment, fee update, discount, installment changes, and expense changes.

9. Mobile navigation:
   - Sidebar collapse, mobile menu, modal overflow, and table responsiveness should be manually tested for all role dashboards.

---

## 11. End-to-End Workflow Checklist

### Login And Password Reset

- User can login with correct credentials.
- Incorrect password shows safe error.
- Eye icon shows/hides password.
- Forgot password validates email and phone.
- Reset request appears on admin dashboard.
- Admin reset modal opens from dashboard.
- Admin reset modal opens from user directory.
- Show/Hide works inside reset modal.
- Password shorter than 8 is rejected in browser and server.
- Successful reset clears request.
- WhatsApp Web opens with correct phone and message.
- User logs in with temporary password.
- User is forced to choose a new password.
- User cannot reuse temporary password.
- User lands on correct dashboard after password change.

### Admin

- Admin can create/edit/toggle users.
- Admin can reset any non-blocked user's password.
- Admin can approve/reject student profile requests.
- Admin can create/edit/delete/archive batches.
- Admin can view student profile tabs.
- Admin can verify student ID proof.
- Admin can add student remarks.
- Admin can update student status.
- Admin can view teacher/counsellor profiles.
- Admin can send messages to staff.
- Admin can add payments.
- Admin can adjust fee ledger.
- Admin can assign leads.
- Admin can comment on leads.
- Admin can convert leads.
- Admin can create/edit/delete schedules.
- Admin can manage timetables.
- Admin can manage classrooms.
- Admin can export reports.
- Admin can set targets and log expenses.
- Admin can create/delete holidays.
- Admin can approve/reject leaves.
- Admin can create/toggle announcements.
- Admin can access security dashboard.

### Teacher

- Teacher can view dashboard schedule.
- Teacher can mark class complete.
- Teacher can mark attendance.
- Teacher can use mark all present/absent.
- Teacher can view attendance history details.
- Teacher can create assignment.
- Teacher can view submissions.
- Teacher can grade submissions.
- Teacher can extend deadlines.
- Teacher can post daily updates.
- Teacher can initialize curriculum.
- Teacher can add/toggle topics.
- Teacher can log individual test scores.
- Teacher can bulk upload/save test scores.
- Teacher can edit/delete test history.
- Teacher can add student remarks.
- Teacher can inspect assigned student modal.
- Teacher can apply for leave.
- Teacher can create/toggle announcements.

### Counsellor

- Counsellor can create lead.
- Counsellor can create walk-in lead.
- Counsellor can edit lead.
- Counsellor can add/edit follow-up.
- Counsellor can mark ready.
- Counsellor can mark lost.
- Counsellor can convert lead with 50 percent minimum payment rule.
- Counsellor can view assigned students.
- Counsellor can view admissions.
- Counsellor can view assigned student fee detail.
- Counsellor can apply for leave.
- Counsellor can view reports.
- Counsellor can create/toggle announcements.

### Student

- Student can view dashboard.
- Student can upload ID proof.
- Student can request profile update.
- Student can view assignments.
- Student can download assignment files.
- Student can upload submission.
- Student can view marks and feedback.
- Student can view own attendance.
- Student can view class updates.
- Student can download update files.
- Student can view progress reports.
- Student can view curriculum completion.
- Student can view own fee ledger.
- Student can submit feedback.
- Student can download/view certificate when eligible.

---

## 12. Recommended Next Audit Pass

This document is the functional map. The next pass should be a live QA pass with real seeded users:

1. Start the app.
2. Login as one user per role.
3. Click every sidebar item.
4. Submit every form with valid data.
5. Submit every form with invalid data.
6. Confirm data appears in the downstream role screen.
7. Confirm role boundaries by trying to open another role's URLs directly.
8. Record screenshots for each final approved workflow.
