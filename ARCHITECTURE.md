# BasicERPAcademy — Architecture Decisions & Guidelines

This document details the architectural patterns, coding standards, database constraints, and synchronization policies established across the academy codebase. Refer to this guide before writing any new features or modifying existing code.

---

## 1. Directory Structure & Facade Patterns
We enforce a strict modular facade pattern across all controllers to maintain clean route declarations.
- **Controllers Facades**:
  - `controllers/adminController.js` is a facade exporting all sub-controllers in `controllers/admin/`.
  - `controllers/teacherController.js` is a facade exporting all sub-controllers in `controllers/teacher/`.
  - `controllers/studentController.js` is a facade exporting all sub-controllers in `controllers/student/`.
  - `controllers/counsellorController.js` is a facade exporting all sub-controllers in `controllers/counsellor/`.
- **Naming Casing Conventions**: All controller filenames must use PascalCase (e.g., `attendanceController.js`, `assignmentController.js`).
- **Facade Rule**: When adding a new function to any controller domain, create it in the corresponding sub-controller file. Never add functions directly to the facade file. The facade only spreads and re-exports sub-controller methods.

---

## 2. Lead Conversion Flows & Policies
The administrator and counsellor lead conversion routes are mirrored operations and **must always be updated together**:
- **Admin Conversion Flow**: [admin/leadController.js](file:///d:/BasicERPAcademy/controllers/admin/leadController.js) $\rightarrow$ `postConvertLead`
- **Counsellor Conversion Flow**: [counsellor/admissionController.js](file:///d:/BasicERPAcademy/controllers/counsellor/admissionController.js) $\rightarrow$ `postConvertLead`

### Key Policies:
1. **Validation & Initial Audit Logs**: Both conversion flows must validate input parameters (valid email, password length >= 8), verify email uniqueness, and push an initial enrollment history entry to the `statusHistory` array on student creation.
2. **Duplicate Ledger Conflicts**: Both flows must wrap the `Fee` ledger creation in a `try/catch` block to intercept `E11000` duplicate key index errors and re-render the convert form directly with a detailed error message.
3. **Batch Fallback**: If no batch is selected, the fallback batch name must be `'General Batch'`.
4. **50% Down Payment Policy**:
   - **Counsellor flow**: A minimum 50% down payment is a hard block. If the paid amount is less than 50% of the total fees, the conversion must fail and return an error.
   - **Admin flow**: Admins can bypass this check. If they do, a discount note must be generated automatically (`'Admin bypassed 50% down payment requirement'`), but the conversion will proceed.

---

## 3. Date & Timezone Handling
To prevent offset bugs between Indian Standard Time (IST) and server UTC timezones:
- **IST Formatting**: Always use `todayIST()` or `formatDateLocal(date)` from `utils/dateHelper` for date strings (`YYYY-MM-DD`). Never use `.toISOString().split('T')[0]` or UTC formatting for daily queries.
- **Timetable Grouping**: Day name lookups must explicitly resolve using the `Asia/Kolkata` timezone to prevent off-by-one errors near midnight:
  ```javascript
  new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(dateObj)
  ```

---

## 4. Security, Validation & Input Sanitization
- **POST Request Validation**: All post bodies must be bound to server-side validators (using `express-validator` middleware under `middleware/validators/`).
- **Input Bounds**: Numeric rating attributes (e.g., student feedback questionnaire responses) must enforce server-side validation range guards (ratings must be between 1 and 5).
- **Search Parameters**: Raw text queries used in MongoDB `$regex` conditions must first be cleaned using the `escapeRegex` utility from `utils/sanitize` to block regex injection.
- **CSRF Token Bypass bounds**: Port-based testing bypass checks must match exactly the port range regex: `/^(31[0-9]{2})$/`.
- **Status Field Transitions**:
  Lead status parameters must strictly adhere to the following transition flow:
  - `new` $\rightarrow$ contacted, lost
  - `contacted` $\rightarrow$ interested, lost
  - `interested` $\rightarrow$ ready_to_convert, lost
  - `ready_to_convert` $\rightarrow$ converted (via conversion flow only), lost
  - `converted` & `lost` $\rightarrow$ terminal states (no further transitions allowed).

---

## 5. Denormalization Policy
To maintain data consistency and prevent numbers from drifting:
- **Rule**: Denormalization is allowed only when it avoids a join on a high-frequency read.
- **Sync Obligation**: The controller that writes the source of truth is responsible for syncing the denormalized copy in the same database transaction/operation.
- **Current Denormalized Fields**:
  - `User.fees_total` and `User.fees_paid`: Copied from `Fee.totalAmount` and `Fee.paidAmount`.
  - `Attendance.batch`: Copied from `User.batch`.

---

## 6. Logging Standard
- **Rule**: Never use `console.log`, `console.error`, or `console.warn` in controllers. Always import and use `utils/logger.js` for structured logging.

---

## 7. Performance & Database Operations
- **Bulk Write vs InsertMany**:
  - Use `Schedule.insertMany()` when creating many new documents (e.g., propagating a timetable).
  - Use `Attendance.bulkWrite(ops)` with `upsert: true` when updating-or-creating records (e.g., marking daily attendance).
- **Index Definitions**: Index definitions belong in the model file using `schema.index()`. This document lists them for reference only. The model file is the source of truth.
  - `Lead`: `{ assignedTo: 1, status: 1 }`
  - `Attendance`: `{ student: 1, date: 1 }`, `{ student: 1, subject: 1, date: 1 }` (unique)
  - `Fee`: `{ student: 1 }` (unique)
  - `Message`: `{ recipient: 1, read: 1 }`
  - `Schedule`: `{ batch: 1, date: 1 }`
  - `Assignment`: `{ batch: 1, teacher: 1 }`
- **Static Assets Filtering**: Global pre-processing middlewares must skip static assets (e.g., check `req.url` extensions) to conserve database connections.

---+