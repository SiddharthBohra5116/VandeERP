const ejs = require('ejs');
const fs = require('fs');
const vm = require('vm');

try {
  const template = fs.readFileSync('D:/BasicERPAcademy/views/admin/student-profile.ejs', 'utf8');
  const templateObj = new ejs.Template(template, { filename: 'D:/BasicERPAcademy/views/admin/student-profile.ejs' });
  templateObj.generateSource();
  const source = templateObj.source;
  
  fs.writeFileSync('D:/BasicERPAcademy/scratch/compiled_source.js', source, 'utf8');
  
  const wrappedCode = `(function() { ${source} })`;
  new vm.Script(wrappedCode, { filename: 'D:/BasicERPAcademy/scratch/compiled_source.js' });
  console.log("No syntax error found in compiled source!");
} catch (err) {
  console.error("Syntax Error Details:");
  console.error(err.message);
  console.error(err.stack);
}
