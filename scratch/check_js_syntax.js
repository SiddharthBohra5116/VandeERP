const fs = require('fs');
const path = require('path');

const ejsPath = path.join(__dirname, '../views/admin/schedules.ejs');
const content = fs.readFileSync(ejsPath, 'utf8');

const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = scriptRegex.exec(content)) !== null) {
  count++;
  const jsCode = match[1]
    .replace(/<%- [\s\S]*? %>/g, '[]') // Mock raw ejs tags to valid JS array
    .replace(/<%= [\s\S]*? %>/g, '"mock"') // Mock escaped ejs tags to valid JS string
    .replace(/<%[\s\S]*?%>/g, ''); // Remove control flow tags

  const tempFile = path.join(__dirname, `temp_script_${count}.js`);
  fs.writeFileSync(tempFile, jsCode);
  console.log(`Extracted script block ${count} to ${tempFile}`);

  const { execSync } = require('child_process');
  try {
    execSync(`node -c "${tempFile}"`);
    console.log(`Script block ${count} is syntactically VALID!`);
    fs.unlinkSync(tempFile);
  } catch (err) {
    console.error(`Script block ${count} has SYNTAX ERROR:`, err.message);
  }
}
