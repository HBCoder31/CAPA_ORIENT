const fs = require('fs');
const path = require('path');

const target = 'missing';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
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
    }
  }
}

walk(path.join(__dirname, '..', '..', 'frontend', 'src'));
console.log('Search done!');
