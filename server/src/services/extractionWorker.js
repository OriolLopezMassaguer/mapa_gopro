import { workerData, parentPort } from 'worker_threads';
import { extractVideoTelemetry, extractPhotoGps } from './telemetryExtractor.js';
import { lowerOwnThreadPriority } from './priority.js';

const { file } = workerData;

lowerOwnThreadPriority();

try {
  let result;
  if (file.type === 'video') {
    result = await extractVideoTelemetry(file.filepath);
  } else {
    result = await extractPhotoGps(file.filepath);
  }
  parentPort.postMessage({ ok: true, result });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
