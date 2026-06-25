/**
 * Raven Sharp Image Optimiser — Client-side Processing
 *
 * All processing is client-side EXCEPT AI upscaling which calls backend → Replicate Real-ESRGAN.
 *
 * Includes:
 * - Resize (presets + custom + aspect lock + bleed)
 * - DPI injection (PNG pHYs chunk + JPEG APP0) — print-safe
 * - Sharpen (unsharp mask style)
 * - Brightness / Contrast / Saturation
 * - Background removal (local @imgly — no API needed)
 * - Crop (free, locked aspect, rule-of-thirds)
 * - Watermark (text or image)
 * - Format conversion + quality + maxKB
 * - Output presets (Gelato, Redbubble, Etsy, Instagram, etc.)
 * - EXIF strip
 */

import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

// ── Presets ────────────────────────────────────────────────────────────────
export const PRESET_SIZES = [
  { label: "Custom",                      w: 0,    h: 0    },
  { label: "A4 Print (300dpi) — 2480×3508", w: 2480, h: 3508 },
  { label: "A3 Print (300dpi) — 3508×4961", w: 3508, h: 4961 },
  { label: "Square POD — 3000×3000",      w: 3000, h: 3000 },
  { label: "Instagram — 1080×1080",        w: 1080, h: 1080 },
  { label: "Instagram Story — 1080×1920",  w: 1080, h: 1920 },
  { label: "KDP 6×9 @300 — 1800×2700",    w: 1800, h: 2700 },
  { label: "KDP 8.5×11 @300 — 2550×3300", w: 2550, h: 3300 },
];

export const OUTPUT_PRESETS = [
  { id: "none",       label: "None",           settings: {} },
  {
    id: "gelato",     label: "Gelato Print Ready",
    settings: { dpi: 300, format: "png", quality: 100, sharpen: 2, compression: "quality", removeBg: false }
  },
  {
    id: "redbubble",  label: "Redbubble",
    settings: { dpi: 150, format: "png", quality: 100, sharpen: 1, compression: "quality" }
  },
  {
    id: "etsy",       label: "Etsy Listing",
    settings: { dpi: 96,  format: "jpeg", quality: 88, sharpen: 1, compression: "balanced", width: 2000, height: 2000, lockAspect: true }
  },
  {
    id: "printify",   label: "Printify",
    settings: { dpi: 300, format: "png", quality: 100, sharpen: 2, compression: "quality" }
  },
  {
    id: "instagram",  label: "Instagram",
    settings: { dpi: 72,  format: "jpeg", quality: 85, sharpen: 1, width: 1080, height: 1080, lockAspect: false }
  },
  {
    id: "merch",      label: "Merch by Amazon",
    settings: { dpi: 300, format: "png", quality: 100, width: 4500, height: 5400, lockAspect: false }
  },
];

export const CROP_RATIOS = [
  { label: "Free",    ratio: null   },
  { label: "1:1",     ratio: 1      },
  { label: "4:3",     ratio: 4/3    },
  { label: "3:2",     ratio: 3/2    },
  { label: "16:9",    ratio: 16/9   },
  { label: "2:3",     ratio: 2/3    },
  { label: "3:4",     ratio: 3/4    },
  { label: "A4",      ratio: 1/1.41 },
];

export const DEFAULT_SETTINGS = {
  // Output
  format: "jpeg",
  quality: 90,
  dpi: 300,
  compression: "balanced",
  maxKB: 0,
  // Size
  width: 0,
  height: 0,
  preset: 0,
  lockAspect: true,
  upscale: true,
  bleed: false,
  // Enhancements
  sharpen: 2,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  auto: false,
  // Features
  removeBg: false,
  stripExif: false,
  watermarkText: "",
  watermarkPosition: "bottom-right",
  watermarkOpacity: 0.6,
  watermarkSize: 24,
  // Crop (null = no crop; set by CropTool component)
  crop: null, // { x, y, width, height } in original image pixels
  outputPreset: "none",
};

// ── Helpers ────────────────────────────────────────────────────────────────
export const readFileAsDataURL = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export const loadImage = (src) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function dataURLtoBlob(dataURL) {
  const [head, base] = dataURL.split(",");
  const mime = head.match(/:([^;]+);/)[1];
  const bin  = atob(base);
  const arr  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Pixel adjustments ──────────────────────────────────────────────────────
function applyPixelAdjustments(ctx, w, h, brightness, contrast, saturation) {
  if (brightness === 0 && contrast === 0 && saturation === 0) return;
  const id = ctx.getImageData(0, 0, w, h);
  const d  = id.data;
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    if (brightness !== 0) { r += brightness; g += brightness; b += brightness; }
    if (contrast  !== 0) {
      r = cf * (r - 128) + 128;
      g = cf * (g - 128) + 128;
      b = cf * (b - 128) + 128;
    }
    if (saturation !== 0) {
      const gray = 0.2989*r + 0.587*g + 0.114*b;
      const s    = 1 + saturation/100;
      r = gray + (r - gray) * s;
      g = gray + (g - gray) * s;
      b = gray + (b - gray) * s;
    }
    d[i] = clamp(r,0,255); d[i+1] = clamp(g,0,255); d[i+2] = clamp(b,0,255);
  }
  ctx.putImageData(id, 0, 0);
}

// ── Unsharp mask sharpen ───────────────────────────────────────────────────
function applySharpening(ctx, w, h, amount) {
  if (!amount) return;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s   = src.data, o = out.data;
  const k   = amount / 5;
  const ctr = 1 + 4 * k;
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = s[i+c]*ctr - s[i-4+c]*k - s[i+4+c]*k
                              - s[i-w*4+c]*k - s[i+w*4+c]*k;
        o[i+c] = clamp(v, 0, 255);
      }
      o[i+3] = s[i+3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

// ── Watermark ──────────────────────────────────────────────────────────────
function applyWatermark(ctx, w, h, text, position, opacity, size) {
  if (!text) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle   = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth   = 2;
  ctx.font        = `bold ${size}px 'Cabinet Grotesk', sans-serif`;
  ctx.textBaseline = "bottom";

  const padding  = size * 1.2;
  const metrics  = ctx.measureText(text);
  const tw       = metrics.width;
  const th       = size;

  let x, y;
  switch (position) {
    case "top-left":     x = padding;       y = padding + th; break;
    case "top-center":   x = (w - tw) / 2;  y = padding + th; break;
    case "top-right":    x = w - tw - padding; y = padding + th; break;
    case "center":       x = (w - tw) / 2;  y = (h + th) / 2; break;
    case "bottom-left":  x = padding;       y = h - padding;  break;
    case "bottom-center": x = (w - tw) / 2; y = h - padding;  break;
    default:             x = w - tw - padding; y = h - padding; // bottom-right
  }

  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── DPI injection (from original, fully working) ───────────────────────────
function crc32(data) {
  if (!crc32.t) {
    crc32.t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.t[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ crc32.t[(crc ^ data[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

async function injectPNGDPI(blob, dpi) {
  const buf  = new Uint8Array(await blob.arrayBuffer());
  const ppm  = Math.round(dpi * 39.3701);
  const data = new Uint8Array(9);
  const dv   = new DataView(data.buffer);
  dv.setUint32(0, ppm); dv.setUint32(4, ppm); data[8] = 1;
  const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]);
  const ci   = new Uint8Array(type.length + data.length);
  ci.set(type, 0); ci.set(data, type.length);
  const crc  = crc32(ci);
  const chunk = new Uint8Array(21);
  new DataView(chunk.buffer).setUint32(0, 9);
  chunk.set(type, 4); chunk.set(data, 8);
  new DataView(chunk.buffer).setUint32(17, crc);
  const ihdrEnd = 33;
  let cleaned = buf;
  let pos = 8;
  while (pos < cleaned.length - 8) {
    const len   = new DataView(cleaned.buffer, cleaned.byteOffset + pos, 4).getUint32(0);
    const ttype = String.fromCharCode(cleaned[pos+4], cleaned[pos+5], cleaned[pos+6], cleaned[pos+7]);
    if (ttype === "pHYs") {
      const total = 12 + len;
      const next  = new Uint8Array(cleaned.length - total);
      next.set(cleaned.subarray(0, pos), 0);
      next.set(cleaned.subarray(pos + total), pos);
      cleaned = next; break;
    }
    if (ttype === "IDAT" || ttype === "IEND") break;
    pos += 12 + len;
  }
  const out = new Uint8Array(cleaned.length + chunk.length);
  out.set(cleaned.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(cleaned.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return new Blob([out], { type: "image/png" });
}

async function injectJPEGDPI(blob, dpi) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return blob;
  let pos = 2;
  while (pos < buf.length - 4) {
    if (buf[pos] === 0xff && buf[pos+1] === 0xe0) {
      const uo = pos + 11;
      buf[uo] = 1;
      const dv = new DataView(buf.buffer, buf.byteOffset + uo + 1, 4);
      dv.setUint16(0, dpi); dv.setUint16(2, dpi);
      break;
    }
    if (buf[pos] !== 0xff) break;
    const len = (buf[pos+2] << 8) | buf[pos+3];
    pos += 2 + len;
  }
  return new Blob([buf], { type: "image/jpeg" });
}

// ── Background removal (local) ─────────────────────────────────────────────
async function removeBackground(file, onProgress) {
  const blob = await imglyRemoveBackground(file, {
    progress: (key, current, total) => {
      if (onProgress && total > 0)
        onProgress(`Removing background — ${key} ${Math.round((current/total)*100)}%`);
    },
  });
  return new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" });
}

// ── Main process function ──────────────────────────────────────────────────
/**
 * processImage — runs entirely client-side (except AI upscaling which is done
 * before this function is called via the /api/upscale endpoint).
 *
 * @param {File|{dataURL, width, height, name}} fileOrProcessed
 *   Either a File object or an already-processed object (e.g. after AI upscale)
 * @param {object} settings — merged DEFAULT_SETTINGS + user overrides
 * @param {function} onProgress — (message: string) => void
 */
export async function processImage(fileOrProcessed, settings, onProgress) {
  let workingFile = fileOrProcessed;

  // 1. Background removal (local, no API)
  if (settings.removeBg && workingFile instanceof File) {
    onProgress?.("Removing background…");
    workingFile = await removeBackground(workingFile, onProgress);
  }

  onProgress?.("Loading image…");
  const dataURL = workingFile instanceof File
    ? await readFileAsDataURL(workingFile)
    : workingFile.dataURL;
  const img = await loadImage(dataURL);

  // 2. Apply output preset settings
  let s = { ...settings };
  if (s.outputPreset && s.outputPreset !== "none") {
    const preset = OUTPUT_PRESETS.find(p => p.id === s.outputPreset);
    if (preset) s = { ...s, ...preset.settings };
  }

  // 3. Auto-enhance
  if (s.auto) {
    s.sharpen    = Math.max(s.sharpen, 3);
    s.contrast   = 6;
    s.saturation = 4;
    s.dpi        = Math.max(s.dpi, 300);
  }

  // 4. Crop (applied first to get the right source dimensions)
  let sourceImg = img;
  let sourceDataURL = dataURL;
  if (s.crop) {
    const { x, y, width: cw, height: ch } = s.crop;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width  = cw;
    cropCanvas.height = ch;
    const cropCtx = cropCanvas.getContext("2d");
    cropCtx.drawImage(img, x, y, cw, ch, 0, 0, cw, ch);
    sourceDataURL = cropCanvas.toDataURL("image/png");
    sourceImg     = await loadImage(sourceDataURL);
  }

  // 5. Determine output dimensions
  let outW = s.width  || sourceImg.naturalWidth;
  let outH = s.height || sourceImg.naturalHeight;
  if (s.lockAspect && s.width && !s.height)
    outH = Math.round((s.width  * sourceImg.naturalHeight) / sourceImg.naturalWidth);
  if (s.lockAspect && s.height && !s.width)
    outW = Math.round((s.height * sourceImg.naturalWidth)  / sourceImg.naturalHeight);
  if (!s.upscale) {
    if (outW > sourceImg.naturalWidth)  outW = sourceImg.naturalWidth;
    if (outH > sourceImg.naturalHeight) outH = sourceImg.naturalHeight;
  }

  // 6. Bleed (3mm at target DPI)
  const bleedPx = s.bleed ? Math.round((3 / 25.4) * s.dpi) : 0;
  const cw = outW + bleedPx * 2;
  const ch = outH + bleedPx * 2;

  onProgress?.("Rendering…");
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (s.format === "jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,cw,ch); }
  ctx.drawImage(sourceImg, bleedPx, bleedPx, outW, outH);

  // 7. Pixel adjustments
  applyPixelAdjustments(ctx, cw, ch, s.brightness, s.contrast, s.saturation);

  // 8. Sharpening
  if (s.sharpen > 0) { onProgress?.("Sharpening…"); applySharpening(ctx, cw, ch, s.sharpen); }

  // 9. Watermark
  if (s.watermarkText) {
    applyWatermark(ctx, cw, ch, s.watermarkText, s.watermarkPosition, s.watermarkOpacity, s.watermarkSize);
  }

  // 10. Encode
  onProgress?.("Encoding…");
  const mimeMap = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  let q = clamp(s.quality, 0, 100) / 100;
  if (s.compression === "smallest") q = Math.min(q, 0.7);
  if (s.compression === "balanced") q = Math.min(q, 0.85);

  let outDataURL = canvas.toDataURL(mimeMap[s.format], s.format === "png" ? undefined : q);
  let blob       = dataURLtoBlob(outDataURL);

  // Honour maxKB
  if (s.maxKB > 0 && s.format !== "png") {
    let qq = q;
    while (blob.size / 1024 > s.maxKB && qq > 0.4) {
      qq -= 0.05;
      outDataURL = canvas.toDataURL(mimeMap[s.format], qq);
      blob       = dataURLtoBlob(outDataURL);
    }
  }

  // 11. DPI injection
  if (s.format === "png")  blob = await injectPNGDPI(blob, s.dpi);
  if (s.format === "jpeg") blob = await injectJPEGDPI(blob, s.dpi);

  const name = workingFile instanceof File
    ? workingFile.name.replace(/\.[^.]+$/, "")
    : (workingFile.name || "image");
  const ext  = s.format === "jpeg" ? "jpg" : s.format;

  return {
    name:         `${name}-optimised.${ext}`,
    blob,
    outputURL:    URL.createObjectURL(blob),
    originalURL:  dataURL,
    originalSize: workingFile instanceof File ? workingFile.size : (workingFile.originalSize || 0),
    outputSize:   blob.size,
    width: cw, height: ch, dpi: s.dpi, format: s.format,
  };
}
