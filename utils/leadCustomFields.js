const LeadCustomField = require('../models/LeadCustomField');

const slugifyFieldKey = label => String(label || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 60);

const getLeadCustomFields = () => LeadCustomField.find({ isActive: true }).sort({ createdAt: 1 });

function normalizeLeadCustomValues(rawValues, definitions, existing = {}) {
  const source = rawValues && typeof rawValues === 'object' ? rawValues : {};
  const values = existing instanceof Map ? Object.fromEntries(existing) : { ...existing };

  definitions.forEach(field => {
    const raw = source[field.key];
    let value;
    if (field.type === 'checkbox') {
      value = raw === 'true' || raw === 'on' || raw === true;
    } else {
      value = String(raw ?? '').trim();
    }

    if (field.required && (value === '' || value === false)) {
      throw new Error(`${field.label} is required.`);
    }
    if (field.type === 'number' && value !== '') {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`${field.label} must be a valid number.`);
      value = number;
    }
    if (field.type === 'date' && value !== '') {
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${field.label} must be a valid date.`);
      }
    }
    if (field.type === 'select' && value !== '' && !field.options.includes(value)) {
      throw new Error(`${field.label} has an invalid option.`);
    }
    values[field.key] = value;
  });

  return values;
}

module.exports = { getLeadCustomFields, normalizeLeadCustomValues, slugifyFieldKey };
