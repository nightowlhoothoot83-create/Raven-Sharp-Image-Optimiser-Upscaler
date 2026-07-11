import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import {
  processImage, DEFAULT_SETTINGS, PRESET_SIZES,
  OUTPUT_PRESETS, readFileAsDataURL, loadImage
} from "../lib/imageProcessing";
import CropTool from "../components/CropTool";
import JSZip from "jszip";
import {
  Upload, Download, Wand2, Crop, Type, Sliders, Zap,
  X, Check, ChevronDown, ChevronUp, RefreshCw, Eye,
  Layers, Settings, AlertCircle, Star, Image, Scissors,
  MoveHorizontal
} from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id:"resize",    icon:<Layers className="w-4 h-4" />,   label:"Resize & DPI" },
  { id:"enhance",   icon:<Sliders className="w-4 h-4" />,  label:"Enhance" },
  { id:"crop",      icon:<Crop className="w-4 h-4" />,     label:"Crop" },
  { id:"watermark", icon:<Type className="w-4 h-4" />,     label:"Watermark" },
  { id:"output",    icon:<Settings className="w-4 h-4" />, label:"Output" },
];

const WATERMARK_POSITIONS = [
  "top-left","top-center","top-right",
  "center",
  "bottom-left","bottom-center","bottom-right",
];

const TIER_LIMITS = {
  free: { images: 5, batch: 1, upscale: true, watermark_forced: true },
  standard: { images: 100, batch: 10, upscale: true, watermark_forced: false },
  pro: { images: 3000, batch: 50, upscale: true, watermark_forced: false },
  owner: { images: 99999, batch: 99999, upscale: true, watermark_forced: false },
};

function fmtSize(bytes) {
  if (bytes >= 1024*1024) return (bytes/1024/1024).toFixed(1)+" MB";
  return (bytes/1024).toFixed(0)+" KB";
}

function Slider({ label, value, min, max, step=1, onChange, unit="" }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-mono text-[var(--text)]">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[var(--raven)]" />
    </div>
  );
}

function BeforeAfterSlider({ beforeSrc, afterSrc }) {
  const containerRef = useRef(null);
  const [pos, setPos] = useState(50); // percent, 0 = all "before", 100 = all "after"
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  const onPointerDown = useCallback((e) => {
    draggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    updateFromClientX(clientX);
  }, [updateFromClientX]);

  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    updateFromClientX(clientX);
  }, [updateFromClientX]);

  const onPointerUp = useCallback(() => { draggingRef.current = false; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
    window.addEventListener("touchcancel", onPointerUp);
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchmove", onPointerMove, { passive: false });
      window.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("touchcancel", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return (
    <div ref={containerRef}
      className="relative w-full h-full select-none"
      style={{ touchAction: "none", cursor: "ew-resize" }}
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
    >
      {/* After image — full, sits underneath */}
      <img src={afterSrc} alt="after" draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none" />

      {/* Before image — clipped to the left portion */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={beforeSrc} alt="before" draggable={false}
          className="absolute inset-0 w-full h-full object-contain" />
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-black/60 text-white/80 pointer-events-none">Before</div>
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-black/60 text-white/80 pointer-events-none">After</div>

      {/* Divider handle */}
      <div className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
        <div className="w-0.5 h-full bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)] mx-auto" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <MoveHorizontal className="w-4 h-4 text-black/70" />
        </div>
      </div>
    </div>
  );
}

export default function Optimiser() {
  const { user } = useAuth();
  const fileRef  = useRef(null);

  const tier = user?.tier || "free";
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  const [images, setImages]         = useState([]); // loaded files
  const [settings, setSettings]     = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab]   = useState("resize");
  const [processing, setProcessing] = useState(false);
  const [results, setResults]       = useState([]);
  const [progress, setProgress]     = useState({ current: 0, total: 0, msg: "" });
  const [previewIdx, setPreviewIdx] = useState(0);
  const [cropActive, setCropActive] = useState(false);
  const [cropImage, setCropImage]   = useState(null); // { dataURL, w, h, idx }
  const [aiUpscaling, setAiUpscaling] = useState(false);

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  // ── File loading ─────────────────────────────────────────────────────────
  const onFiles = useCallback(async (files) => {
    const valid = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .slice(0, limits.batch);
    const loaded = valid.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f, name: f.name, size: f.size,
      preview: URL.createObjectURL(f),
      crop: null,
    }));
    setImages(loaded);
    setResults([]);
  }, [limits.batch]);

  const onDrop = useCallback(e => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const removeImage = id => setImages(prev => prev.filter(i => i.id !== id));

  // ── Crop ──────────────────────────────────────────────────────────────────
  const openCrop = async (idx) => {
    const img = images[idx];
    if (!img) return;
    const dataURL = await readFileAsDataURL(img.file);
    const el      = await loadImage(dataURL);
    setCropImage({ dataURL, w: el.naturalWidth, h: el.naturalHeight, idx });
    setCropActive(true);
    setActiveTab("crop");
  };

  const applyCrop = (rect) => {
    setImages(prev => prev.map((img, i) =>
      i === cropImage.idx ? { ...img, crop: rect } : img
    ));
    // Store crop in settings for single-image use
    set("crop", rect);
    setCropActive(false);
    setCropImage(null);
    toast.success("Crop applied — will be used when processing");
  };

  // ── AI Upscale (backend → Replicate) ─────────────────────────────────────
  const runAiUpscale = async (file) => {
    if (!user) throw new Error("Sign in to use AI upscaling");
    setAiUpscaling(true);
    try {
      const dataURL = await readFileAsDataURL(file);
      const b64     = dataURL.split(",")[1];
      const mime    = file.type || "image/jpeg";
      const { data } = await api.post("/upscale", {
        image_base64: b64, mime, scale: 4
      });
      // Return processed object compatible with processImage
      const img = await loadImage(`data:${data.mime};base64,${data.base64}`);
      return {
        dataURL: `data:${data.mime};base64,${data.base64}`,
        width: img.naturalWidth, height: img.naturalHeight,
        name: file.name.replace(/\.[^.]+$/, ""),
        originalSize: file.size,
      };
    } finally {
      setAiUpscaling(false);
    }
  };

  // ── Process ───────────────────────────────────────────────────────────────
  const run = async () => {
    if (images.length === 0) { toast.error("Drop some images first"); return; }

    // Check tier
    if (tier !== "owner") {
      const used = user?.images_used || 0;
      if (used + images.length > limits.images) {
        toast.error(`Would exceed your monthly limit (${limits.images}). Upgrade or wait for reset.`);
        return;
      }
    }

    setProcessing(true);
    setResults([]);
    const out = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        setProgress({ current: i+1, total: images.length, msg: `Processing ${img.name}…` });

        let source = img.file;
        let mergedSettings = { ...settings };

        // Capture the TRUE original (before upscale/bg-removal/crop) so the
        // before/after slider shows a real comparison. Previously "before"
        // was captured after those steps ran, so upscale/bg-removal changes
        // were invisible in the slider.
        const trueOriginalURL = await readFileAsDataURL(img.file);

        // Apply per-image crop
        if (img.crop) mergedSettings.crop = img.crop;

        // AI upscale (if enabled and user wants it)
        if (settings.upscale && REPLICATE_UPSCALE_ENABLED) {
          setProgress({ current: i+1, total: images.length, msg: `AI upscaling ${img.name}…` });
          try {
            source = await runAiUpscale(img.file);
          } catch (e) {
            if (!user) {
              toast.error(
                "Real AI upscaling needs a free account — sign up to unlock it.",
                {
                  action: {
                    label: "Sign up free",
                    onClick: () => { window.location.href = "/register"; }
                  },
                  duration: 8000,
                }
              );
            } else {
              toast.error(`AI upscale failed for ${img.name}: ${e.message} — using standard resize`);
            }
          }
        }

        const result = await processImage(
          source,
          mergedSettings,
          msg => setProgress(p => ({ ...p, msg }))
        );
        result.originalURL = trueOriginalURL;

        // Free tier: force watermark
        if (limits.watermark_forced && !mergedSettings.watermarkText) {
          // Re-process with watermark
          const watermarkedResult = await processImage(
            source,
            { ...mergedSettings, watermarkText: "ravensharp.app", watermarkPosition: "bottom-right", watermarkOpacity: 0.5, watermarkSize: 18 },
            () => {}
          );
          watermarkedResult.originalURL = trueOriginalURL;
          out.push({ ...watermarkedResult, originalName: img.name, id: img.id });
        } else {
          out.push({ ...result, originalName: img.name, id: img.id });
        }

        // Save job to history
        if (user) {
          api.post("/jobs", {
            name: img.name,
            original_size: img.file.size,
            output_size: result.blob.size,
            width: result.width,
            height: result.height,
            dpi: result.dpi,
            format: result.format,
            settings: mergedSettings,
          }).catch(() => {});
        }

      } catch (err) {
        toast.error(`Failed: ${img.name} — ${err.message}`);
        out.push({ error: err.message, originalName: img.name, id: img.id });
      }
    }

    setResults(out);
    setProcessing(false);
    setProgress({ current: 0, total: 0, msg: "" });
    const ok = out.filter(r => !r.error).length;
    toast.success(`${ok} image${ok !== 1 ? "s" : ""} processed`);
  };

  // We check if user is logged in and has Replicate key enabled
  const REPLICATE_UPSCALE_ENABLED = settings.upscale && !!user;

  const downloadAll = async () => {
    const ok = results.filter(r => !r.error);
    if (ok.length === 1) {
      const a = document.createElement("a");
      a.href = ok[0].outputURL;
      a.download = ok[0].name;
      a.click();
      return;
    }
    const zip = new JSZip();
    ok.forEach(r => zip.file(r.name, r.blob));
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "raven-sharp-optimised.zip";
    a.click();
  };

  const currentResult = results[previewIdx];
  const currentImage  = images[previewIdx];

  // Apply output preset
  const applyPreset = (presetId) => {
    const preset = OUTPUT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setSettings(s => ({ ...s, ...preset.settings, outputPreset: presetId }));
  };

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src="/brands/ravenSharpLogo.png" alt="Raven Sharp"
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(124,92,191,0.4)]" />
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight leading-none">
                  RAVEN <span className="text-[var(--raven-glow)]">SHARP</span>
                </h1>
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--subtle)]">
                  Image Optimiser & Upscaler
                </p>
              </div>
            </div>
          </div>

          {/* Tier badge + usage */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-xs text-[var(--muted)] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-[var(--raven-glow)] font-semibold capitalize">{tier}</span>
                  {tier !== "owner" && tier !== "pro" &&
                    ` · ${user.images_used || 0}/${limits.images} used`}
                </div>
              </>
            ) : (
              <a href="/login" className="text-xs text-[var(--raven-glow)] hover:underline px-3 py-1.5 rounded-lg border border-[var(--raven)]/30 bg-[var(--raven)]/10">
                Sign in for AI upscaling
              </a>
            )}
          </div>
        </div>

        {/* Free tier notice */}
        {tier === "free" && (
          <div className="flex items-center gap-3 text-xs px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Free tier: 5 images/month, 1 at a time, watermark on output.{" "}
            <a href="/pricing" className="underline font-semibold">Upgrade from $10/mo →</a>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

          {/* ── LEFT: Upload + Preview ─────────────────────────────────── */}
          <div className="space-y-4">

            {/* Dropzone */}
            {images.length === 0 && (
              <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[var(--raven)]/30 hover:border-[var(--raven)]/60 rounded-2xl p-16 text-center cursor-pointer transition-all group">
                <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
                  onChange={e => onFiles(e.target.files)} />
                <Upload className="w-12 h-12 text-[var(--raven-glow)] mx-auto mb-4 group-hover:scale-110 transition-transform" />
                <p className="font-display text-2xl font-bold mb-2">Drop images here</p>
                <p className="text-sm text-[var(--muted)]">
                  PNG · JPEG · WebP · Up to {limits.batch} image{limits.batch !== 1 ? "s" : ""}
                </p>
                {!user && (
                  <p className="text-xs text-[var(--subtle)] mt-3">
                    No account needed for basic optimising. <a href="/register" className="text-[var(--raven-glow)] hover:underline">Sign up free</a> for AI upscaling.
                  </p>
                )}
              </div>
            )}

            {/* Image grid */}
            {images.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">{images.length} image{images.length !== 1 ? "s" : ""} loaded</span>
                  <div className="flex gap-2">
                    <button onClick={() => fileRef.current?.click()}
                      className="text-xs text-[var(--raven-glow)] hover:underline">+ Add more</button>
                    <button onClick={() => { setImages([]); setResults([]); }}
                      className="text-xs text-red-400 hover:underline">Clear all</button>
                  </div>
                  <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
                    onChange={e => onFiles(e.target.files)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={img.id}
                      onClick={() => setPreviewIdx(i)}
                      className={`relative cursor-pointer rounded-xl overflow-hidden w-20 h-20 transition-all ${previewIdx === i ? "ring-2 ring-[var(--raven-glow)]" : "opacity-70 hover:opacity-100"}`}>
                      <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                      {img.crop && (
                        <div className="absolute top-1 left-1 w-4 h-4 rounded bg-[var(--raven)] flex items-center justify-center">
                          <Crop className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <button onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Crop tool (inline when active) */}
            {cropActive && cropImage && (
              <div className="glass rounded-2xl p-5 border border-[var(--raven)]/20">
                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                  <Crop className="w-5 h-5 text-[var(--raven-glow)]" /> Crop Image
                </h3>
                <CropTool
                  imageURL={cropImage.dataURL}
                  originalWidth={cropImage.w}
                  originalHeight={cropImage.h}
                  onCrop={applyCrop}
                  onCancel={() => { setCropActive(false); setCropImage(null); }}
                />
              </div>
            )}

            {/* Anonymous signup nudge — shown once after first successful result */}
            {!user && results.length > 0 && results.some(r => !r.error) && (
              <div className="glass rounded-2xl px-4 py-3 mt-3 flex items-center justify-between gap-3 border border-[var(--accent)]/30">
                <p className="text-xs text-[var(--muted)]">
                  Looking good! <span className="text-white">Create a free account</span> to unlock real AI upscaling, save your history, and remove watermarks.
                </p>
                <a href="/register" className="text-xs font-semibold whitespace-nowrap px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black hover:opacity-90">
                  Sign up free
                </a>
              </div>
            )}

            {/* Preview / result */}
            {(images.length > 0 || results.length > 0) && !cropActive && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {currentResult && !currentResult.error ? "Result" : "Preview"}
                    </span>
                    {currentResult && !currentResult.error && (
                      <span className="text-xs text-emerald-400">✓ Processed</span>
                    )}
                  </div>
                  {currentResult && !currentResult.error && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <MoveHorizontal className="w-3.5 h-3.5" />
                      Drag to compare
                    </div>
                  )}
                </div>
                <div className="relative aspect-video bg-black/40 flex items-center justify-center">
                  {currentResult && !currentResult.error ? (
                    <BeforeAfterSlider
                      beforeSrc={currentResult.originalURL || currentImage.preview}
                      afterSrc={currentResult.outputURL}
                    />
                  ) : currentImage ? (
                    <img src={currentImage.preview} alt="preview" className="max-w-full max-h-full object-contain" />
                  ) : null}

                  {/* Stats overlay */}
                  {currentResult && !currentResult.error && (
                    <div className="absolute bottom-3 left-3 flex gap-2">
                      {[
                        { label: "Size", val: fmtSize(currentResult.outputSize) },
                        { label: "Dims", val: `${currentResult.width}×${currentResult.height}` },
                        { label: "DPI",  val: currentResult.dpi },
                        { label: "Format", val: currentResult.format.toUpperCase() },
                      ].map(s => (
                        <span key={s.label} className="text-[10px] font-mono bg-black/70 text-white/80 px-2 py-1 rounded">
                          {s.label}: {s.val}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {currentResult && !currentResult.error && (
                  <div className="p-3 flex items-center gap-3 border-t border-white/8">
                    <div className="flex-1 text-xs text-[var(--muted)]">
                      {fmtSize(currentResult.originalURL ? images[previewIdx]?.size || 0 : 0)} →{" "}
                      <span className="text-emerald-400 font-semibold">{fmtSize(currentResult.outputSize)}</span>
                      {currentResult.outputSize < (images[previewIdx]?.size || 0) && (
                        <span className="ml-1 text-[var(--subtle)]">
                          ({Math.round((1 - currentResult.outputSize/(images[previewIdx]?.size||1))*100)}% smaller)
                        </span>
                      )}
                    </div>
                    <a href={currentResult.outputURL} download={currentResult.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-lg text-xs font-semibold transition-all">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Run + Download */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                <button onClick={run} disabled={processing || aiUpscaling}
                  className="flex items-center gap-2 px-8 h-12 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-xl font-semibold text-sm transition-all glow-pulse disabled:opacity-50 flex-1 justify-center">
                  {processing ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />
                      {progress.msg || `Processing ${progress.current}/${progress.total}…`}</>
                  ) : (
                    <><Wand2 className="w-4 h-4" />
                      Process {images.length > 1 ? `${images.length} Images` : "Image"}</>
                  )}
                </button>

                {results.filter(r => !r.error).length > 0 && (
                  <button onClick={downloadAll}
                    className="flex items-center gap-2 px-5 h-12 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-semibold text-sm transition-all">
                    <Download className="w-4 h-4" />
                    {results.filter(r=>!r.error).length > 1 ? "Download ZIP" : "Download"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Settings panel ─────────────────────────────────── */}
          <div className="space-y-4">

            {/* Output preset quick-apply */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
                <Star className="w-3.5 h-3.5 inline mr-1.5" />Quick Presets
              </h3>
              <div className="flex flex-wrap gap-2">
                {OUTPUT_PRESETS.map(p => (
                  <button key={p.id} onClick={() => applyPreset(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      settings.outputPreset === p.id
                        ? "bg-[var(--raven)]/30 text-[var(--raven-glow)] border border-[var(--raven)]/40"
                        : "bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Remove Background — promoted here so it's always visible, not buried in a tab */}
            <div className={`glass rounded-2xl p-5 border transition-all ${
              settings.removeBg ? "bg-[var(--raven)]/10 border-[var(--raven)]/30" : "border-white/10"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Scissors className="w-4 h-4 text-[var(--raven-glow)] shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">Remove Background</div>
                    <div className="text-xs text-[var(--muted)]">AI-powered via Replicate — uses your monthly image credits.</div>
                  </div>
                </div>
                <button onClick={() => set("removeBg", !settings.removeBg)}
                  className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${settings.removeBg ? "bg-[var(--raven)]" : "bg-white/20"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.removeBg ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            {/* Tab selector */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex border-b border-white/8">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id === "crop" ? "crop" : t.id)}
                    title={t.label}
                    className={`flex-1 flex items-center justify-center py-3 text-xs transition-all ${
                      activeTab === t.id
                        ? "bg-[var(--raven)]/15 text-[var(--raven-glow)] border-b-2 border-[var(--raven-glow)]"
                        : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/3"
                    }`}>
                    {t.icon}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-5">

                {/* Resize & DPI */}
                {activeTab === "resize" && (
                  <>
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">Size Preset</label>
                      <select value={settings.preset}
                        onChange={e => {
                          const idx = parseInt(e.target.value);
                          const p = PRESET_SIZES[idx];
                          setSettings(s => ({ ...s, preset: idx, width: p.w, height: p.h }));
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--raven)]/50 text-[var(--text)]">
                        {PRESET_SIZES.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-1.5">Width (px)</label>
                        <input type="number" value={settings.width || ""}
                          onChange={e => set("width", parseInt(e.target.value)||0)}
                          placeholder="Auto"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--raven)]/50 text-[var(--text)]" />
                      </div>
                      <div>
                        <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-1.5">Height (px)</label>
                        <input type="number" value={settings.height || ""}
                          onChange={e => set("height", parseInt(e.target.value)||0)}
                          placeholder="Auto"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--raven)]/50 text-[var(--text)]" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { key:"lockAspect", label:"Lock Aspect" },
                        { key:"upscale",    label:"Allow Upscale" },
                        { key:"bleed",      label:"3mm Bleed" },
                      ].map(opt => (
                        <button key={opt.key} onClick={() => set(opt.key, !settings[opt.key])}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            settings[opt.key]
                              ? "bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30"
                              : "bg-white/5 text-[var(--muted)] border border-white/10"
                          }`}>
                          <div className={`w-3 h-3 rounded-sm border ${settings[opt.key] ? "bg-[var(--raven-glow)] border-[var(--raven-glow)]" : "border-[var(--subtle)]"}`}>
                            {settings[opt.key] && <Check className="w-3 h-3 text-white" />}
                          </div>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">DPI</label>
                      <div className="flex gap-2">
                        {[72, 96, 150, 300, 600].map(d => (
                          <button key={d} onClick={() => set("dpi", d)}
                            className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                              settings.dpi === d
                                ? "bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30"
                                : "bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10"
                            }`}>{d}</button>
                        ))}
                      </div>
                    </div>

                    {/* AI Upscale toggle */}
                    {user ? (
                      <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        settings.upscale
                          ? "bg-[var(--raven)]/10 border-[var(--raven)]/30"
                          : "bg-white/5 border-white/10"
                      }`}>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Zap className="w-4 h-4 text-[var(--raven-glow)]" />
                            AI Upscale (Real-ESRGAN)
                          </div>
                          <p className="text-xs text-[var(--muted)] mt-0.5">True pixel reconstruction via real AI upscaling — sharper detail, no blur.</p>
                        </div>
                        <button onClick={() => set("upscale", !settings.upscale)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${settings.upscale ? "bg-[var(--raven)]" : "bg-white/20"}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.upscale ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-[var(--muted)]">
                        <a href="/login" className="text-[var(--raven-glow)] hover:underline font-semibold">Sign in</a>
                        {" "}to enable Real-ESRGAN AI upscaling (replaces canvas resize with genuine pixel reconstruction).
                      </div>
                    )}
                  </>
                )}

                {/* Enhance */}
                {activeTab === "enhance" && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">Auto Enhance</span>
                      <button onClick={() => set("auto", !settings.auto)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${settings.auto ? "bg-[var(--raven)]" : "bg-white/20"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.auto ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    <Slider label="Sharpen" value={settings.sharpen} min={0} max={10} onChange={v => set("sharpen", v)} />
                    <Slider label="Brightness" value={settings.brightness} min={-80} max={80} onChange={v => set("brightness", v)} />
                    <Slider label="Contrast" value={settings.contrast} min={-80} max={80} onChange={v => set("contrast", v)} />
                    <Slider label="Saturation" value={settings.saturation} min={-80} max={80} onChange={v => set("saturation", v)} />
                  </>
                )}

                {/* Crop tab */}
                {activeTab === "crop" && !cropActive && (
                  <div className="text-center py-6">
                    <Crop className="w-10 h-10 text-[var(--raven)]/40 mx-auto mb-3" />
                    <p className="text-sm text-[var(--muted)] mb-4">
                      Select an image then open the crop tool.
                    </p>
                    {images.length > 0 ? (
                      <button onClick={() => openCrop(previewIdx)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-xl text-sm font-semibold transition-all mx-auto">
                        <Crop className="w-4 h-4" /> Open Crop Tool
                      </button>
                    ) : (
                      <p className="text-xs text-[var(--subtle)]">Drop an image first</p>
                    )}
                    {images.filter(i => i.crop).length > 0 && (
                      <div className="mt-4 text-xs text-emerald-400">
                        ✓ Crop applied to {images.filter(i=>i.crop).length} image{images.filter(i=>i.crop).length!==1?"s":""}
                      </div>
                    )}
                  </div>
                )}

                {/* Watermark */}
                {activeTab === "watermark" && (
                  <>
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">Watermark Text</label>
                      <input value={settings.watermarkText}
                        onChange={e => set("watermarkText", e.target.value)}
                        placeholder="© Your Name 2026"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--raven)]/50 text-[var(--text)]" />
                    </div>
                    {settings.watermarkText && (
                      <>
                        <div>
                          <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">Position</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {WATERMARK_POSITIONS.map(pos => (
                              <button key={pos} onClick={() => set("watermarkPosition", pos)}
                                className={`py-2 rounded-lg text-[10px] font-medium capitalize transition-all ${
                                  settings.watermarkPosition === pos
                                    ? "bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30"
                                    : "bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10"
                                }`}>
                                {pos.replace("-", " ")}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Slider label="Opacity" value={Math.round(settings.watermarkOpacity*100)} min={10} max={100}
                          onChange={v => set("watermarkOpacity", v/100)} unit="%" />
                        <Slider label="Size" value={settings.watermarkSize} min={10} max={80}
                          onChange={v => set("watermarkSize", v)} unit="px" />
                      </>
                    )}
                    {tier === "free" && (
                      <div className="text-xs text-amber-400 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        Free tier adds "ravensharp.app" watermark automatically.{" "}
                        <a href="/pricing" className="underline">Upgrade</a> to remove it.
                      </div>
                    )}
                  </>
                )}

                {/* Output */}
                {activeTab === "output" && (
                  <>
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">Format</label>
                      <div className="flex gap-2">
                        {["jpeg","png","webp"].map(f => (
                          <button key={f} onClick={() => set("format", f)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-all ${
                              settings.format === f
                                ? "bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30"
                                : "bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10"
                            }`}>{f}</button>
                        ))}
                      </div>
                    </div>
                    {settings.format !== "png" && (
                      <Slider label="Quality" value={settings.quality} min={40} max={100}
                        onChange={v => set("quality", v)} unit="%" />
                    )}
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">Compression</label>
                      <div className="flex gap-2">
                        {["quality","balanced","smallest"].map(c => (
                          <button key={c} onClick={() => set("compression", c)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                              settings.compression === c
                                ? "bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30"
                                : "bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10"
                            }`}>{c}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-1.5">Max File Size (KB, 0 = no limit)</label>
                      <input type="number" value={settings.maxKB || ""}
                        onChange={e => set("maxKB", parseInt(e.target.value)||0)}
                        placeholder="0"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--raven)]/50 text-[var(--text)]" />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/8">
                      <div>
                        <div className="text-sm font-semibold">Strip EXIF Metadata</div>
                        <div className="text-xs text-[var(--muted)]">Remove GPS, camera info before publishing.</div>
                      </div>
                      <button onClick={() => set("stripExif", !settings.stripExif)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${settings.stripExif ? "bg-[var(--raven)]" : "bg-white/20"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.stripExif ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Reset settings */}
            <button onClick={() => setSettings(DEFAULT_SETTINGS)}
              className="w-full py-2.5 text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors">
              Reset all settings to defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
