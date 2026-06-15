# Model Update Summary

Updated files in this ZIP:

## Student.js
- Changed `batch` from String to `ObjectId` ref `Batch`.
- Added `pendingProfileUpdate` for student profile approval flow:
  - name
  - phone
  - profilePic
  - fatherName
  - motherName
  - address
  - city
  - dob
  - requestedAt
- Added indexes for course, batch, counsellor, and teacher.
- Kept fee virtuals and roll number generation.

## Curriculum.js
- Changed `batch` from String to `ObjectId` ref `Batch`.
- Kept unique index `{ course: 1, batch: 1 }`.
- Kept `completedCount` virtual.
- Added `completionPct` virtual. It works when `course` is populated with modules/topics.
- Kept virtual serialization with `toJSON` and `toObject`.

## Already aligned files
These already match the new architecture and were kept:
- Course.js
- Batch.js
- Fee.js
- Schedule.js
- Timetable.js
- Attendance.js
- Assignment.js
- Progress.js
- DailyUpdate.js
- Lead.js
- LeadActivity.js
- Message.js
- Expense.js
- Holiday.js
- LeaveRequest.js
- RevenueTarget.js
- User.js
- Teacher.js
- Counsellor.js
- Classroom.js
- Counter.js
- Announcement.js

# Required non-model changes

## middleware/auth.js
For student users, fetch Student profile and attach profile fields to req.user:
- req.user.studentProfileId
- req.user.batch
- req.user.course
- req.user.teacher
- req.user.counsellor
- req.user.idProof
- req.user.idVerified
- req.user.feedback
- req.user.remarks
- req.user.statusHistory
- req.user.fatherName
- req.user.guardianPhone
- req.user.pendingProfileUpdate

## controllers/authController.js
When student updates profile, write the request to:
`Student.findOneAndUpdate({ userId: req.user._id }, { pendingProfileUpdate: ... })`

Do not write student pending profile changes to User anymore.

## seeder.js
Change:
`batch: b.name`
to:
`batch: b._id`

Also Student creation must use the Batch document id:
`batch: batchDoc._id`

Fee creation should include:
`courseDurationMonths: selectedCourse.durationMonths`

## controllers/student/*
If auth middleware enrichment is added, old controllers using `req.user.batch`, `req.user.teacher`, etc. will keep working temporarily.

Long term, update student controllers to explicitly query:
`Student.findOne({ userId: req.user._id })`
