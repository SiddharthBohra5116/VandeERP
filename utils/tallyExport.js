const xml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const tallyDate = value => new Date(value).toISOString().slice(0, 10).replace(/-/g, '');

function ledgerEntry(name, amount, debit) {
  return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xml(name)}</LEDGERNAME><ISDEEMEDPOSITIVE>${debit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${debit ? -amount : amount}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
}

function voucher(type, date, number, narration, debitLedger, creditLedger, amount) {
  return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${type}" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>${tallyDate(date)}</DATE><VOUCHERTYPENAME>${type}</VOUCHERTYPENAME><VOUCHERNUMBER>${xml(number)}</VOUCHERNUMBER><NARRATION>${xml(narration)}</NARRATION>${ledgerEntry(debitLedger, amount, true)}${ledgerEntry(creditLedger, amount, false)}</VOUCHER></TALLYMESSAGE>`;
}

function buildTallyMastersXml({ fees, expenses }) {
  const ledgers = new Map([
    ['Course Fee Income', 'Direct Incomes'],
    ['Cash', 'Cash-in-Hand']
  ]);
  fees.flatMap(fee => fee.payments || []).forEach(payment => ledgers.set(payment.method || 'Cash', payment.method === 'Cash' ? 'Cash-in-Hand' : 'Bank Accounts'));
  expenses.forEach(expense => {
    ledgers.set(expense.paymentMethod || 'Cash', expense.paymentMethod === 'Cash' ? 'Cash-in-Hand' : 'Bank Accounts');
    ledgers.set(`${expense.category} Expense`, 'Indirect Expenses');
  });
  const messages = [...ledgers].map(([name, parent]) =>
    `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${xml(name)}" ACTION="Create"><NAME>${xml(name)}</NAME><PARENT>${xml(parent)}</PARENT><ISBILLWISEON>No</ISBILLWISEON><AFFECTSSTOCK>No</AFFECTSSTOCK></LEDGER></TALLYMESSAGE>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC><REQUESTDATA>${messages.join('')}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

function buildTallyXml({ fees, expenses, students, start, end }) {
  const messages = [];

  fees.forEach(fee => {
    const student = students.get(String(fee.student));
    (fee.payments || []).forEach(payment => {
      const paidAt = new Date(payment.paidAt);
      if (paidAt < start || paidAt > end || payment.amount <= 0) return;
      const method = payment.method || 'Cash';
      const narration = [
        `Fee received from ${student?.name || 'Student'}`,
        student?.course ? `Course: ${student.course}` : '',
        payment.transactionId ? `Transaction: ${payment.transactionId}` : '',
        payment.note || ''
      ].filter(Boolean).join(' | ');
      messages.push(voucher('Receipt', paidAt, `FEE-${payment._id}`, narration, method, 'Course Fee Income', payment.amount));
    });
  });

  expenses.forEach(expense => {
    const paidAt = new Date(expense.date);
    if (paidAt < start || paidAt > end || expense.amount <= 0) return;
    const narration = [expense.description, expense.paidTo ? `Paid to: ${expense.paidTo}` : '', expense.transactionId ? `Transaction: ${expense.transactionId}` : ''].filter(Boolean).join(' | ');
    messages.push(voucher('Payment', paidAt, `EXP-${expense._id}`, narration || expense.category, `${expense.category} Expense`, expense.paymentMethod || 'Cash', expense.amount));
  });

  return `<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>${messages.join('')}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

module.exports = { buildTallyMastersXml, buildTallyXml };
