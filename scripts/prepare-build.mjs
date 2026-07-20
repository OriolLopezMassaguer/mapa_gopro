/**
 * Copies the ffmpeg binary (found on PATH) into build-resources/ so
 * electron-builder can pick it up as an extraResource.
 *
 * Alternatively, place ffmpeg.exe directly in build-resources/ before building.
 */
import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

const destDir = 'build-resources'
const destFile = path.join(destDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')

mkdirSync(destDir, { recursive: true })

// Allow caller to short-circuit by pre-placing the binary
if (existsSync(destFile)) {
  console.log(`ffmpeg binary already present at ${destFile}, skipping copy.`)
  process.exit(0)
}

// Locate ffmpeg on PATH
let ffmpegPath
try {
  const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'
  ffmpegPath = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim()
} catch {
  console.error(
    'ERROR: ffmpeg not found on PATH.\n' +
    `Place ffmpeg${process.platform === 'win32' ? '.exe' : ''} in ${destDir}/ manually and re-run.`
  )
  process.exit(1)
}

copyFileSync(ffmpegPath, destFile)
console.log(`ffmpeg binary → ${destFile}`)
