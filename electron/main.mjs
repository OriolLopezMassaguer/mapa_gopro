import { app, BrowserWindow, Menu, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

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
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return true
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 400))
  }
  return false
}

// ── Boot ──────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await createWindow()

  const settings = loadSettings()
  let videoDir = settings.videoDir || ''

  // First run: prompt for video folder
  if (!videoDir) {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select your GoPro video folder',
      message: 'Choose the root directory where your GoPro videos are stored.',
      properties: ['openDirectory'],
    })
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

  // Start Express server in-process
  await import('../server/src/index.js')

  // In dev, Vite (port 5173) provides HMR; in prod, Express serves the built client
  const port = parseInt(process.env.PORT, 10)
  const clientURL = isDev ? 'http://localhost:5173' : `http://localhost:${port}`

  if (await waitForServer(port)) {
    win?.loadURL(clientURL)
  } else {
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
