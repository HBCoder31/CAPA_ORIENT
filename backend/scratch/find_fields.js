const fs = require('fs');
const path = require('path');

const target = 'line item fields';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.gemini') continue;
    
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else {
      try {
        const content = fs.readFileSync(full, 'utf8');
        if (content.toLowerCase().includes(target)) {
          console.log(`FOUND in: ${full}`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.toLowerCase().includes(target)) {
              console.log(`  Line ${idx + 1}: ${line.trim()}`);
            }
          });
        }
      } catch (e) {
        // ignore binary
      }
    }
  }
}

walk(path.join(__dirname, '..', '..'));
console.log('Search done!');
