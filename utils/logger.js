/**
 * Central structured logger for logging system events in a standard JSON format,
 * making logs easily queryable and processable.
 */
const logger = {
  info: (msg, meta = {}) => {
    console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date() }));
  },
  warn: (msg, meta = {}) => {
    console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date() }));
  },
  error: (msg, meta = {}) => {
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date() }));
  }
};

module.exports = logger;
