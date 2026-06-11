const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/constants');

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  method: { type: String, enum: PAYMENT_METHODS, default: 'Cash' },
  transactionId: { type: String, default: '' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, default: '' },
  paidAt: { type: Date, default: Date.now }
});

const installmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paidAmount: { type: Number, default: 0 }
});

const feeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  payments: [paymentSchema],
  dueDate: { type: Date, default: null },
  discount: { type: Number, default: 0 },
  discountReason: { type: String, default: '' },
  courseDurationMonths: { type: Number, default: 3 },
  installments: [installmentSchema]
}, { timestamps: true });

// Generate default installments
feeSchema.methods.generateInstallments = function() {
  const durationDays = Math.max(1, this.courseDurationMonths || 3) * 30;
  let enrollDate = this.createdAt || new Date();
  if (this.dueDate && this.dueDate < enrollDate) enrollDate = new Date(this.dueDate);

  const netTotal = this.totalAmount - (this.discount || 0);
  const dpAmount = Math.round(netTotal * 0.5);
  const inst1Amount = Math.round(netTotal * 0.25);
  const inst2Amount = Math.max(0, netTotal - dpAmount - inst1Amount);

  const dpDue = new Date(enrollDate);
  const inst1Due = new Date(enrollDate);
  inst1Due.setDate(inst1Due.getDate() + Math.round(durationDays / 2));
  const inst2Due = new Date(enrollDate);
  inst2Due.setDate(inst2Due.getDate() + Math.max(0, durationDays - 30));

  this.installments = [
    { name: 'Down Payment (50%)', amount: dpAmount, dueDate: dpDue, paidAmount: 0 },
    { name: 'First Installment (25%)', amount: inst1Amount, dueDate: inst1Due, paidAmount: 0 },
    { name: 'Second Installment (25%)', amount: inst2Amount, dueDate: inst2Due, paidAmount: 0 }
  ];
  this.dueDate = inst2Due;
};

// Allocate paid amount into installments
feeSchema.methods.allocatePayments = function() {
  let remainingPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);

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

  if (!this.installments || this.installments.length === 0) {
    this.generateInstallments();
  }

  for (const installment of this.installments) {
    if (remainingPaid >= installment.amount) {
      installment.paidAmount = installment.amount;
      remainingPaid -= installment.amount;
    } else {
      installment.paidAmount = remainingPaid;
      remainingPaid = 0;
    }
  }

  const nextUnpaid = this.installments.find(inst => inst.paidAmount < inst.amount);
  if (nextUnpaid) {
    this.dueDate = nextUnpaid.dueDate;
  } else if (this.installments.length > 0) {
    this.dueDate = this.installments[this.installments.length - 1].dueDate;
  }
};

// Pre-save hook
feeSchema.pre('save', function(next) {
  const isTotalModified = this.isModified('totalAmount') || this.isModified('discount') || this.isModified('courseDurationMonths');
  const hasNoInstallments = !this.installments || this.installments.length === 0;
  const isInstallmentsModified = this.isModified('installments');

  if ((isTotalModified && !isInstallmentsModified) || hasNoInstallments) {
    this.generateInstallments();
  }

  this.allocatePayments();
  next();
});

// Total fine
feeSchema.virtual('totalFine').get(function() {
  const now = new Date();
  let fineSum = 0;
  if (!this.installments || this.installments.length === 0) return fineSum;

  this.installments.forEach(installment => {
    if (installment.paidAmount < installment.amount) {
      const dueTime = new Date(installment.dueDate);
      if (now > dueTime) {
        const diffTime = Math.abs(now - dueTime);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 60) fineSum += 1000;
        else if (diffDays > 30) fineSum += 500;
        else fineSum += 250;
      }
    }
  });
  return fineSum;
});

// Due amount
feeSchema.virtual('dueAmount').get(function() {
  const net = this.totalAmount - this.discount;
  const fine = this.totalFine;
  return Math.max(0, net + fine - this.paidAmount);
});

// Payment percentage
feeSchema.virtual('paidPct').get(function() {
  const net = this.totalAmount - this.discount;
  return net > 0 ? Math.round((this.paidAmount / net) * 100) : 0;
});

feeSchema.set('toObject', { virtuals: true });
feeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Fee', feeSchema);