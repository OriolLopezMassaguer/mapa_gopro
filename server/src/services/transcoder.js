import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import config from '../config.js';
import { lowerChildPriority } from './priority.js';

const TRANSCODE_DIR = path.join(config.cacheDir, 'transcoded');

function getFfprobePath() {
  return process.env.FFPROBE_PATH || 'ffprobe';
}

function getFfmpegPath() {
  return config.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
}

function getTranscodedPath(id) {
  return path.join(TRANSCODE_DIR, `${id}.mp4`);
}

function getTempPath(id) {
  return path.join(TRANSCODE_DIR, `${id}.tmp.mp4`);
}

// Codecs the HTML5 <video> element can play in every major browser without help.
const BROWSER_SAFE_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1']);

// Probing just reads container/stream headers (no decoding), so it's cheap — but
// still cache the result per file path since /stream can be requested repeatedly
// (range requests during seeking).
const codecCache = new Map();

export function probeCodec(filepath) {
  if (codecCache.has(filepath)) return codecCache.get(filepath);

  const promise = new Promise((resolve) => {
    execFile(getFfprobePath(), [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'csv=p=0',
      filepath,
    ], { timeout: 10_000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      resolve(stdout.trim().toLowerCase() || null);
    });
  });

  codecCache.set(filepath, promise);
  return promise;
}

export async function needsTranscode(filepath) {
  const codec = await probeCodec(filepath);
  if (!codec) return false; // couldn't determine — don't block playback attempts
  return !BROWSER_SAFE_CODECS.has(codec);
}

export function isTranscodeReady(id) {
  try {
    return fs.statSync(getTranscodedPath(id)).size > 0;
  } catch {
    return false;
  }
}

// Dedupe concurrent transcode requests for the same video (e.g. multiple range
// requests from the same <video> tag, or several browser tabs).
const inProgress = new Map(); // id -> Promise

export function getTranscodeState(id) {
  if (isTranscodeReady(id)) return 'ready';
  if (inProgress.has(id)) return 'in-progress';
  return 'not-started';
}

export function startTranscode(filepath, id) {
  if (isTranscodeReady(id)) return Promise.resolve();
  if (inProgress.has(id)) return inProgress.get(id);

  const tempPath = getTempPath(id);
  const finalPath = getTranscodedPath(id);

  const promise = new Promise((resolve, reject) => {
    if (!fs.existsSync(TRANSCODE_DIR)) fs.mkdirSync(TRANSCODE_DIR, { recursive: true });

    const child = execFile(getFfmpegPath(), [
      '-i', filepath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y',
      tempPath,
    ], { maxBuffer: 1024 * 1024 * 10 }, (err) => {
      if (err) {
        try { fs.unlinkSync(tempPath); } catch { /* nothing to clean up */ }
        reject(err);
        return;
      }
      fs.renameSync(tempPath, finalPath);
      resolve();
    });
    lowerChildPriority(child.pid);
  });

  inProgress.set(id, promise);
  // Always clear the in-progress marker when it settles, whether it succeeded or not —
  // a failed transcode should be retryable on the next request.
  promise.finally(() => inProgress.delete(id));
  return promise;
}

export function getTranscodedFilePath(id) {
  return getTranscodedPath(id);
}
