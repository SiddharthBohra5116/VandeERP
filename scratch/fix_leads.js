const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'controllers', 'counsellor', 'leadController.js');
let content = fs.readFileSync(filepath, 'utf8');

// Replace assignedTo: req.user._id with assignedTo: req.user.counsellorProfileId
content = content.replace(/assignedTo:\s*req\.user\._id/g, 'assignedTo: req.user.counsellorProfileId');

fs.writeFileSync(filepath, content, 'utf8');
console.log('Done replacing in leadController.js');
