const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'ComplaintForm.jsx');
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('setError')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
