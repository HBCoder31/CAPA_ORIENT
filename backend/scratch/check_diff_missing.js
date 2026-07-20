const { execSync } = require('child_process');
const path = require('path');

try {
  const root = path.join(__dirname, '..', '..');
  const diff = execSync('git diff -- backend/controllers/complaintController.js', { cwd: root, encoding: 'utf8' });
  const lines = diff.split('\n');
  lines.forEach((line) => {
    if (line.startsWith('-') && line.toLowerCase().includes('missing')) {
      console.log(line);
    }
  });
} catch (e) {
  console.error(e);
}
