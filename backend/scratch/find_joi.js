const fs = require('fs');
const path = require('path');

const target = 'joi';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.gemini') continue;
    
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.toLowerCase().includes(target)) {
        console.log(`FOUND Joi in: ${full}`);
      }
    }
  }
}

walk(path.join(__dirname, '..', '..', 'backend', 'controllers'));
walk(path.join(__dirname, '..', '..', 'backend', 'routes'));
console.log('Search done!');
