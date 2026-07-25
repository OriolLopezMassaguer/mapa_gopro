import path from 'path';
import { execFile } from 'child_process';
import fs from 'fs';
import config from '../config.js';
import { lowerChildPriority } from './priority.js';

function runFfmpeg(args, timeout) {
  return new Promise((resolve, reject) => {
    const child = execFile(config.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg', args, { timeout }, (err) => {
      if (err) reject(err);
      else resolve();
    });
    lowerChildPriority(child.pid);
  });
}

export function generateThumbnail(videoPath, videoId) {
  const outputPath = path.join(config.thumbnailDir, `${videoId}.jpg`);

  if (fs.existsSync(outputPath)) {
    if (fs.statSync(outputPath).size >= 100) return Promise.resolve();
    fs.unlinkSync(outputPath); // corrupt — delete and regenerate
  }

  return runFfmpeg([
    '-ss', '2',
    '-i', videoPath,
    '-vframes', '1',
    '-vf', 'scale=320:180',
    '-q:v', '5',
    '-y',
    outputPath,
  ], 30_000);
}

// Downscaled, cover-cropped copy of a photo — much smaller to load than the original
// (often several MB) for the map markers and table thumbnail column.
export function generatePhotoThumbnail(photoPath, photoId) {
  const outputPath = path.join(config.thumbnailDir, `${photoId}.jpg`);

  if (fs.existsSync(outputPath)) {
    if (fs.statSync(outputPath).size >= 100) return Promise.resolve();
    fs.unlinkSync(outputPath);
  }

  return runFfmpeg([
    '-i', photoPath,
    '-vf', 'scale=320:180:force_original_aspect_ratio=increase,crop=320:180',
    '-q:v', '5',
    '-y',
    outputPath,
  ], 30_000);
}
