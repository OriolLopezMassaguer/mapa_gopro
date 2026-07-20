/**
 * Copies the platform-specific ffmpeg binary from ffmpeg-static into
 * build-resources/ so electron-builder can pick it up as an extraResource.
 */
import ffmpegPath from 'ffmpeg-static'
import { copyFileSync, mkdirSync } from 'fs'
import path from 'path'

const dest = path.join('build-resources', path.basename(ffmpegPath))
mkdirSync('build-resources', { recursive: true })
copyFileSync(ffmpegPath, dest)
console.log(`ffmpeg binary → ${dest}`)
