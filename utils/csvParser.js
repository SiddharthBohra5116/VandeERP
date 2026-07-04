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
  normalizeHeader,
  parseCsv
};
