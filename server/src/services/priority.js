import os from 'os';
import fs from 'fs';

const LOW = os.constants.priority.PRIORITY_LOW;

// Best-effort: lower the OS scheduling priority of a child process (e.g. ffmpeg) so
// background thumbnail generation doesn't compete with the Express server for CPU.
// Cross-platform via libuv (os.setPriority); silently a no-op if unsupported.
export function lowerChildPriority(pid) {
  try {
    os.setPriority(pid, LOW);
  } catch { /* not critical — thumbnail generation still works at normal priority */ }
}

// Best-effort: lower the OS scheduling priority of the *calling* worker thread.
// Linux schedules per-thread (task) and setpriority() accepts a thread id directly, so
// this deprioritizes just this extraction worker without touching the main server thread.
// No equivalent exists on Windows/macOS without a native addon, so this is Linux-only.
export function lowerOwnThreadPriority() {
  if (process.platform !== 'linux') return;
  try {
    const stat = fs.readFileSync('/proc/thread-self/stat', 'utf-8');
    const tid = parseInt(stat.slice(0, stat.indexOf(' ')), 10);
    if (tid) os.setPriority(tid, LOW);
  } catch { /* not critical — extraction still works at normal priority */ }
}
