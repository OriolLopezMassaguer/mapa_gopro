import { workerData, parentPort } from 'worker_threads';
import { extractVideoTelemetry, extractPhotoGps } from './telemetryExtractor.js';

const { file } = workerData;

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
