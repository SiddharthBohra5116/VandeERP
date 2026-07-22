function detectDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/).find(line => line.trim()) || '';
  const candidates = [',', '\t', ';'];
  return candidates
    .map(delimiter => ({
      delimiter,
      count: firstLine.split(delimiter).length
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanImportedPhone(phone) {
  return String(phone || '').replace(/^\s*p\s*:\s*/i, '').trim();
}

function normalizePhone(phone) {
  const digits = cleanImportedPhone(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function importedMoney(value) {
  const text = String(value == null ? '' : value).trim();
  const number = Number(text.replace(/[^\d.]/g, '')) * (text.startsWith('-') ? -1 : 1);
  return Number.isFinite(number) ? number : NaN;
}

function importedDate(value, year = new Date().getFullYear()) {
  const text = String(value || '').trim();
  if (!text || text === '-') return null;
  const withYear = /\b\d{4}\b/.test(text) ? text : `${text} ${year}`;
  const date = new Date(`${withYear} 12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function courseFromFileName(fileName) {
  return String(fileName || '')
    .replace(/\.(?:csv|tsv|txt)$/i, '')
    .replace(/^academy\s+leads?\s*[-–—]+\s*/i, '')
    .replace(/(?:\s*\(\d+\))+\s*$/g, '')
    .trim();
}

function normalizeCourseName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+course\s*$/, '').trim();
}

function importedCourseCode(name) {
  const words = String(name || '').toUpperCase().match(/[A-Z0-9]+/g) || [];
  return (words.length > 1 ? words.map(word => word[0]).join('') : words[0] || 'COURSE').slice(0, 10);
}

function isImportedStudentStatus(status) {
  return ['paid', 'student', 'enrolled', 'admitted', 'admission_completed'].includes(String(status || '').trim().toLowerCase());
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map(values => headers.reduce((record, header, index) => {
    if (header) record[header] = String(values[index] || '').trim();
    return record;
  }, {}));
}

module.exports = {
  cleanImportedPhone,
  importedDate,
  importedMoney,
  courseFromFileName,
  importedCourseCode,
  isImportedStudentStatus,
  normalizeCourseName,
  normalizePhone,
  normalizeHeader,
  parseCsv
};
