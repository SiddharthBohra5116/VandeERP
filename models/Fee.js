const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  method: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'], default: 'Cash' },
  transactionId: { type: String, default: '' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, default: '' },
  paidAt: { type: Date, default: Date.now },
});

const installmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paidAmount: { type: Number, default: 0 },
});

const feeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  course: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  payments: [paymentSchema],
  dueDate: { type: Date, default: null }, // keeps general due date fallback
  discount: { type: Number, default: 0 },
  discountReason: { type: String, default: '' },
  installments: [installmentSchema],
}, { timestamps: true });

// Helper function to calculate duration based on course
function getCourseDurationDays(courseName) {
  const valLower = (courseName || '').toLowerCase();
  if (valLower.includes('both')) return 180; // 6 months
  return 90; // 3 months default
}

// Generate default installments (50% DP immediately, 25% midway, 25% near course end)
feeSchema.methods.generateInstallments = function () {
  const durationDays = getCourseDurationDays(this.course);
  let enrollDate = this.createdAt || new Date();
  if (this.dueDate && this.dueDate < enrollDate) {
    enrollDate = new Date(this.dueDate);
  }

  // Net total fee to divide
  const netTotal = this.totalAmount - (this.discount || 0);

  const dpAmount = Math.round(netTotal * 0.5);
  const inst1Amount = Math.round(netTotal * 0.25);
  const inst2Amount = Math.max(0, netTotal - dpAmount - inst1Amount); // safety remaining

  const dpDue = new Date(enrollDate);

  const inst1Due = new Date(enrollDate);
  inst1Due.setDate(inst1Due.getDate() + Math.round(durationDays / 2));

  const inst2Due = new Date(enrollDate);
  inst2Due.setDate(inst2Due.getDate() + durationDays - 30); // 1 month before end

  this.installments = [
    { name: 'Down Payment (50%)', amount: dpAmount, dueDate: dpDue, paidAmount: 0 },
    { name: 'First Installment (25%)', amount: inst1Amount, dueDate: inst1Due, paidAmount: 0 },
    { name: 'Second Installment (25%)', amount: inst2Amount, dueDate: inst2Due, paidAmount: 0 }
  ];

  // Set general dueDate to the next unpaid installment's due date or the final installment's due date
  this.dueDate = inst2Due;
};

// Sequentially allocate paid amounts to installments
feeSchema.methods.allocatePayments = function () {
  let remainingPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);
  
  // Self-healing: if paidAmount was provided but payments array is empty, create a dummy/default payment entry
  if (remainingPaid === 0 && this.paidAmount > 0) {
    this.payments.push({
      amount: this.paidAmount,
      method: 'Cash',
      note: 'Admission down payment / Migrated payment',
      paidAt: this.createdAt || new Date()
    });
    remainingPaid = this.paidAmount;
  }
  
  this.paidAmount = remainingPaid;

  // Make sure we have installments generated
  if (!this.installments || this.installments.length === 0) {
    this.generateInstallments();
  }

  for (let i = 0; i < this.installments.length; i++) {
    const inst = this.installments[i];
    if (remainingPaid >= inst.amount) {
      inst.paidAmount = inst.amount;
      remainingPaid -= inst.amount;
    } else {
      inst.paidAmount = remainingPaid;
      remainingPaid = 0;
    }
  }

  // Update overall general dueDate to first unpaid installment's due date
  const nextUnpaid = this.installments.find(inst => inst.paidAmount < inst.amount);
  if (nextUnpaid) {
    this.dueDate = nextUnpaid.dueDate;
  } else if (this.installments.length > 0) {
    this.dueDate = this.installments[this.installments.length - 1].dueDate;
  }
};

// Pre-save hook: validate installments exist and payments are allocated
feeSchema.pre('save', function (next) {
  const isTotalModified = this.isModified('totalAmount') || this.isModified('discount');
  const hasNoInstallments = !this.installments || this.installments.length === 0;

  if (isTotalModified || hasNoInstallments) {
    this.generateInstallments();
  }

  this.allocatePayments();
  next();
});

// Virtual: total fine calculated dynamically across all late installments
// Policy: ₹250 fine for delay <= 30 days, ₹500 for delay > 30 and <= 60 days, ₹1000 for delay > 60 days
feeSchema.virtual('totalFine').get(function () {
  const now = new Date();
  let fineSum = 0;

  if (this.installments && this.installments.length > 0) {
    this.installments.forEach(inst => {
      if (inst.paidAmount < inst.amount) {
        const dueTime = new Date(inst.dueDate);
        if (now > dueTime) {
          const diffTime = Math.abs(now - dueTime);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 60) {
            fineSum += 1000;
          } else if (diffDays > 30) {
            fineSum += 500;
          } else {
            fineSum += 250;
          }
        }
      }
    });
  }
  return fineSum;
});

// Virtual: dueAmount including dynamic fines
feeSchema.virtual('dueAmount').get(function () {
  const net = this.totalAmount - this.discount;
  const fine = this.totalFine;
  return Math.max(0, net + fine - this.paidAmount);
});

// Virtual: payment % progress
feeSchema.virtual('paidPct').get(function () {
  const net = this.totalAmount - this.discount;
  return net > 0 ? Math.round((this.paidAmount / net) * 100) : 0;
});

feeSchema.set('toObject', { virtuals: true });
feeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Fee', feeSchema);