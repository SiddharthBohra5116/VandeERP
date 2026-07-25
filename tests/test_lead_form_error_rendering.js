const assert = require('assert');
const fs = require('fs');

const form = fs.readFileSync('views/counsellor/lead-form.ejs', 'utf8');
const layout = fs.readFileSync('views/layouts/main.ejs', 'utf8');

assert(!form.includes('border-color:var(--red); color:var(--red)'));
assert(layout.includes("String(error).trim() !== '1'"));

console.log('Lead form uses the shared error renderer.');
