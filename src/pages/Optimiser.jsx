import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import {
  DEFAULT_SETTINGS, PRESET_SIZES,
  readFileAsDataURL, loadImage
} from "../lib/imageProcessing";
import CropTool from "../components/CropTool";
import HowToGuide from "../components/HowToGuide";
import {
  Upload, Download, Wand2, Crop, Type, Sliders, Zap,
  X, Check, RefreshCw,
  Layers, Settings, AlertCircle, Scissors,
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
  free: { images: 5, batch: 3, upscale: true, watermark_forced: true },
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
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "single"
  const [gridPage, setGridPage] = useState(0);
  const [gridPreviewURLs, setGridPreviewURLs] = useState({}); // { [resultId]: blobURL }
  const GRID_PAGE_SIZE = 10;
  const [cropActive, setCropActive] = useState(false);
  const [cropImage, setCropImage]   = useState(null); // { dataURL, w, h, idx }
  const [batchId, setBatchId]         = useState(null);
  const [resultPreviewURL, setResultPreviewURL] = useState(null);
  const pollTimerRef = useRef(null);

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  // ── Resume an in-progress batch after leaving/reloading the page ──────────
  // The whole point of server-side batches is that they keep running even if
  // you close the tab — this picks the job back up on return instead of
  // losing track of it.
  useEffect(() => {
    const saved = localStorage.getItem("ravensharp_active_batch");
    if (saved) {
      setBatchId(saved);
      setProcessing(true);
      pollBatch(saved);
      toast.info("Resuming your batch that's still processing in the background…");
    }
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollBatch = async (id) => {
    try {
      const { data } = await api.get(`/batches/${id}`);
      setResults(data.results || []);
      if (data.status === "completed") {
        localStorage.removeItem("ravensharp_active_batch");
        localStorage.setItem("ravensharp_last_completed_batch", id);
        setProcessing(false);
        setBatchId(null);
        setProgress({ current: 0, total: 0, msg: "" });
        const resultsArr = data.results || [];
        const ok = resultsArr.filter(r => !r.error && r.status !== "failed").length;
        const failed = resultsArr.filter(r => r.error || r.status === "failed");
        if (failed.length > 0) {
          // Surface the actual reason instead of a silent "0 processed" —
          // this is what was missing before: the backend always captured
          // the real error per-image, it just never reached the UI.
          const firstError = failed[0].error || "Unknown error";
          toast.error(
            ok > 0
              ? `${ok} image${ok !== 1 ? "s" : ""} processed, ${failed.length} failed: ${firstError}`
              : `All ${failed.length} image${failed.length !== 1 ? "s" : ""} failed: ${firstError}`,
            { duration: 10000 }
          );
        } else {
          toast.success(`${ok} image${ok !== 1 ? "s" : ""} processed`);
        }
        return;
      }
      setProgress({
        current: data.processed_count || 0,
        total: data.total_count || images.length,
        msg: data.current_step || "Processing…",
      });
      pollTimerRef.current = setTimeout(() => pollBatch(id), 3000);
    } catch (err) {
      console.error("Batch poll failed:", err);
      // Keep trying — a transient network blip shouldn't abandon tracking a
      // batch that's still genuinely running server-side.
      pollTimerRef.current = setTimeout(() => pollBatch(id), 5000);
    }
  };

  // Fetch the actual image bytes for whichever result is currently being
  // previewed, on demand — keeps polling responses lightweight rather than
  // carrying every image's full data on every poll.
  useEffect(() => {
    const r = results[previewIdx];
    const activeBatchId = batchId || localStorage.getItem("ravensharp_last_completed_batch");
    if (!r || r.status !== "done" || !activeBatchId) { setResultPreviewURL(null); return; }
    let cancelled = false;
    let objUrl = null;
    (async () => {
      try {
        const res = await api.get(`/batches/${activeBatchId}/image/${r.id}`, { responseType: "blob" });
        if (cancelled) return;
        objUrl = URL.createObjectURL(res.data);
        setResultPreviewURL(objUrl);
      } catch {
        if (!cancelled) setResultPreviewURL(null);
      }
    })();
    return () => { cancelled = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [results, previewIdx, batchId]);

  // ── Grid view: fetch preview blobs for up to 10 results at a time ─────────
  useEffect(() => {
    if (viewMode !== "grid") return;
    const activeBatchId = batchId || localStorage.getItem("ravensharp_last_completed_batch");
    if (!activeBatchId) return;
    const pageResults = results
      .slice(gridPage * GRID_PAGE_SIZE, gridPage * GRID_PAGE_SIZE + GRID_PAGE_SIZE)
      .filter(r => r.status === "done" && !gridPreviewURLs[r.id]);
    if (pageResults.length === 0) return;

    let cancelled = false;
    const urls = [];
    (async () => {
      const entries = await Promise.all(pageResults.map(async (r) => {
        try {
          const res = await api.get(`/batches/${activeBatchId}/image/${r.id}`, { responseType: "blob" });
          const url = URL.createObjectURL(res.data);
          urls.push(url);
          return [r.id, url];
        } catch {
          return [r.id, null];
        }
      }));
      if (cancelled) { urls.forEach(u => URL.revokeObjectURL(u)); return; }
      setGridPreviewURLs(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, results, gridPage, batchId]);

  // Reset grid pagination and cached blobs whenever a new batch's results come in
  useEffect(() => {
    setGridPage(0);
    Object.values(gridPreviewURLs).forEach(u => u && URL.revokeObjectURL(u));
    setGridPreviewURLs({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // ── File loading ─────────────────────────────────────────────────────────
  const onFiles = useCallback(async (files) => {
    const incoming = Array.from(files).filter(f => f.type.startsWith("image/"));
    const loaded = incoming.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f, name: f.name, size: f.size,
      preview: URL.createObjectURL(f),
      crop: null,
    }));
    // "Add more" and the very first upload both hit this handler — append
    // to whatever's already loaded (previously this always replaced the
    // whole array, silently discarding earlier images) and cap the
    // combined total at the tier's batch limit, keeping whichever images
    // were there first.
    setImages(prev => [...prev, ...loaded].slice(0, limits.batch));
    setResults([]);
  }, [limits.batch]);

  const onDrop = useCallback(e => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const removeImage = id => setImages(prev => prev.filter(i => i.id !== id));
  const toggleRemoveBg = (id) => setImages(prev => prev.map(i => i.id === id ? { ...i, removeBg: !i.removeBg } : i));

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

  const applyCrop = async (rect) => {
    try {
      const el = await loadImage(cropImage.dataURL);
      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(el, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
      const croppedPreview = canvas.toDataURL("image/jpeg", 0.85);

      setImages(prev => prev.map((im, i) =>
        i === cropImage.idx ? { ...im, crop: rect, preview: croppedPreview } : im
      ));
      set("crop", rect);
      setCropActive(false);
      setCropImage(null);
      toast.success("Crop applied — you can see the update in the thumbnail");
    } catch (err) {
      const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
      console.error(`[${errorId}] Crop preview generation failed:`, err);
      toast.error(`Couldn't generate crop preview (error ${errorId}). Your crop selection was still saved and will apply when you process. If this keeps happening, report error ${errorId}.`);
      // Still save the crop rect even if the preview render failed
      setImages(prev => prev.map((im, i) =>
        i === cropImage.idx ? { ...im, crop: rect } : im
      ));
      set("crop", rect);
      setCropActive(false);
      setCropImage(null);
    }
  };

  // ── Process ───────────────────────────────────────────────────────────────
  // Submits the whole batch to the server and returns immediately — actual
  // processing (crop, resize, enhance, AI upscale, background removal)
  // happens server-side via a background task, so it keeps running even if
  // you close this tab or your phone locks. Progress is picked up again by
  // polling (or by the resume-on-mount effect if you come back later).
  const run = async () => {
    if (images.length === 0) { toast.error("Drop some images first"); return; }

    if (!user) {
      toast.error(
        "Sign up for a free account to run batches — they process on our servers so you can leave the page.",
        { action: { label: "Sign up free", onClick: () => { window.location.href = "/register"; } }, duration: 8000 }
      );
      return;
    }

    if (tier !== "owner") {
      const used = user?.images_used || 0;
      if (used + images.length > limits.images) {
        toast.error(`Would exceed your monthly limit (${limits.images}). Upgrade or wait for reset.`);
        return;
      }
    }

    setProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: images.length, msg: "Uploading…" });

    try {
      const imagesPayload = await Promise.all(images.map(async (img) => {
        const dataURL = await readFileAsDataURL(img.file);
        const base64 = dataURL.split(",")[1];
        return {
          name: img.name,
          image_base64: base64,
          mime: img.file.type || "image/jpeg",
          crop: img.crop || null,
          removeBg: !!img.removeBg,
          upscale: !!settings.upscale,
        };
      }));

      const jobSettings = { ...settings };
      // Free tier: force watermark server-side, same as before
      if (limits.watermark_forced && !jobSettings.watermarkText) {
        jobSettings.watermarkText = "ravensharp.app";
        jobSettings.watermarkPosition = "bottom-right";
        jobSettings.watermarkOpacity = 0.5;
        jobSettings.watermarkSize = 18;
      }

      const { data } = await api.post("/batches", { images: imagesPayload, settings: jobSettings });
      localStorage.setItem("ravensharp_active_batch", data.id);
      setBatchId(data.id);
      toast.success("Batch started — it'll keep processing even if you leave this page.");
      pollBatch(data.id);
    } catch (err) {
      const msg = err.userMessage || err.message;
      const idSuffix = err.errorId ? ` (error ${err.errorId})` : "";
      toast.error(`Couldn't start the batch: ${msg}${idSuffix}`);
      setProcessing(false);
    }
  };

  const downloadAll = async () => {
    const activeBatchId = batchId || localStorage.getItem("ravensharp_last_completed_batch");
    if (!activeBatchId) return;
    const ok = results.filter(r => r.status === "done");
    if (ok.length === 1) {
      window.location.href = `${api.defaults.baseURL}/batches/${activeBatchId}/image/${ok[0].id}`;
      return;
    }
    try {
      const res = await api.get(`/batches/${activeBatchId}/download-all`, { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(res.data);
      a.download = "raven-sharp-optimised.zip";
      a.click();
    } catch (err) {
      toast.error(err.userMessage || "Couldn't download the batch — please try again");
    }
  };

  const currentResult = results[previewIdx];
  const currentImage  = images[previewIdx];

  // Apply output preset
  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <HowToGuide />

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
                      {/* Crop badge — tap to undo the crop */}
                      {img.crop && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setImages(prev => prev.map((im, idx) =>
                              idx === i
                                ? { ...im, crop: undefined, preview: URL.createObjectURL(im.file) }
                                : im
                            ));
                            toast.success(`Crop removed from ${img.name}`);
                          }}
                          title="Tap to undo crop"
                          className="absolute top-1 left-1 w-4 h-4 rounded bg-[var(--raven)] hover:bg-red-500 flex items-center justify-center transition-colors">
                          <Crop className="w-2.5 h-2.5 text-white" />
                        </button>
                      )}
                      {/* Remove BG badge — tap to undo */}
                      {img.removeBg && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setImages(prev => prev.map((im, idx) =>
                              idx === i ? { ...im, removeBg: false } : im
                            ));
                            toast.success(`Background removal cancelled for ${img.name}`);
                          }}
                          title="Tap to undo"
                          className="absolute bottom-1 left-1 rounded bg-purple-500/80 hover:bg-red-500 px-1 py-0.5 flex items-center justify-center transition-colors">
                          <span className="text-white text-[8px] font-bold leading-none">BG</span>
                        </button>
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

          </div>

          {/* ── RIGHT: Settings panel ─────────────────────────────────── */}
          <div className="space-y-4">

            {/* Remove Background — per-image selection */}
            <div className="glass rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-2.5 mb-4">
                <Scissors className="w-4 h-4 text-[var(--raven-glow)] shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Remove Background</div>
                  <div className="text-xs text-[var(--muted)]">
                    AI-powered via Replicate · Select which images to process
                  </div>
                </div>
              </div>

              {images.length === 0 ? (
                <p className="text-xs text-[var(--subtle)]">Drop images first to select which ones to remove background from</p>
              ) : (
                <>
                  {/* Quick select all / none */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setImages(prev => prev.map(i => ({ ...i, removeBg: true })))}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30 hover:bg-[var(--raven)]/30 transition-all"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setImages(prev => prev.map(i => ({ ...i, removeBg: false })))}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10 transition-all"
                    >
                      Clear All
                    </button>
                    {images.some(i => i.removeBg) && (
                      <span className="text-xs text-purple-400 self-center ml-1">
                        {images.filter(i => i.removeBg).length} selected
                      </span>
                    )}
                  </div>

                  {/* Per-image toggles */}
                  <div className="space-y-2">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        onClick={() => toggleRemoveBg(img.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-all ${
                          img.removeBg
                            ? "bg-purple-500/10 border-purple-500/30"
                            : "bg-white/3 border-white/8 hover:bg-white/6"
                        }`}
                      >
                        <img
                          src={img.preview}
                          alt={img.name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate text-[var(--text)]">{img.name}</div>
                          <div className="text-[10px] text-[var(--muted)] mt-0.5">
                            {img.removeBg ? "✓ Background will be removed" : "Background kept"}
                          </div>
                        </div>
                        <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${img.removeBg ? "bg-purple-500" : "bg-white/20"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${img.removeBg ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
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

                {/* Crop tab, active — the actual crop tool now appears right
                    here where you opened it, instead of somewhere else on
                    the page entirely. */}
                {activeTab === "crop" && cropActive && cropImage && (
                  <div>
                    <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
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

            {/* Run + Download — moved below crop/background-removal/all other
                settings so on mobile (where columns stack) you set everything
                up first, then process, instead of Process appearing above
                options you haven't seen yet. */}
            {images.length > 0 && (
              <div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={run} disabled={processing}
                    className="flex items-center gap-2 px-8 h-12 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-xl font-semibold text-sm transition-all glow-pulse disabled:opacity-50 flex-1 justify-center">
                    {processing ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" />
                        {progress.msg || `Processing ${progress.current}/${progress.total}…`}</>
                    ) : (
                      <><Wand2 className="w-4 h-4" />
                        Process {images.length > 1 ? `${images.length} Images` : "Image"}</>
                    )}
                  </button>

                  {results.filter(r => r.status === "done").length > 0 && (
                    <button onClick={downloadAll}
                      className="flex items-center gap-2 px-5 h-12 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-semibold text-sm transition-all">
                      <Download className="w-4 h-4" />
                      {results.filter(r=>r.status==="done").length > 1 ? "Download ZIP" : "Download"}
                    </button>
                  )}
                </div>
                {processing && (
                  <p className="text-xs text-[var(--muted)] mt-2 text-center">
                    Running on our servers — safe to leave this page, close the tab, or lock your phone. Come back anytime to check progress.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview (pre-processing) — lives below Process, same as the
            completed result below, so the flow is always: settings first,
            Process button, then whatever's relevant to look at last. */}
        {images.length > 0 && !cropActive && !(currentResult && currentResult.status === "done") && currentImage && (
          <div className="glass rounded-2xl overflow-hidden mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <span className="text-sm font-semibold">Preview</span>
            </div>
            <div className="relative aspect-video bg-black/40 flex items-center justify-center">
              <img src={currentImage.preview} alt="preview" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        )}

        {/* ── Completed result — appears below everything else once
              processing finishes, instead of sitting above the settings
              you haven't configured yet. ─────────────────────────────── */}
        {results.some(r => r.status === "done") && (
          <div className="flex items-center justify-between mt-6 mb-2">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
              <button onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "grid" ? "bg-[var(--raven)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                Grid
              </button>
              <button onClick={() => setViewMode("single")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "single" ? "bg-[var(--raven)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                Single
              </button>
            </div>
            {viewMode === "grid" && results.filter(r => r.status === "done").length > GRID_PAGE_SIZE && (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <button onClick={() => setGridPage(p => Math.max(0, p - 1))} disabled={gridPage === 0}
                  className="px-2 py-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10">‹ Prev</button>
                <span>
                  {gridPage * GRID_PAGE_SIZE + 1}–{Math.min((gridPage + 1) * GRID_PAGE_SIZE, results.length)} of {results.length}
                </span>
                <button onClick={() => setGridPage(p => (p + 1) * GRID_PAGE_SIZE < results.length ? p + 1 : p)}
                  disabled={(gridPage + 1) * GRID_PAGE_SIZE >= results.length}
                  className="px-2 py-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10">Next ›</button>
              </div>
            )}
          </div>
        )}

        {viewMode === "grid" && results.some(r => r.status === "done") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results
              .slice(gridPage * GRID_PAGE_SIZE, gridPage * GRID_PAGE_SIZE + GRID_PAGE_SIZE)
              .map((r, i) => {
                const globalIdx = gridPage * GRID_PAGE_SIZE + i;
                const origImage = images[globalIdx];
                if (r.status !== "done") return null;
                return (
                  <div key={r.id || globalIdx} className="glass rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
                      <span className="text-xs font-semibold truncate">{r.name || origImage?.name}</span>
                      <span className="text-[10px] text-emerald-400 shrink-0 ml-2">✓</span>
                    </div>
                    <div className="relative aspect-square bg-black/40 flex items-center justify-center">
                      {gridPreviewURLs[r.id] ? (
                        <BeforeAfterSlider beforeSrc={origImage?.preview} afterSrc={gridPreviewURLs[r.id]} />
                      ) : (
                        <RefreshCw className="w-5 h-5 animate-spin text-[var(--muted)]" />
                      )}
                    </div>
                    {r.warning && (
                      <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/30 text-[10px] text-amber-400">
                        ⚠️ {r.warning}
                      </div>
                    )}
                    <div className="p-2.5 flex items-center gap-2 border-t border-white/8">
                      {r.output_size < (origImage?.size || 0) && (
                        <div className="flex-1 text-[10px] text-[var(--muted)]">
                          {fmtSize(origImage?.size || 0)} →{" "}
                          <span className="text-emerald-400 font-semibold">{fmtSize(r.output_size)}</span>
                        </div>
                      )}
                      {gridPreviewURLs[r.id] && (
                        <a href={gridPreviewURLs[r.id]} download={r.name}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-md text-[10px] font-semibold transition-all">
                          <Download className="w-3 h-3" /> Save
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {viewMode === "single" && currentResult && currentResult.status === "done" && (
          <div className="glass rounded-2xl overflow-hidden mt-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Result</span>
                <span className="text-xs text-emerald-400">✓ Processed</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <MoveHorizontal className="w-3.5 h-3.5" />
                Drag to compare
              </div>
            </div>
            <div className="relative aspect-video bg-black/40 flex items-center justify-center">
              {resultPreviewURL ? (
                <BeforeAfterSlider
                  beforeSrc={currentImage?.preview}
                  afterSrc={resultPreviewURL}
                />
              ) : (
                <RefreshCw className="w-6 h-6 animate-spin text-[var(--muted)]" />
              )}

              {/* Stats overlay */}
              <div className="absolute bottom-3 left-3 flex gap-2">
                {[
                  { label: "Size", val: fmtSize(currentResult.output_size) },
                  { label: "Dims", val: `${currentResult.width}×${currentResult.height}` },
                  { label: "DPI",  val: settings.dpi },
                  { label: "Format", val: (settings.format || "jpeg").toUpperCase() },
                ].map(s => (
                  <span key={s.label} className="text-[10px] font-mono bg-black/70 text-white/80 px-2 py-1 rounded">
                    {s.label}: {s.val}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 flex items-center gap-3 border-t border-white/8">
              {currentResult.output_size < (images[previewIdx]?.size || 0) && (
                <div className="flex-1 text-xs text-[var(--muted)]">
                  {fmtSize(images[previewIdx]?.size || 0)} →{" "}
                  <span className="text-emerald-400 font-semibold">{fmtSize(currentResult.output_size)}</span>
                  <span className="ml-1 text-[var(--subtle)]">
                    ({Math.round((1 - currentResult.output_size/(images[previewIdx]?.size||1))*100)}% smaller)
                  </span>
                </div>
              )}
              <a href={resultPreviewURL} download={currentResult.name}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-lg text-xs font-semibold transition-all">
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          </div>
        )}

        {results.some(r => r.status === "done") && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => {
                setImages([]);
                setResults([]);
                setProgress({ current: 0, total: 0, msg: "" });
                setPreviewIdx(0);
                setGridPage(0);
                setBatchId(null);
                setResultPreviewURL(null);
                localStorage.removeItem("ravensharp_active_batch");
                localStorage.removeItem("ravensharp_last_completed_batch");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-all"
            >
              ↺ Start New
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
