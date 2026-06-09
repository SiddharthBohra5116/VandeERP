# Vande Digital Academy ERP & CRM System Guide

Welcome to the official system guide for the **Vande Digital Academy ERP & CRM**. This document is written in plain, non-technical language to give you a complete, high-level picture of how the system works, what modules are built, and how each role interacts with the platform.

---

## 🌟 Introduction & Theme
The Vande Digital Academy ERP & CRM is a unified, offline-first management platform designed specifically for managing students, academic schedules, curriculum tracking, fee ledgering, and sales lead pipelines. 

To match the premium branding of the academy, the application features a custom, high-end **dark-gold luxury user interface** with smooth animations, clear statuses, and responsive layouts for both mobile and desktop screens.

---

## 👥 Role-Based Portals

The system provides 4 specialized workspaces tailored to the actions each person performs:

### 1. The Administrator Portal (Admin)
The Admin has full visibility and control over all financial, operational, and user data.
* **Interactive Profiles**: Clicking on any user in the directory opens an interactive, tabbed dashboard displaying their entire record.
* **Broad Dashboard**: Visual insights into total active students, sales conversion rates, monthly fees collected, and academic logs.
* **Direct Teacher Messaging**: Admins can send urgent notes or reminders straight to any teacher’s dashboard.

> [!NOTE]
> **[IMAGE PLACEHOLDER: Admin Dashboard Overview]**
> *Suggest inserting a screenshot here showing the Admin dashboard overview with the stats cards (Total Students, Active Leads, Fees Collected).*

---

### 2. The Teacher Workspace
Teachers can manage their classrooms, attendance, and student progress on a daily basis.
* **Timetable & Schedule**: Shows today's and upcoming classes chronologically.
* **Admin Alerts**: Displays instant notifications or instructions sent by the administrator.
* **Attendance Management**: Quick interface to mark students as Present, Absent, or Late.
* **Assignment Manager**: Post homework files, set deadlines, and grade student submissions.
* **Syllabus completion**: Track curriculum completion percentage and tick off completed topics.

> [!NOTE]
> **[IMAGE PLACEHOLDER: Teacher Workspace Dashboard]**
> *Suggest inserting a screenshot here showing the new two-column Teacher dashboard with the Admin Alerts and Timetable on the left, and Active Assignments and Updates on the right.*

---

### 3. The Counsellor CRM Workspace
Counsellors handle prospective candidates (leads) and convert them into registered students.
* **Sales Pipeline**: Group leads by status (New, Contacted, Interested, Converted, Lost).
* **Communication Log**: Add comments and track the conversation history of each lead.
* **Conversion Analytics**: Track performance stats such as assigned leads, active pipeline, and student conversion rate percentage.

> [!NOTE]
> **[IMAGE PLACEHOLDER: Counsellor CRM Pipeline]**
> *Suggest inserting a screenshot here showing the Counsellor portal dashboard with pipeline conversion stats and lead detail comments form.*

---

### 4. The Student Portal
Students have a self-service workspace to monitor their classes, assignments, and payments.
* **Academics Tracker**: Check test scores, view grade reports, and read teacher feedback.
* **Assignment Workspace**: View assignment requirements, download project materials, and upload submission files.
* **Attendance Rate**: Check their marked attendance history and overall attendance percentage.
* **Curriculum Progress**: View the course syllabus and see what topics are completed.
* **Fee Ledger**: Transparent view of total fee dues, payments made, installments, and active receipts.

---

## 🛠️ Key System Features

### 🆔 1. Intelligent Structured Roll Numbers
Every person in the system receives a unique, structured identifier upon registration. The ID structure follows the format:
`VD - [ROLE] - [DEPT] - [YEAR] - [SERIAL]`

* **For Students**: `VD-STU-VE-26-001` (Student, Video Editing, Year 2026, Serial 001)
* **For Teachers**: `VD-TCH-VE-26-002` (Teacher, Video Editing, Year 2026, Serial 002)
* **For Counsellors**: `VD-CNS-XX-26-001` (Counsellor, General Department, Year 2026)

By looking at the Roll Number, you immediately know their role, course department, enrollment year, and their sequential registry ID.

---

### 💼 2. Interactive Admin Detailing Pages

#### Student Detailed Profile
Clicking a student’s name in the Admin panel opens a profile showing:
1. **Assigned Staff**: Primary teacher and lead counsellor names.
2. **Fee Ledger Tab**: Real-time listing of payments made, UPI/cash transactions, remaining balance, and custom scholarship discounts.
3. **Attendance Tab**: Counter of Present vs. Absent days, alongside an automated attendance percentage rate.
4. **Progress Tab**: Logs of test dates, names, scores out of total, percentage achievements, and custom teacher remarks.
5. **CRM History Tab**: Displays original lead source, counselor follow-up dates, and counselor comments.

> [!NOTE]
> **[IMAGE PLACEHOLDER: Student Interactive Detail View]**
> *Suggest inserting a screenshot here showing the Admin's view of a student's profile, focusing on the active tabs like Fee Ledger and test scores.*

#### Teacher Detailed Profile
Clicking a teacher’s name in the Admin panel opens a profile showing:
1. **Timetable Calendar**: Logs of all schedules (both completed and upcoming) showing times and statuses.
2. **Syllabus tracker**: Live completion progress bar based on topics finished.
3. **Lesson Logs**: Chronological stream of updates posted by the teacher.
4. **Direct Messaging Form**: Quick comment field to type a message and push it to the teacher’s dashboard instantly.

---

### 💬 3. Lead Comments & History Log (CRM)
In the sales pipeline, clicking a lead opens a timeline of all past discussions. Users can:
* Post a comment directly onto the lead card.
* View past updates in a timeline format showing which counselor handled the lead, what note was recorded, and when the change occurred.

---

## 🔒 Security & User Experience
* **Role-Based Guards**: A student cannot access the teacher or admin routes. Any unauthorized access triggers an elegant, themed Access Denied page.
* **Auto-hashing**: User passwords are encrypted on the database level for maximum privacy.
* **Responsive Layouts**: Collapsible sidebar menu for tablets and smartphones.
* **Alert Notifications**: Success and error messages automatically fade out after 5 seconds for a clean visual experience.
