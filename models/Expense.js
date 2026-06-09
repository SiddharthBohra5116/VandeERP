const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({

  month: {
    type: String,
    required: true
  },

  category: {
    type: String,
    enum: [
      'rent',
      'electricity',
      'staff',
      'marketing',
      'software',
      'maintenance',
      'equipment',
      'miscellaneous'
    ],
    required: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },

  description: {
    type: String,
    default: ''
  },

  paidTo: {
    type: String,
    default: ''
  },

  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'],
    default: 'Cash'
  },

  transactionId: {
    type: String,
    default: ''
  },

  loggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  date: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

expenseSchema.index({ month: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);