// Converts all JPG/PNG in assets/ to WebP using sharp.
// Originals are kept; WebP files are written alongside them.
// Run with: node scripts/convert-webp.js
import sharp from 'sharp'
import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ASSETS = join(__dirname, '../assets')
const QUALITY = 85

const files = readdirSync(ASSETS).filter(f => /\.(jpg|jpeg|png)$/i.test(f))

let converted = 0
for (const file of files) {
  const src = join(ASSETS, file)
  const dest = join(ASSETS, basename(file, extname(file)) + '.webp')
  try {
    const srcSize = statSync(src).size
    await sharp(src).webp({ quality: QUALITY }).toFile(dest)
    const destSize = statSync(dest).size
    const saving = ((1 - destSize / srcSize) * 100).toFixed(1)
    console.log(`  [OK] ${file} → ${basename(dest)}  (${saving}% smaller)`)
    converted++
  } catch (err) {
    console.error(`  [ERR] ${file}: ${err.message}`)
  }
}
console.log(`\nDone — ${converted}/${files.length} images converted.`)
