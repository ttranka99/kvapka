// assets/js/export/zip.js
//
// Minimal ZIP writer (method 0 = stored, no compression). Enough for the few
// KB of JSON exported, and keeps the app a static site with no library or
// CDN, working on file://.

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

/**
 * Builds a ZIP archive from text files.
 * @param {{ path: string, data: string }[]} files — forward-slash paths and
 *   string contents (encoded as UTF-8).
 * @returns {Blob}
 */
export function createZip(files) {
  const encoder = new TextEncoder();
  const now = dosDateTime(new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.data);
    const crc = crc32(dataBytes);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // flags: UTF-8 filenames
    local.setUint16(8, 0, true); // method: stored
    local.setUint16(10, now.time, true);
    local.setUint16(12, now.day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dataBytes.length, true); // compressed size
    local.setUint32(22, dataBytes.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra length

    parts.push(new Uint8Array(local.buffer), nameBytes, dataBytes);

    const cdir = new DataView(new ArrayBuffer(46));
    cdir.setUint32(0, 0x02014b50, true); // central directory signature
    cdir.setUint16(4, 20, true); // version made by
    cdir.setUint16(6, 20, true); // version needed
    cdir.setUint16(8, 0x0800, true);
    cdir.setUint16(10, 0, true);
    cdir.setUint16(12, now.time, true);
    cdir.setUint16(14, now.day, true);
    cdir.setUint32(16, crc, true);
    cdir.setUint32(20, dataBytes.length, true);
    cdir.setUint32(24, dataBytes.length, true);
    cdir.setUint16(28, nameBytes.length, true);
    cdir.setUint32(42, offset, true); // local header offset
    central.push(new Uint8Array(cdir.buffer), nameBytes);

    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralSize = central.reduce((s, p) => s + p.length, 0);

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); // end of central directory signature
  eocd.setUint16(8, files.length, true); // entries on this disk
  eocd.setUint16(10, files.length, true); // total entries
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true); // central directory offset

  return new Blob([...parts, ...central, new Uint8Array(eocd.buffer)], {
    type: "application/zip"
  });
}
