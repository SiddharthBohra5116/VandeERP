const PDFDocument = require('pdfkit');
const formatIndianPhone = require('./phoneFormat');

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function createFeeInvoice(fee) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Fee Invoice' } });
  const student = fee.student;
  const net = Number(fee.totalAmount) - Number(fee.discount || 0);
  const paid = Number(fee.paidAmount || 0);
  const due = Math.max(0, net - paid);
  const course = fee.course?.name || fee.course || student.course?.name || 'Not assigned';
  const line = y => doc.moveTo(48, y).lineTo(547, y).strokeColor('#ded7bd').stroke();
  const row = (label, value, y, strong = false) => {
    doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#555').text(label, 58, y, { width: 250, ellipsis: true, lineBreak: false });
    doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111').text(value, 330, y, { width: 205, align: 'right' });
  };

  doc.rect(0, 0, 595, 112).fill('#171717');
  doc.fillColor('#d4af37').font('Helvetica-Bold').fontSize(22).text('VANDE DIGITAL ACADEMY', 48, 38);
  doc.fillColor('#fff').font('Helvetica').fontSize(10).text('Professional Learning. Practical Careers.', 48, 70);
  doc.text('GSTIN: 08PQRPV9232JIZV', 48, 87);
  doc.font('Helvetica-Bold').fontSize(24).text('INVOICE', 400, 36, { width: 147, align: 'right' });

  doc.fillColor('#111').font('Helvetica-Bold').fontSize(11).text('BILL TO', 48, 140);
  doc.fontSize(15).text(student.user?.name || student.name || 'Student', 48, 160);
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  doc.text(`Phone: ${formatIndianPhone(student.user?.phone || student.phone)}`, 48, 184);
  doc.text(`Email: ${student.user?.email || student.email || 'Not provided'}`, 48, 199);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('INVOICE DATE', 380, 140, { width: 167, align: 'right' });
  doc.font('Helvetica').fillColor('#555').text(
    new Date(fee.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    380, 158, { width: 167, align: 'right' }
  );
  doc.font('Helvetica-Bold').fillColor('#111').text('COURSE', 380, 188, { width: 167, align: 'right' });
  doc.font('Helvetica').fillColor('#555').text(course, 380, 206, { width: 167, align: 'right' });

  line(250);
  doc.rect(48, 268, 499, 30).fill('#f3efe2');
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(10).text('DESCRIPTION', 58, 278);
  doc.text('AMOUNT', 420, 278, { width: 115, align: 'right' });
  row(`${course} - Course Fee`, money(fee.totalAmount), 316);
  if (Number(fee.discount || 0) > 0) row(`Discount${fee.discountReason ? ` (${fee.discountReason})` : ''}`, `- ${money(fee.discount)}`, 342);
  line(374);
  row('Net Invoice Amount', money(net), 394, true);
  row('Amount Paid', money(paid), 420);
  row('Balance Due', money(due), 446, true);

  doc.roundedRect(330, 482, 217, 44, 6).fill(due === 0 ? '#e7f7ed' : '#fff1e6');
  doc.fillColor(due === 0 ? '#167a3c' : '#ad4d00').font('Helvetica-Bold').fontSize(12)
    .text(due === 0 ? 'PAID IN FULL' : `BALANCE: ${money(due)}`, 342, 498, { width: 193, align: 'center' });

  doc.fillColor('#555').font('Helvetica').fontSize(9)
    .text('This invoice is generated from the academy fee ledger. Please retain it for your records.', 48, 566, { width: 499, align: 'center' });
  line(610);
  doc.fontSize(8).fillColor('#777').text('Vande Digital Academy', 48, 625);
  doc.text('Computer-generated invoice - no signature required', 300, 625, { width: 247, align: 'right' });
  return doc;
}

module.exports = { createFeeInvoice, money };
