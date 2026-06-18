/**
 * Security Unit Tests
 * Run with: node tests/security.test.js
 *
 * Uses Node's built-in assert module — zero new dependencies.
 * Tests pure logic functions extracted from each module.
 */
'use strict';
const assert = require('assert');

let passed = 0;
let failed  = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers extracted from middleware (pure logic, no DB dependencies)
// ─────────────────────────────────────────────────────────────────────────────

/** From inputMutationGuard.js */
function stripNoSQLInjection(obj, removed = []) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return removed;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      removed.push(key);
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      stripNoSQLInjection(obj[key], removed);
    }
  }
  return removed;
}

function stripXSS(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');
}

const MASS_ASSIGN_BLOCKED_FIELDS = ['role','isActive','status','fees_total','fees_paid','createdAt','updatedAt','__v','password','tokenBlacklistedBefore','passwordChangedAt'];
function stripMassAssignmentFields(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const f of MASS_ASSIGN_BLOCKED_FIELDS) { delete obj[f]; }
}

function truncateOverflowFields(obj, path = '', overflowed = []) {
  if (!obj || typeof obj !== 'object') return overflowed;
  for (const key of Object.keys(obj)) {
    const fp = path ? `${path}.${key}` : key;
    if (typeof obj[key] === 'string' && obj[key].length > 5000) {
      overflowed.push({ field: fp, originalLength: obj[key].length });
      obj[key] = obj[key].slice(0, 5000);
    } else if (typeof obj[key] === 'object') {
      truncateOverflowFields(obj[key], fp, overflowed);
    }
  }
  return overflowed;
}

/** From behaviorEngine.js — anomaly score signals (pure logic) */
function computeAnomalyScoreSync({ isNewIp, isUnusualHour, hasEnoughData, isSensitivePath, wrongRole, rateExceedsAvg }) {
  let score = 0;
  if (isNewIp)                         score += 30;
  if (isUnusualHour && hasEnoughData)  score += 20;
  if (isSensitivePath && wrongRole)    score += 25;
  if (rateExceedsAvg)                  score += 25;
  return score;
}

/** From feeIntegrityValidator.js — payment validation (pure logic) */
function validatePayment(amount, outstanding) {
  if (isNaN(amount) || amount <= 0) {
    return { passed: false, reason: 'amount_zero_or_negative' };
  }
  if (amount > outstanding * 1.01) {
    return { passed: false, reason: 'overpayment', outstanding };
  }
  return { passed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: NoSQL Injection Stripping
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📋 Suite 1: NoSQL Injection Stripping');

test('strips top-level $gt key', () => {
  const obj = { name: { $gt: '' } };
  const removed = stripNoSQLInjection(obj);
  assert.strictEqual(removed.includes('$gt'), true, 'Should remove $gt key');
  // The nested object key $gt is removed, leaving obj.name as empty {}
  assert.deepStrictEqual(obj.name, {}, 'name should be an empty object after $gt removal');
});

test('strips $where operator', () => {
  const obj = { $where: 'this.a > 1' };
  const removed = stripNoSQLInjection(obj);
  assert.ok(removed.includes('$where'), 'Should detect $where');
  assert.ok(!('$where' in obj), 'Should remove $where from object');
});

test('strips dotted key (prototype pollution vector)', () => {
  const obj = { 'user.role': 'admin' };
  const removed = stripNoSQLInjection(obj);
  assert.ok(removed.includes('user.role'), 'Should detect dotted key');
  assert.ok(!('user.role' in obj));
});

test('preserves safe keys', () => {
  const obj = { name: 'John', email: 'a@b.com' };
  stripNoSQLInjection(obj);
  assert.strictEqual(obj.name, 'John');
  assert.strictEqual(obj.email, 'a@b.com');
});

test('strips nested $ne operator', () => {
  const obj = { filter: { status: { $ne: null } } };
  stripNoSQLInjection(obj);
  // $ne is removed from the nested object, leaving status as {}
  assert.deepStrictEqual(obj.filter.status, {});
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: XSS Sanitization
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📋 Suite 2: XSS Sanitization');

test('strips <script> tag', () => {
  const result = stripXSS('<script>alert(1)</script>hello');
  assert.ok(!result.includes('<script>'), 'Should remove script tag');
  assert.ok(result.includes('hello'), 'Should keep safe text');
});

test('strips javascript: URI', () => {
  const result = stripXSS('javascript:alert(document.cookie)');
  assert.ok(!result.includes('javascript:'));
});

test('strips onclick= attribute', () => {
  const result = stripXSS('<div onclick="steal()">text</div>');
  assert.ok(!result.includes('onclick='));
});

test('strips <iframe> tag', () => {
  const result = stripXSS('<iframe src="evil.com"></iframe>');
  assert.ok(!result.includes('<iframe>'));
});

test('preserves normal text', () => {
  const result = stripXSS('Hello World! This is a normal message. 100% safe.');
  assert.strictEqual(result, 'Hello World! This is a normal message. 100% safe.');
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Mass Assignment Protection
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📋 Suite 3: Mass Assignment Protection');

test('strips role field', () => {
  const body = { name: 'John', role: 'admin', phone: '9999999999' };
  stripMassAssignmentFields(body);
  assert.strictEqual(body.role, undefined);
  assert.strictEqual(body.name, 'John');
});

test('strips isActive, status, password in one pass', () => {
  const body = { name: 'Jane', isActive: true, status: 'complete', password: 'hack' };
  stripMassAssignmentFields(body);
  assert.strictEqual(body.isActive, undefined);
  assert.strictEqual(body.status, undefined);
  assert.strictEqual(body.password, undefined);
  assert.strictEqual(body.name, 'Jane');
});

test('strips tokenBlacklistedBefore (sentinel field)', () => {
  const body = { email: 'a@b.com', tokenBlacklistedBefore: new Date() };
  stripMassAssignmentFields(body);
  assert.strictEqual(body.tokenBlacklistedBefore, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Field Overflow Truncation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📋 Suite 4: Field Overflow Truncation');

test('truncates field exceeding 5000 chars', () => {
  const obj = { notes: 'x'.repeat(6000) };
  const overflowed = truncateOverflowFields(obj);
  assert.strictEqual(obj.notes.length, 5000);
  assert.strictEqual(overflowed[0].field, 'notes');
  assert.strictEqual(overflowed[0].originalLength, 6000);
});

test('leaves short fields untouched', () => {
  const obj = { name: 'Short name' };
  const overflowed = truncateOverflowFields(obj);
  assert.strictEqual(obj.name, 'Short name');
  assert.strictEqual(overflowed.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Anomaly Score Calculation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📋 Suite 5: Anomaly Score Calculation');

test('score 0 for normal request', () => {
  const score = computeAnomalyScoreSync({ isNewIp: false, isUnusualHour: false, hasEnoughData: true, isSensitivePath: false, wrongRole: false, rateExceedsAvg: false });
  assert.strictEqual(score, 0);
});

test('score +30 for new IP', () => {
  const score = computeAnomalyScoreSync({ isNewIp: true, isUnusualHour: false, hasEnoughData: true, isSensitivePath: false, wrongRole: false, rateExceedsAvg: false });
  assert.strictEqual(score, 30);
});

test('score +20 for unusual hour (with data)', () => {
  const score = computeAnomalyScoreSync({ isNewIp: false, isUnusualHour: true, hasEnoughData: true, isSensitivePath: false, wrongRole: false, rateExceedsAvg: false });
  assert.strictEqual(score, 20);
});

test('no score for unusual hour without enough data', () => {
  const score = computeAnomalyScoreSync({ isNewIp: false, isUnusualHour: true, hasEnoughData: false, isSensitivePath: false, wrongRole: false, rateExceedsAvg: false });
  assert.strictEqual(score, 0);
});

test('score +25 for wrong-role sensitive path', () => {
  const score = computeAnomalyScoreSync({ isNewIp: false, isUnusualHour: false, hasEnoughData: true, isSensitivePath: true, wrongRole: true, rateExceedsAvg: false });
  assert.strictEqual(score, 25);
});

test('no score for correct role on sensitive path', () => {
  const score = computeAnomalyScoreSync({ isNewIp: false, isUnusualHour: false, hasEnoughData: true, isSensitivePath: true, wrongRole: false, rateExceedsAvg: false });
  assert.strictEqual(score, 0);
});

test('score +25 for excessive request rate', () => {
  const score = computeAnomalyScoreSync({ isNewIp: false, isUnusualHour: false, hasEnoughData: true, isSensitivePath: false, wrongRole: false, rateExceedsAvg: true });
  assert.strictEqual(score, 25);
});

test('max score 100 for all signals triggered', () => {
  const score = computeAnomalyScoreSync({ isNewIp: true, isUnusualHour: true, hasEnoughData: true, isSensitivePath: true, wrongRole: true, rateExceedsAvg: true });
  assert.strictEqual(score, 100);
});

test('score >= 60 triggers alert threshold', () => {
  const score = computeAnomalyScoreSync({ isNewIp: true, isUnusualHour: true, hasEnoughData: true, isSensitivePath: false, wrongRole: false, rateExceedsAvg: true });
  assert.ok(score >= 60, `Expected score >= 60, got ${score}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: Fee Integrity Validation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📋 Suite 6: Fee Integrity Validation');

test('rejects amount = 0', () => {
  const result = validatePayment(0, 5000);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, 'amount_zero_or_negative');
});

test('rejects negative amount', () => {
  const result = validatePayment(-500, 5000);
  assert.strictEqual(result.passed, false);
});

test('rejects NaN amount', () => {
  const result = validatePayment(NaN, 5000);
  assert.strictEqual(result.passed, false);
});

test('rejects overpayment exceeding outstanding', () => {
  const result = validatePayment(6000, 5000);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, 'overpayment');
});

test('allows payment equal to outstanding', () => {
  const result = validatePayment(5000, 5000);
  assert.strictEqual(result.passed, true);
});

test('allows payment within 1% tolerance (rounding)', () => {
  const result = validatePayment(5040, 5000); // 5040 = 5000 * 1.008 → within 1%
  assert.strictEqual(result.passed, true);
});

test('rejects payment > 1% over outstanding', () => {
  const result = validatePayment(5100, 5000); // 5100 = 5000 * 1.02 → exceeds 1%
  assert.strictEqual(result.passed, false);
});

test('allows partial payment', () => {
  const result = validatePayment(2500, 5000);
  assert.strictEqual(result.passed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`  ⚠️  ${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`  🛡️  All Security tests passed.\n`);
}
