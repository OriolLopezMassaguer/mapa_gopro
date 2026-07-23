import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, 'client');

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5173'], {
  cwd: clientDir,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code));
