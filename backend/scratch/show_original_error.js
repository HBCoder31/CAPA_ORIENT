const { execSync } = require('child_process');
const path = require('path');

try {
  const root = path.join(__dirname, '..', '..');
  const originalFile = execSync('git show HEAD:backend/controllers/complaintController.js', { cwd: root, encoding: 'utf8' });
  const lines = originalFile.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('sendError')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} catch (e) {
  console.error(e);
}
