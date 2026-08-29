/**
 * Writing a PNG, which is less work than pulling in something that can.
 *
 * Two of this project's assets are drawn by code rather than by hand — the
 * grain over the finished solid, and the app icons — and both would otherwise
 * carry an image library into the build for the sake of one file each. A PNG is
 * a signature, a header, the pixels deflated, and an end marker; the only part
 * that is not obvious is that every chunk carries a CRC, and zlib is in Node.
 *
 * Rows are written with filter 0 (none). Filters exist to make the pixel data
 * compress better, and neither of these images is big enough for the difference
 * to be worth the code that chooses between them.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (kind, body) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
};

/** how many bytes a pixel takes, per PNG's numbering of what a pixel is */
const CHANNELS = { 4: 2, 6: 4 };

/**
 * `pixels` is one row after another with no filter bytes — those are added
 * here, since they are a property of the format rather than of the image.
 *
 * `colorType` is 4 for grey-with-alpha or 6 for RGBA; both are eight bits a
 * channel, which is the only depth anything here needs.
 */
export const encodePng = ({ width, height, colorType, pixels }) => {
  const stride = width * CHANNELS[colorType];
  if (pixels.length !== stride * height) {
    throw new Error(`expected ${stride * height} bytes of pixels, got ${pixels.length}`);
  }

  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = colorType;
  // the remaining three are compression, filter and interlace, all of which
  // have only ever had one method

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export const writePng = (url, image) => {
  const png = encodePng(image);
  writeFileSync(url, png);
  return png.length;
};
