/**
 * Centralized constant enums for Mongoose schemas
 */
module.exports = {
  ROLES: ['student', 'teacher', 'counsellor', 'admin'],
  
  ANNOUNCEMENT_ROLES: ['', 'student', 'teacher', 'counsellor', 'admin'],
  ANNOUNCEMENT_AUDIENCE: ['all', 'course', 'batch', 'role', 'counsellor'],

  USER_STATUSES: ['active', 'inactive', 'drop', 'complete'],

  LEAD_SOURCES: [
    'Instagram',
    'Website',
    'Referral',
    'Walk-in',
    'LinkedIn',
    'Facebook',
    'WhatsApp',
    'Advertisement',
    'Manual',
    'Other'
  ],

  LEAD_TYPES: ['manual', 'automation'],

  LEAD_CATEGORIES: ['hot', 'warm', 'cold'],

  LEAD_STATUSES: [
    'new',
    'contacted',
    'mentorship_scheduled',
    'mentorship_attended',
    'follow_up',
    'joining_interested',
    'admission_completed',
    'lost'
  ],

  LOST_REASONS: [
    '',
    'Fees Issue',
    'No Response',
    'Joined Another Institute',
    'Parent Not Interested',
    'Financial Issue',
    'Other'
  ],

  AUTOMATION_PROVIDERS: [
    'instagram',
    'facebook',
    'website',
    'whatsapp',
    'linkedin',
    'zapier',
    'make',
    'other',
    'none'
  ],

  PAYMENT_METHODS: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'],

  HOLIDAY_TYPES: ['public', 'academy', 'festival', 'other'],

  LEAVE_REQUEST_STATUSES: ['pending', 'approved', 'rejected'],

  EXPENSE_CATEGORIES: [
    'rent',
    'electricity',
    'staff',
    'marketing',
    'software',
    'maintenance',
    'equipment',
    'miscellaneous'
  ],

  SCHEDULE_STATUSES: ['scheduled', 'completed', 'cancelled'],

  ASSIGNMENT_SUBMISSION_STATUSES: ['pending', 'submitted', 'late', 'graded', 'overdue'],

  ATTENDANCE_STATUSES: ['present', 'absent', 'late'],

  LEAD_ACTIVITY_TYPES: [
    'lead_created',
    'assigned',
    'reassigned',
    'status_changed',
    'call',
    'whatsapp',
    'note',
    'parent_discussion',
    'fee_discussion',
    'mentorship_scheduled',
    'mentorship_attended',
    'follow_up_scheduled',
    'follow_up_completed',
    'follow_up_missed',
    'lost',
    'converted'
  ],

  CALL_OUTCOMES: ['answered', 'busy', 'no-answer', 'callback', 'switched-off', 'wrong-number', 'not-applicable'],

  WHATSAPP_DIRECTIONS: ['sent', 'received', 'none'],

  DAYS_OF_WEEK: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
};
