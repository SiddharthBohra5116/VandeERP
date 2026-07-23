function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phoneSearchPattern(value) {
  const text = String(value || '').trim();
  const digits = text.replace(/\D/g, '');
  return digits.length >= 4 && /^[\d\s()+-]+$/.test(text)
    ? digits.split('').join('\\D*')
    : escapeRegex(text);
}

module.exports = {
  escapeRegex,
  phoneSearchPattern
};
