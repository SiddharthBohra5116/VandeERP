const fs = require('fs');
const ejs = require('ejs');

try {
  const content = fs.readFileSync('views/admin/student-profile.ejs', 'utf8');
  ejs.compile(content, { filename: 'views/admin/student-profile.ejs' });
  console.log('EJS compiled successfully!');
} catch (err) {
  console.error('Compilation Error:', err);
}
