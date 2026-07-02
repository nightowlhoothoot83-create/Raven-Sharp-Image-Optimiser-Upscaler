// Client-side image processing — ported from Raven Sharp HTML.
// Pure functions: resize/enhance/sharpen on canvas + DPI metadata injection
// + 100%-local AI background removal via @imgly/background-removal.

import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

export const PRESET_SIZES = [
  { label: "Custom", w: 0, h: 0 },
  { label: "A4 (300DPI) — 2480×3508", w: 2480, h: 3508 },
  { label: "Square POD — 3000×3000", w: 3000, h: 3000 },
  { label: "Instagram — 1080×1080", w: 1080, h: 1080 },
  { label: "Instagram Story — 1080×1920", w: 1080, h: 1920 },
  { label: "KDP 6×9 in @300 — 1800×2700", w: 1800, h: 2700 },
  { label: "KDP 8.5×11 @300 — 2550×3300", w: 2550, h: 3300 },
  { label: "Letter @300 — 2550×3300", w: 2550, h: 3300 },
];

export const DEFAULT_SETTINGS = {
  format: "jpeg", // jpeg | png | webp
  quality: 90, // 60..100
  dpi: 300, // 72|150|300|600
  compression: "balanced", // quality|balanced|smallest
  maxKB: 0,
  width: 0,
  height: 0,
  preset: 0,
  lockAspect: true,
  upscale: true,
  bleed: false,
  sharpen: 2,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  auto: false,
  removeBg: false,
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function applyPixelAdjustments(ctx, w, h, brightness, contrast, saturation) {
  if (brightness === 0 && contrast === 0 && saturation === 0) return;
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (brightness !== 0) { r += brightness; g += brightness; b += brightness; }
    if (contrast !== 0) {
      r = cFactor * (r - 128) + 128;
      g = cFactor * (g - 128) + 128;
      b = cFactor * (b - 128) + 128;
    }
    if (saturation !== 0) {
      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      const s = 1 + saturation / 100;
      r = gray + (r - gray) * s;
      g = gray + (g - gray) * s;
      b = gray + (b - gray) * s;
    }
    d[i] = clamp(r, 0, 255);
    d[i + 1] = clamp(g, 0, 255);
    d[i + 2] = clamp(b, 0, 255);
  }
  ctx.putImageData(id, 0, 0);
}

function applySharpening(ctx, w, h, amount) {
  if (!amount) return;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data, o = out.data;
  const k = amount / 5; // strength 0..2
  const center = 1 + 4 * k;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          s[i + c] * center -
          s[i - 4 + c] * k -
          s[i + 4 + c] * k -
          s[i - w * 4 + c] * k -
          s[i + w * 4 + c] * k;
        o[i + c] = clamp(v, 0, 255);
      }
      o[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

// Convert dataURL -> Blob
function dataURLtoBlob(dataURL) {
  const [head, base] = dataURL.split(",");
  const mime = head.match(/:([^;]+);/)[1];
  const bin = atob(base);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// CRC32 for PNG chunks
function crc32(data) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

async function injectPNGDPI(blob, dpi) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const ppm = Math.round(dpi * 39.3701);
  // Build pHYs chunk: 4 bytes len, "pHYs", 9 bytes data, 4 bytes CRC
  const data = new Uint8Array(9);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, ppm); dv.setUint32(4, ppm); data[8] = 1;
  const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]);
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type, 0); crcInput.set(data, type.length);
  const crc = crc32(crcInput);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  new DataView(chunk.buffer).setUint32(0, 9);
  chunk.set(type, 4); chunk.set(data, 8);
  new DataView(chunk.buffer).setUint32(17, crc);
  // Insert after IHDR (which is first chunk after 8-byte signature)
  // PNG sig 8 bytes, IHDR len 4 + "IHDR" 4 + 13 data + 4 crc = 25, so IHDR ends at 33
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  // Remove existing pHYs if any
  let cleaned = buf;
  let pos = 8;
  while (pos < cleaned.length - 8) {
    const len = new DataView(cleaned.buffer, cleaned.byteOffset + pos, 4).getUint32(0);
    const ttype = String.fromCharCode(cleaned[pos + 4], cleaned[pos + 5], cleaned[pos + 6], cleaned[pos + 7]);
    if (ttype === "pHYs") {
      const total = 4 + 4 + len + 4;
      const next = new Uint8Array(cleaned.length - total);
      next.set(cleaned.subarray(0, pos), 0);
      next.set(cleaned.subarray(pos + total), pos);
      cleaned = next;
      break;
    }
    if (ttype === "IDAT" || ttype === "IEND") break;
    pos += 4 + 4 + len + 4;
  }
  const out = new Uint8Array(cleaned.length + chunk.length);
  out.set(cleaned.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(cleaned.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return new Blob([out], { type: "image/png" });
}

async function injectJPEGDPI(blob, dpi) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // APP0 marker is at offset 2 (after SOI 0xFFD8)
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return blob;
  // Find APP0 (0xFFE0) JFIF
  let pos = 2;
  while (pos < buf.length - 4) {
    if (buf[pos] === 0xff && buf[pos + 1] === 0xe0) {
      // Skip length (2) and "JFIF\0" (5) -> at pos+9 there is version (2 bytes) then units (1) and density (4)
      const unitsOffset = pos + 11;
      buf[unitsOffset] = 1; // 1 = dots per inch
      const dv = new DataView(buf.buffer, buf.byteOffset + unitsOffset + 1, 4);
      dv.setUint16(0, dpi);
      dv.setUint16(2, dpi);
      break;
    }
    if (buf[pos] !== 0xff) break;
    const len = (buf[pos + 2] << 8) | buf[pos + 3];
    pos += 2 + len;
  }
  return new Blob([buf], { type: "image/jpeg" });
}

async function removeBackground(file, onProgress) {
  // 100% local — runs ONNX U²-Net in the browser via WebAssembly + Web Worker.
  // First call downloads ~40-80 MB of model files (cached by the browser thereafter).
  const blob = await imglyRemoveBackground(file, {
    progress: (key, current, total) => {
      if (onProgress && total > 0) {
        const pct = Math.round((current / total) * 100);
        onProgress(`Removing background — ${key} ${pct}%`);
      }
    },
  });
  return new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" });
}

export async function processImage(file, settings, onProgress) {
  let workingFile = file;

  // 1. Optional background removal (fully local, no API)
  if (settings.removeBg) {
    onProgress?.("Removing background…");
    workingFile = await removeBackground(file, onProgress);
  }

  onProgress?.("Loading image…");
  const dataURL = await readFileAsDataURL(workingFile);
  const img = await loadImage(dataURL);

  // Auto mode: sensible defaults
  let { width, height, sharpen, brightness, contrast, saturation, dpi, format, quality, compression, lockAspect, upscale, bleed } = settings;
  if (settings.auto) {
    sharpen = Math.max(sharpen, 3);
    contrast = 6;
    saturation = 4;
    dpi = Math.max(dpi, 300);
  }

  let outW = width || img.naturalWidth;
  let outH = height || img.naturalHeight;
  if (lockAspect && width && !height) outH = Math.round((width * img.naturalHeight) / img.naturalWidth);
  if (lockAspect && height && !width) outW = Math.round((height * img.naturalWidth) / img.naturalHeight);
  if (!upscale) {
    if (outW > img.naturalWidth) outW = img.naturalWidth;
    if (outH > img.naturalHeight) outH = img.naturalHeight;
  }
  const bleedPx = bleed ? Math.round((3 / 25.4) * dpi) : 0; // 3mm bleed
  const cw = outW + bleedPx * 2;
  const ch = outH + bleedPx * 2;

  onProgress?.("Resizing…");
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.drawImage(img, bleedPx, bleedPx, outW, outH);

  applyPixelAdjustments(ctx, cw, ch, brightness, contrast, saturation);
  if (sharpen > 0) {
    onProgress?.("Sharpening…");
    applySharpening(ctx, cw, ch, sharpen);
  }

  // Compression mode
  let q = clamp(quality, 0, 100) / 100;
  if (compression === "smallest") q = Math.min(q, 0.7);
  if (compression === "balanced") q = Math.min(q, 0.85);

  onProgress?.("Encoding…");
  const mimeMap = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  let outDataURL = canvas.toDataURL(mimeMap[format], format === "png" ? undefined : q);
  let blob = dataURLtoBlob(outDataURL);

  // Try to honor maxKB by reducing quality (jpeg/webp only)
  if (settings.maxKB > 0 && format !== "png") {
    let qq = q;
    while (blob.size / 1024 > settings.maxKB && qq > 0.4) {
      qq -= 0.05;
      outDataURL = canvas.toDataURL(mimeMap[format], qq);
      blob = dataURLtoBlob(outDataURL);
    }
  }

  // DPI injection
  if (format === "png") blob = await injectPNGDPI(blob, dpi);
  else if (format === "jpeg") blob = await injectJPEGDPI(blob, dpi);

  const ext = format === "jpeg" ? "jpg" : format;
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return {
    name: `${baseName}-optimised.${ext}`,
    blob,
    outputURL: URL.createObjectURL(blob),
    originalURL: dataURL,
    originalSize: file.size,
    outputSize: blob.size,
    width: cw,
    height: ch,
    dpi,
    format,
  };
}
