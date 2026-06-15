const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'controllers', 'admin', 'reportController.js');
let content = fs.readFileSync(filepath, 'utf8');

// Replace populate('userId', ...) with populate('user', ...)
content = content.replace(/populate\('userId'/g, "populate('user'");
content = content.replace(/path:\s*'userId'/g, "path: 'user'");

// Replace s.userId with s.user
content = content.replace(/\.userId/g, '.user');

fs.writeFileSync(filepath, content, 'utf8');
console.log('Report controller updated.');
