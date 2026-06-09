const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const { todayIST } = require('../utils/dateHelper');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/vande_academy');
  const todayStr = todayIST();
  console.log('Today Str IST:', todayStr);

  const fees = await Fee.find().select('payments');
  const isToday = (d) => {
    if (!d) return false;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const formatted = formatter.format(new Date(d));
    console.log(`Checking date: ${d} -> formatted: ${formatted} -> matches: ${formatted === todayStr}`);
    return formatted === todayStr;
  };

  let todayCollections = 0;
  fees.forEach(f => {
    if (f.payments) {
      f.payments.forEach(p => {
        if (isToday(p.paidAt)) {
          todayCollections += p.amount;
        }
      });
    }
  });

  console.log('Today Collections calculated:', todayCollections);
  await mongoose.disconnect();
}
run();
