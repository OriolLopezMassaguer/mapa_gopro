import path from 'path';
import { execFile } from 'child_process';
import fs from 'fs';
import config from '../config.js';

export function generateThumbnail(videoPath, videoId) {
  const outputPath = path.join(config.thumbnailDir, `${videoId}.jpg`);

  if (fs.existsSync(outputPath)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-i', videoPath,
      '-ss', '2',
      '-vframes', '1',
      '-vf', 'scale=320:180',
      '-q:v', '5',
      '-y',
      outputPath,
    ], { timeout: 30000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
