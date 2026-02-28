import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import mediaRoutes from './routes/videos.js';
import { initializeCache } from './services/cacheManager.js';

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
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Media directory: ${config.videoDir}`);
  console.log('Starting cache initialization...\n');

  try {
    await initializeCache();
    console.log('\nServer ready with all cached data.');
  } catch (err) {
    console.error('Cache initialization error:', err.message);
    console.log('Server continues running with whatever data was loaded.');
  }
});
