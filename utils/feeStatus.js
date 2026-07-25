function getFeeStatus(fee, now = new Date()) {
  const dueAmount = Math.max(0, Number(fee.totalAmount || 0) - Number(fee.discount || 0) - Number(fee.paidAmount || 0));
  const isOverdue = dueAmount > 0 && fee.dueDate && new Date(fee.dueDate) < now;
  const paymentStatus = dueAmount === 0
    ? 'completed'
    : isOverdue
      ? 'overdue'
      : Number(fee.paidAmount || 0) > 0
        ? 'partially_paid'
        : 'unpaid';
  return { dueAmount, isOverdue: Boolean(isOverdue), paymentStatus };
}

module.exports = getFeeStatus;
