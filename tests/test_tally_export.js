const assert = require('assert');
const { buildTallyMastersXml, buildTallyXml } = require('../utils/tallyExport');

const date = new Date('2026-07-15T10:00:00Z');
const output = buildTallyXml({
  fees: [{
    student: 'student-1',
    payments: [{ _id: 'payment-1', amount: 5000, method: 'UPI', transactionId: 'TX123', paidAt: date }]
  }],
  expenses: [{ _id: 'expense-1', amount: 1200, category: 'rent', paymentMethod: 'Cash', date }],
  students: new Map([['student-1', { name: 'A & B', course: 'AI <Bootcamp>' }]]),
  start: new Date('2026-07-01T00:00:00Z'),
  end: new Date('2026-07-31T23:59:59Z')
});

assert.match(output, /VCHTYPE="Receipt"/);
assert.match(output, /VCHTYPE="Payment"/);
assert.match(output, /A &amp; B/);
assert.match(output, /AI &lt;Bootcamp&gt;/);
assert.match(output, /<AMOUNT>-5000<\/AMOUNT>/);
assert.match(output, /<AMOUNT>5000<\/AMOUNT>/);
const masters = buildTallyMastersXml({
  fees: [{ payments: [{ method: 'UPI' }] }],
  expenses: [{ category: 'rent', paymentMethod: 'Cash' }]
});
assert.match(masters, /REPORTNAME>All Masters/);
assert.match(masters, /LEDGER NAME="Course Fee Income"/);
assert.match(masters, /LEDGER NAME="UPI"/);
assert.match(masters, /LEDGER NAME="rent Expense"/);
console.log('Tally export test passed');
