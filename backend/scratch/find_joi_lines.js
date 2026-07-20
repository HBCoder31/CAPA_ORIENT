const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'backend', 'controllers', 'complaintController.js');
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('joi')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
