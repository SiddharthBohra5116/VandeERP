const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const Holiday = require('../../models/Holiday');
const { todayIST } = require('../../utils/dateHelper');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');

/**
 * GET /admin/attendance
 * Admin only. Renders calendar view, 1-30 student P/A grid, and dynamic daily logs.
 */
exports.getAttendanceOverview = async (req, res) => {
    try {
        const { batch = '', month = '' } = req.query;
        
        const todayISTStr = todayIST(); // 'YYYY-MM-DD'
        const defaultMonth = todayISTStr.slice(0, 7); // 'YYYY-MM'
        const selectedMonth = month || defaultMonth;
        
        const [year, monthNum] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        
        const holidaysList = await Holiday.find({ date: { $regex: '^' + selectedMonth } });
        const holidayDates = new Set(holidaysList.map(h => h.date));
        const holidayMap = {};
        holidaysList.forEach(h => { holidayMap[h.date] = h.name; });

        // Generate all calendar dates
        const calendarDays = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dateObj = new Date(year, monthNum - 1, day);
            calendarDays.push({
                dateStr,
                dayNum: day,
                dayOfWeek: dateObj.getDay(), // 0 = Sunday, 1 = Monday, etc.
                isHoliday: holidayDates.has(dateStr),
                holidayName: holidayMap[dateStr] || null,
                attendancePct: null,
                totalStudentsMarked: 0,
                presentCount: 0
            });
        }

        // Fetch unique list of student batches for the filter dropdown
        const batches = await User.distinct('batch', { role: 'student', isActive: true });

        // Fetch students based on batch filter (or all students if no batch filtered)
        const studentFilter = { role: 'student' };
        if (batch) {
            studentFilter.batch = batch;
        }
        const students = await User.find(studentFilter).sort({ name: 1 });

        let monthlyAttendanceRecords = [];
        let gridDates = [];
        let studentGrid = [];

        if (students.length > 0) {
            const studentIds = students.map(s => s._id);
            // Query all attendance records for these students in this month
            monthlyAttendanceRecords = await Attendance.find({
                student: { $in: studentIds },
                date: { $regex: '^' + selectedMonth }
            }).populate('student', 'name');

            // Calculate daily attendance percentage
            calendarDays.forEach(day => {
                const dayRecs = monthlyAttendanceRecords.filter(r => r.date === day.dateStr);
                if (dayRecs.length > 0) {
                    const total = dayRecs.length;
                    const present = dayRecs.filter(r => r.status === 'present' || r.status === 'late').length;
                    day.attendancePct = Math.round((present / total) * 100);
                    day.totalStudentsMarked = total;
                    day.presentCount = present;
                }
            });

            if (batch) {
                // Generate student grid data
                // Skip holidays for grid columns
                gridDates = calendarDays.filter(day => !day.isHoliday).map(day => day.dateStr);

                // For each student, map their attendance status per grid date
                studentGrid = students.map(student => {
                    const studentRecs = monthlyAttendanceRecords.filter(r => String(r.student._id || r.student) === String(student._id));
                    const attendanceByDate = {};
                    studentRecs.forEach(r => {
                        attendanceByDate[r.date] = r.status; // 'present', 'absent', 'late'
                    });

                    return {
                        _id: student._id,
                        name: student.name,
                        attendanceByDate
                    };
                });
            }
        }

        // Calculate overall attendance rate for each batch
        const batchSummaries = [];
        for (const bName of batches) {
            if (!bName) continue;
            const bStudents = await User.find({ role: 'student', batch: bName, isActive: true });
            if (bStudents.length === 0) continue;
            
            const bStudentIds = bStudents.map(s => s._id);
            const bRecords = await Attendance.find({
                student: { $in: bStudentIds },
                date: { $regex: '^' + selectedMonth }
            });
            
            let attendancePct = null;
            if (bRecords.length > 0) {
                const total = bRecords.length;
                const present = bRecords.filter(r => r.status === 'present' || r.status === 'late').length;
                attendancePct = Math.round((present / total) * 100);
            }
            
            batchSummaries.push({
                name: bName,
                studentCount: bStudents.length,
                attendancePct
            });
        }

        // Calculate the last 6 months (current month + 5 past months)
        const monthsList = [];
        const currentDate = new Date();
        for (let i = 0; i < 6; i++) {
            const tempDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const y = tempDate.getFullYear();
            const m = String(tempDate.getMonth() + 1).padStart(2, '0');
            const value = `${y}-${m}`;
            const label = tempDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            monthsList.push({ value, label });
        }

        res.render('admin/attendance', {
            title: 'Attendance Overview',
            user: req.user,
            batch,
            selectedMonth,
            batches,
            calendarDays,
            gridDates,
            studentGrid,
            monthlyAttendanceRecords,
            monthsList,
            batchSummaries
        });

    } catch (err) {
        console.error("Error in getAttendanceOverview:", err);
        res.status(500).render('500', { 
            title: 'Error', 
            user: req.user, 
            message: 'Unable to load attendance overview.' 
        });
    }
};