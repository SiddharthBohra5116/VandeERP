const assert = require('assert');
const fs = require('fs');
const { createFeeInvoice, formatIndianPhone } = require('../utils/feeInvoicePdf');

const fee = {
  _id: '507f1f77bcf86cd799439011',
  createdAt: new Date('2026-07-25T00:00:00Z'),
  student: {
    rollNumber: 'VD-STU-DM-26-001',
    user: { name: 'Test Student', phone: '9876543210', email: 'student@example.com' }
  },
  course: { name: 'Digital Marketing' },
  totalAmount: 30000,
  discount: 5000,
  discountReason: 'Scholarship',
  paidAmount: 10000
};

assert.strictEqual(formatIndianPhone('9876543210'), '+91 98765 43210');
assert.strictEqual(formatIndianPhone('+91 98765 43210'), '+91 98765 43210');
assert.doesNotMatch(fs.readFileSync('utils/feeInvoicePdf.js', 'utf8'), /VDA-INV/);
assert.match(fs.readFileSync('routes/admin.js', 'utf8'), /fees\/:studentId\/invoice\.pdf/);

const chunks = [];
const pdf = createFeeInvoice(fee);
pdf.on('data', chunk => chunks.push(chunk));
pdf.on('end', () => {
  const output = Buffer.concat(chunks);
  assert.ok(output.length > 1000);
  assert.strictEqual(output.subarray(0, 4).toString(), '%PDF');
  console.log('Phase 7 fee invoice checks passed.');
});
pdf.end();
