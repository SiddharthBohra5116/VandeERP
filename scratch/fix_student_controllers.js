const fs = require('fs');
const path = require('path');

const studentDir = path.join(__dirname, '..', 'controllers', 'student');
const files = fs.readdirSync(studentDir);

files.forEach(file => {
  if (file.endsWith('.js')) {
    const filepath = path.join(studentDir, file);
    let content = fs.readFileSync(filepath, 'utf8');

    // Replace findOne({ userId: ... }) with findOne({ user: ... })
    content = content.replace(/userId:\s*req\.user\._id/g, 'user: req.user._id');
    // Replace populate('userId', ...) with populate('user', ...)
    content = content.replace(/populate\('userId'/g, "populate('user'");
    // Replace studentProfile.userId?. with studentProfile.user?.
    content = content.replace(/studentProfile\.userId/g, 'studentProfile.user');

    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
