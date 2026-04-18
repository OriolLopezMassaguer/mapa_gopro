import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import mediaRoutes from './routes/videos.js';
import passesRoutes from './routes/passes.js';
import { loadCache, processNewFiles } from './services/cacheManager.js';

// Prevent process crashes from killing the server
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.message || err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/media', mediaRoutes);
app.use('/api/passes', passesRoutes);

// In production, serve the built React app
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = config.port;
app.listen(PORT, async () => {
  const t0 = Date.now();
  const elapsed = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

  console.log('');
  console.log('========================================');
  console.log('  mapa_gopro server starting');
  console.log('========================================');
  console.log(`  Port        : ${PORT}`);
  console.log(`  Video dir   : ${config.videoDir}`);
  console.log(`  Media dir   : ${config.mediaDir}`);
  console.log(`  Cache dir   : ${config.cacheDir}`);
  console.log(`  Concurrency : ${process.env.CACHE_CONCURRENCY || 4}`);
  console.log(`  Env         : ${process.env.NODE_ENV || 'development'}`);
  console.log('');

  let toProcess = [];
  try {
    toProcess = await loadCache();
  } catch (err) {
    console.error(`[${elapsed()}] Cache load error:`, err.message);
  }

  console.log('');
  console.log('========================================');
  console.log(`  READY — http://localhost:${PORT}  (${elapsed()})`);
  if (toProcess.length > 0)
    console.log(`  ${toProcess.length} new files queued for background processing`);
  console.log('========================================');
  console.log('');

  processNewFiles(toProcess).catch(err =>
    console.error('Background cache update error:', err.message)
  );
});
