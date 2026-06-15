const fs = require('fs');
const path = require('path');

const teacherDir = path.join(__dirname, '..', 'controllers', 'teacher');
const files = fs.readdirSync(teacherDir);

files.forEach(file => {
  if (file.endsWith('.js')) {
    const filepath = path.join(teacherDir, file);
    let content = fs.readFileSync(filepath, 'utf8');

    // Replace teacher: req.user._id with teacher: req.user.teacherProfileId
    content = content.replace(/teacher:\s*req\.user\._id/g, 'teacher: req.user.teacherProfileId');
    // Replace teacher: req.user._id in schedules distinct search
    content = content.replace(/teacher:\s*req\.user\._id/g, 'teacher: req.user.teacherProfileId');
    
    // Replace populate('userId') or path: 'userId' with user
    content = content.replace(/populate\('userId'/g, "populate('user'");
    content = content.replace(/path:\s*'userId'/g, "path: 'user'");

    // Replace sp.userId or s.userId or student.userId with user
    content = content.replace(/\.userId/g, '.user');

    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
