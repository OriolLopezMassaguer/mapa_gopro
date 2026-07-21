import { app, BrowserWindow, Menu, dialog, shell } from 'electron'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, appendFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// ── Logging ───────────────────────────────────────────────────────────────────
// Use %TEMP% — always writable, no app.getPath() needed at module load time.

const LOG_PATH = path.join(os.tmpdir(), 'mapa-gopro-startup.log')

function setupLogging() {
  try {
    writeFileSync(LOG_PATH, `=== mapa_gopro startup ${new Date().toISOString()} ===\n`)
  } catch { /* ignore */ }

  const orig = { log: console.log, error: console.error, warn: console.warn }
  const write = (prefix, args) => {
    const line = `[${new Date().toISOString()}] ${prefix}${args.map(a =>
      typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
    try { appendFileSync(LOG_PATH, line) } catch { /* ignore */ }
    orig[prefix === '' ? 'log' : prefix === 'ERR ' ? 'error' : 'warn'].call(console, ...args)
  }
  console.log   = (...a) => write('', a)
  console.error = (...a) => write('ERR ', a)
  console.warn  = (...a) => write('WARN', a)
}

function log(msg) {
  console.log(`[boot] ${msg}`)
}

setupLogging()
log(`log → ${LOG_PATH}`)
log(`isDev=${isDev} platform=${process.platform} resourcesPath=${process.resourcesPath ?? 'n/a'}`)

// ── Settings ──────────────────────────────────────────────────────────────────

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try { return JSON.parse(readFileSync(settingsPath, 'utf8')) }
  catch { return {} }
}

function saveSettings(data) {
  writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}

// ── ffmpeg ────────────────────────────────────────────────────────────────────

function resolveFfmpegPath() {
  if (isDev) {
    // In dev, use whatever ffmpeg is on PATH (env var lets you override)
    return process.env.FFMPEG_PATH || null
  }
  const bin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  return path.join(process.resourcesPath, bin)
}

// ── Window ────────────────────────────────────────────────────────────────────

let win = null

async function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Mapa GoPro',
    webPreferences: { contextIsolation: true },
  })
  win.loadURL(
    'data:text/html,<html><body style="background:rgb(17,17,17);color:rgb(136,136,136);' +
    'font-family:sans-serif;display:flex;align-items:center;justify-content:center;' +
    'height:100vh;margin:0;font-size:1.2em"><p>Starting…</p></body></html>'
  )
  win.on('closed', () => { win = null })
}

// ── Menu ──────────────────────────────────────────────────────────────────────

function buildMenu(videoDir) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Change video folder…',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              title: 'Select GoPro video folder',
              properties: ['openDirectory'],
              defaultPath: videoDir || undefined,
            })
            if (canceled || !filePaths[0]) return
            saveSettings({ ...loadSettings(), videoDir: filePaths[0] })
            dialog.showMessageBox(win, {
              type: 'info',
              message: 'Video folder updated.',
              detail: 'Restart the app to apply the change.',
              buttons: ['OK'],
            })
          },
        },
        {
          label: 'Open video folder',
          enabled: !!videoDir,
          click: () => shell.openPath(videoDir),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Server readiness ──────────────────────────────────────────────────────────

async function waitForServer(port, timeout = 30_000) {
  const url = `http://localhost:${port}/api/passes`
  const deadline = Date.now() + timeout
  let attempt = 0
  while (Date.now() < deadline) {
    attempt++
    try {
      const res = await fetch(url)
      log(`waitForServer attempt ${attempt} → HTTP ${res.status}`)
      if (res.status < 500) return true
    } catch (err) {
      if (attempt === 1 || attempt % 10 === 0)
        log(`waitForServer attempt ${attempt} → ${err?.message ?? err}`)
    }
    await new Promise(r => setTimeout(r, 400))
  }
  log(`waitForServer timed out after ${attempt} attempts`)
  return false
}

// ── Boot ──────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log('app ready')
  await createWindow()
  log('window created')

  const settings = loadSettings()
  let videoDir = settings.videoDir || ''
  log(`settings loaded — videoDir="${videoDir}"`)

  // First run: prompt for video folder
  if (!videoDir) {
    log('no videoDir in settings — showing folder picker dialog')
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select your GoPro video folder',
      message: 'Choose the root directory where your GoPro videos are stored.',
      properties: ['openDirectory'],
    })
    log(`folder picker result — canceled=${canceled} path="${filePaths?.[0] ?? ''}"`)
    if (!canceled && filePaths[0]) {
      videoDir = filePaths[0]
      saveSettings({ ...settings, videoDir })
    }
  }

  buildMenu(videoDir)

  // Set environment for the Express server before importing it
  const ffmpegPath = resolveFfmpegPath()
  process.env.VIDEO_DIR   = videoDir
  process.env.FFMPEG_PATH = ffmpegPath
  process.env.PORT        = String(settings.port || 3001)
  process.env.NODE_ENV    = isDev ? 'development' : 'production'
  // client/dist is an extraResource (real filesystem) in prod; source path in dev
  process.env.CLIENT_DIST = isDev
    ? path.join(__dirname, '../client/dist')
    : path.join(process.resourcesPath, 'client-dist')
  log(`env set — PORT=${process.env.PORT} FFMPEG_PATH="${ffmpegPath}" VIDEO_DIR="${videoDir}" CLIENT_DIST="${process.env.CLIENT_DIST}"`)

  // Start Express server in-process
  log('importing server…')
  try {
    await import('../server/src/index.js')
    log('server module imported')
  } catch (err) {
    const msg = err?.message ?? String(err)
    log(`server import FAILED: ${msg}`)
    console.error(err)
    dialog.showErrorBox(
      'Server failed to load',
      `${msg}\n\nLog: ${LOG_PATH}`
    )
    app.quit()
    return
  }

  // In dev, Vite (port 5173) provides HMR; in prod, Express serves the built client
  const port = parseInt(process.env.PORT, 10)
  const clientURL = isDev ? 'http://localhost:5173' : `http://localhost:${port}`
  log(`waiting for server on port ${port}…`)

  if (await waitForServer(port)) {
    log(`server ready — loading ${clientURL}`)
    win?.loadURL(clientURL)
  } else {
    log('server did not become ready within timeout')
    win?.loadURL(
      'data:text/html,<html><body style="background:rgb(17,17,17);color:rgb(200,0,0);' +
      'font-family:sans-serif;display:flex;align-items:center;justify-content:center;' +
      'height:100vh;margin:0"><p>Server failed to start. Check that your video folder is accessible.</p></body></html>'
    )
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!win) createWindow()
})
