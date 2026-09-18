// Generates PWA icon PNGs — a purple bead icon on transparent background.
// Pure Node.js, no external dependencies.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Generate a simple PNG file with raw pixel data
function generatePNG(size, filepath) {
  const pixels = Buffer.alloc(size * size * 4);

  // Draw a "bead" — purple circle on transparent background
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.34;
  const highlightR = size * 0.12;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;

      if (dist <= outerR) {
        // Base purple bead color
        let r = 108, g = 92, b = 231; // #6C5CE7

        // Darken edge slightly
        if (dist > innerR) {
          const edge = (dist - innerR) / (outerR - innerR);
          const dark = 0.7 + 0.3 * (1 - edge);
          r = Math.round(r * dark);
          g = Math.round(g * dark);
          b = Math.round(b * dark);
        }

        // Highlight spot at top-left
        const hdx = x - (cx - size * 0.12);
        const hdy = y - (cy - size * 0.12);
        const hdist = Math.sqrt(hdx * hdx + hdy * hdy);
        if (hdist < highlightR) {
          const shine = (1 - hdist / highlightR) * 0.5;
          r = Math.round(r + (255 - r) * shine);
          g = Math.round(g + (255 - g) * shine);
          b = Math.round(b + (255 - b) * shine);
        }

        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      } else {
        // Transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  // Build PNG manually
  const chunks = [];

  // PNG Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  chunks.push(createChunk('IHDR', ihdr));

  // IDAT Chunk — raw pixel data with filter byte 0 per row
  const raw = Buffer.alloc(size * size * 4 + size); // +size for filter bytes
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const compressed = zlib.deflateSync(raw);
  chunks.push(createChunk('IDAT', compressed));

  // IEND Chunk
  chunks.push(createChunk('IEND', Buffer.alloc(0)));

  fs.writeFileSync(filepath, Buffer.concat(chunks));
  console.log(`  Generated ${size}x${size} → ${filepath}`);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// CRC32 for PNG
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.resolve(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

generatePNG(192, path.join(iconsDir, 'icon-192.png'));
generatePNG(512, path.join(iconsDir, 'icon-512.png'));

console.log('Icons generated successfully.');
