const fs = require('fs');
const path = require('path');

const target1 = 'complaint header';
const target2 = 'line item fields';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.gemini') continue;
    
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.toLowerCase().includes(target1) || content.toLowerCase().includes(target2)) {
        console.log(`FOUND in: ${full}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(target1) || line.toLowerCase().includes(target2)) {
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

walk(path.join(__dirname, '..', '..'));
console.log('Search done!');
