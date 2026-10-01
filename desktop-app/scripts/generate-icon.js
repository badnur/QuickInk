const fs = require('fs')
const path = require('path')
const { Jimp } = require('jimp')

async function buildIco() {
  const masterPath = path.join(__dirname, '..', 'src', 'assets', 'printkoro-master.png')
  if (!fs.existsSync(masterPath)) {
    console.error('Master icon not found at:', masterPath)
    process.exit(1)
  }

  console.log('Reading master icon from:', masterPath)
  const img = await Jimp.read(masterPath)
  const sizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = []

  for (const size of sizes) {
    const resized = img.clone().resize({ w: size, h: size })
    const buf = await resized.getBuffer('image/png')
    pngBuffers.push({ size, buf })
  }

  // Build ICO header (6 bytes)
  const count = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type 1 = Icon (.ico)
  header.writeUInt16LE(count, 4) // Count of icon images

  let offset = 6 + count * 16
  const dirEntries = []
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(item.size >= 256 ? 0 : item.size, 0) // Width (0 means 256)
    entry.writeUInt8(item.size >= 256 ? 0 : item.size, 1) // Height (0 means 256)
    entry.writeUInt8(0, 2) // Color count
    entry.writeUInt8(0, 3) // Reserved
    entry.writeUInt16LE(1, 4) // Color planes
    entry.writeUInt16LE(32, 6) // Bits per pixel (32bpp RGBA)
    entry.writeUInt32LE(item.buf.length, 8) // Size of image data in bytes
    entry.writeUInt32LE(offset, 12) // Offset of image data from beginning of file
    dirEntries.push(entry)
    offset += item.buf.length
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buf)])

  const buildDir = path.join(__dirname, '..', 'build')
  const assetsDir = path.join(__dirname, '..', 'assets')
  const srcAssetsDir = path.join(__dirname, '..', 'src', 'assets')

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer)
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer)
  fs.writeFileSync(path.join(srcAssetsDir, 'icon.ico'), icoBuffer)

  // 256x256 PNG for taskbar/cross-platform
  const icon256 = await img.clone().resize({ w: 256, h: 256 }).getBuffer('image/png')
  fs.writeFileSync(path.join(buildDir, 'icon.png'), icon256)
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon256)

  console.log('✓ Successfully generated build/icon.ico, assets/icon.ico, and icon.png!')
}

buildIco().catch((err) => {
  console.error('Error generating icon:', err)
  process.exit(1)
})
