const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testFiles = [
  'test_classroom_clashes.js',
  'test_comments_pipeline.js',
  'test_counsellor_upgrade.js',
  'test_crm_depth.js',
  'test_inbox_counsellor_alerts.js',
  'test_notifications_and_ux.js',
  'test_read_notifications.js',
  'test_reports_leaves_certs.js',
  'test_schedule_builder.js',
  'test_search_features.js',
  'test_smart_filters.js',
  'test_status_sync.js',
  'test_student_profile_requests.js',
  'test_timetable_propagation.js',
  'test_student_upgrades.js',
  'test_fee_installments.js',
  'verify_day8.js'
];

console.log('🧪 Starting execution of all integration test suites...');
console.log('🧹 Seeding database first...');
try {
  execSync('node seeder.js', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
  console.log('✅ Database seeded successfully.');
} catch (err) {
  console.error('❌ Database seeding failed:', err);
  process.exit(1);
}
let passed = 0;
let failed = 0;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Skip: ${file} (does not exist)`);
    continue;
  }

  console.log(`\n--------------------------------------------`);
  console.log(`🏃 Running ${file}...`);
  console.log(`--------------------------------------------`);

  try {
    execSync(`node "${filePath}"`, { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
    console.log(`✅ ${file} passed!`);
    passed++;
  } catch (err) {
    console.error(`❌ ${file} failed!`);
    failed++;
  }
}

console.log(`\n============================================`);
console.log(`📊 Test Summary:`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`============================================`);

if (failed > 0) {
  process.exit(1);
}
