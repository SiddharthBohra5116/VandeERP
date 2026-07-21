'use strict';

const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];

function buildFeeSchedule(body, netTotal) {
  const names = asArray(body.instName || body['instName[]']);
  const amounts = asArray(body.instAmount || body['instAmount[]']);
  const dates = asArray(body.instDueDate || body['instDueDate[]']);

  if (!names.length) return [];
  if (names.length > 24 || names.length !== amounts.length || names.length !== dates.length) {
    throw new Error('Each EMI needs a name, amount, and due date.');
  }

  const installments = names.map((name, index) => {
    const amount = Number(amounts[index]);
    const dueDate = new Date(`${dates[index]}T00:00:00`);
    if (!String(name).trim() || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(dueDate.getTime())) {
      throw new Error('Every EMI must have a valid name, positive amount, and due date.');
    }
    return { name: String(name).trim().slice(0, 80), amount, dueDate, paidAmount: 0 };
  });

  if (installments.some((item, index) => index && item.dueDate < installments[index - 1].dueDate)) {
    throw new Error('EMI due dates must be in chronological order.');
  }

  const scheduleTotal = installments.reduce((sum, item) => sum + item.amount, 0);
  if (Math.abs(scheduleTotal - netTotal) > 0.01) {
    throw new Error('EMI amounts must add up to the net fee.');
  }

  return installments;
}

module.exports = buildFeeSchedule;
