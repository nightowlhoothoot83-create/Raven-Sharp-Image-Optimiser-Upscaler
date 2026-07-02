import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopNav from "../components/TopNav";
import Footer from "../components/Footer";
import { api } from "../lib/api";
import { processImage, DEFAULT_SETTINGS, PRESET_SIZES } from "../lib/imageProcessing";
import { Upload, X, Download, Wand2, Sparkles, Image as ImageIcon, ChevronRight, Maximize2, Layers, Eraser } from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";

const LOGO_URL =
  "/raven-logo.png";

function fmtKB(bytes) {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / 1024).toFixed(0) + " KB";
}

// ---------- Atoms ----------
function PillGroup({ value, onChange, options, testid }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid={testid}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`pill ${active ? "pill-active" : "border-raven-border hover:border-white/20"}`}
            data-testid={`${testid}-${opt.value}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "", testid }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="label-tiny">{label}</span>
        <span className="text-xs font-medium text-raven-violetBright tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range"
        className="rs"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--p": `${pct}%` }}
        data-testid={testid}
      />
    </div>
  );
}

function Toggle({ checked, onChange, label, testid }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-raven-violet" : "bg-white/10"}`}
        data-testid={testid}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}

function Card({ title, icon: Icon, children, testid }) {
  return (
    <section className="surface p-5" data-testid={testid}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={14} className="text-raven-violetBright" />}
        <h3 className="font-display tracking-[0.18em] text-sm uppercase text-raven-text/90">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// ---------- Page ----------
export default function Optimiser() {
  const [files, setFiles] = useState([]); // { id, file, status, error? }
  const [results, setResults] = useState([]); // result objects
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, text: "" });
  const [previewIdx, setPreviewIdx] = useState(0);
  const inputRef = useRef(null);

  const setS = (patch) => setSettings((s) => ({ ...s, ...patch }));

  // ------ File handling ------
  const onFiles = useCallback((list) => {
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...arr.map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, status: "ready" })),
    ]);
    setResults([]);
  }, []);

  const removeFile = (id) => setFiles((arr) => arr.filter((f) => f.id !== id));

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  // ------ Preset apply ------
  useEffect(() => {
    const p = PRESET_SIZES[settings.preset];
    if (p && p.w && p.h) setS({ width: p.w, height: p.h });
  }, [settings.preset]);

  // ------ Process ------
  const process = async () => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setResults([]);
    setProgress({ done: 0, total: files.length, text: "Starting…" });

    const out = [];
    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      setFiles((arr) => arr.map((f) => (f.id === item.id ? { ...f, status: "processing" } : f)));
      setProgress({ done: i, total: files.length, text: `Processing ${item.file.name}` });
      try {
        const result = await processImage(item.file, settings, (text) =>
          setProgress((p) => ({ ...p, text: `${item.file.name}: ${text}` })),
        );
        out.push({ ...result, id: item.id });
        setFiles((arr) => arr.map((f) => (f.id === item.id ? { ...f, status: "done" } : f)));

        // Save job to backend (one-shot download — we only persist metadata)
        api.post("/jobs", {
          name: result.name,
          original_size: result.originalSize,
          output_size: result.outputSize,
          width: result.width,
          height: result.height,
          dpi: result.dpi,
          format: result.format,
          settings: {
            quality: settings.quality, sharpen: settings.sharpen, brightness: settings.brightness,
            contrast: settings.contrast, saturation: settings.saturation, compression: settings.compression,
            auto: settings.auto, removeBg: settings.removeBg, bleed: settings.bleed,
          },
        }).catch(() => {});
      } catch (e) {
        console.error(e);
        setFiles((arr) => arr.map((f) => (f.id === item.id ? { ...f, status: "error", error: String(e.message || e) } : f)));
        toast.error(`Failed: ${item.file.name}`);
      }
    }
    setProgress({ done: files.length, total: files.length, text: "Done" });
    setResults(out);
    setBusy(false);
    if (out.length > 0) toast.success(`Optimised ${out.length} image${out.length > 1 ? "s" : ""}`);
  };

  // ------ Downloads ------
  const downloadOne = (r) => saveAs(r.blob, r.name);
  const downloadAll = async () => {
    if (results.length === 0) return;
    if (results.length === 1) return downloadOne(results[0]);
    const zip = new JSZip();
    results.forEach((r) => zip.file(r.name, r.blob));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `raven-sharp-${Date.now()}.zip`);
  };

  const preview = results[previewIdx];
  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ---------- Render ----------
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8" data-testid="optimiser-page">

        {/* Hero strip */}
        <div className="relative overflow-hidden">
          <img
            src={LOGO_URL}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute -right-10 -top-16 h-72 w-auto opacity-[0.18] hidden md:block rounded-2xl"
          />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-up">
            <div>
              <div className="label-tiny mb-2">Workspace</div>
              <h1 className="font-display text-5xl sm:text-6xl tracking-tight uppercase leading-none">
                The Optimiser
              </h1>
              <p className="text-raven-muted mt-3 text-sm max-w-xl">
                100% local processing. Drop your images, dial in your settings, ship at the right DPI.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-raven-violet/10 border border-raven-violet/30 text-raven-violetBright">
                No upload · Private
              </span>
            </div>
          </div>
        </div>

        {/* Dropzone */}
        <div
          className="surface relative p-10 cursor-pointer hover:border-raven-violet/50 transition-colors"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          data-testid="upload-dropzone"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            data-testid="file-input"
          />
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-raven-violet/15 border border-raven-violet/40 flex items-center justify-center">
              <Upload size={22} className="text-raven-violetBright" />
            </div>
            <div>
              <div className="font-display text-2xl tracking-tight uppercase">Drop images here</div>
              <div className="text-raven-muted text-sm mt-1">JPG · PNG · WEBP · GIF · BMP — or click to browse</div>
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="surface p-4" data-testid="file-list">
            <div className="flex items-center justify-between mb-3">
              <div className="label-tiny">{files.length} file{files.length > 1 ? "s" : ""} queued</div>
              <button onClick={() => { setFiles([]); setResults([]); }} className="text-xs text-raven-muted hover:text-red-400" data-testid="clear-files">
                Clear all
              </button>
            </div>
            <div className="grid gap-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-black/30 border border-raven-border" data-testid={`file-row-${f.id}`}>
                  <div className="h-9 w-9 rounded bg-raven-violet/10 border border-raven-violet/20 flex items-center justify-center"><ImageIcon size={14} className="text-raven-violetBright" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.file.name}</div>
                    <div className="label-tiny">{fmtKB(f.file.size)}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    f.status === "done" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                    : f.status === "processing" ? "border-amber-500/30 text-amber-400 bg-amber-500/5"
                    : f.status === "error" ? "border-red-500/30 text-red-400 bg-red-500/5"
                    : "border-raven-border text-raven-muted"
                  }`}>{f.status}</span>
                  <button onClick={() => removeFile(f.id)} className="text-raven-muted hover:text-red-400" data-testid={`remove-file-${f.id}`}><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-mode banner */}
        <div className="surface p-5 flex items-center gap-4 bg-gradient-to-r from-raven-violet/15 via-transparent to-transparent border-raven-violet/25" data-testid="auto-banner">
          <div className="h-10 w-10 rounded-lg bg-raven-violet/20 border border-raven-violet/40 flex items-center justify-center">
            <Wand2 size={18} className="text-raven-violetBright" />
          </div>
          <div className="flex-1">
            <div className="font-display tracking-[0.16em] uppercase text-sm">Auto-Optimise</div>
            <div className="text-raven-muted text-xs">Smart sharpening, color, exposure & 300DPI export.</div>
          </div>
          <Toggle checked={settings.auto} onChange={(v) => setS({ auto: v })} label="" testid="auto-toggle" />
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Card title="Output" icon={Layers} testid="card-output">
            <div>
              <div className="label-tiny mb-2">Format</div>
              <PillGroup
                testid="format-pills"
                value={settings.format}
                onChange={(v) => setS({ format: v })}
                options={[
                  { value: "jpeg", label: "JPEG" },
                  { value: "png", label: "PNG" },
                  { value: "webp", label: "WebP" },
                ]}
              />
            </div>
            <div>
              <div className="label-tiny mb-2">DPI</div>
              <PillGroup
                testid="dpi-pills"
                value={settings.dpi}
                onChange={(v) => setS({ dpi: v })}
                options={[72, 150, 300, 600].map((n) => ({ value: n, label: String(n) }))}
              />
            </div>
            <div>
              <div className="label-tiny mb-2">Compression</div>
              <PillGroup
                testid="compression-pills"
                value={settings.compression}
                onChange={(v) => setS({ compression: v })}
                options={[
                  { value: "quality", label: "Quality" },
                  { value: "balanced", label: "Balanced" },
                  { value: "smallest", label: "Smallest" },
                ]}
              />
            </div>
            <Slider label="Quality (JPEG/WebP)" value={settings.quality} min={60} max={100} onChange={(v) => setS({ quality: v })} testid="quality-slider" />
            <div>
              <div className="label-tiny mb-2">Max file size</div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} value={settings.maxKB} onChange={(e) => setS({ maxKB: Number(e.target.value) })} className="input-base w-24" data-testid="maxkb-input" />
                <span className="text-xs text-raven-muted">KB · 0 = no limit</span>
              </div>
            </div>
          </Card>

          <Card title="Resize" icon={Maximize2} testid="card-resize">
            <div>
              <div className="label-tiny mb-2">Preset</div>
              <select
                value={settings.preset}
                onChange={(e) => setS({ preset: Number(e.target.value) })}
                className="input-base w-full"
                data-testid="preset-select"
              >
                {PRESET_SIZES.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label-tiny mb-2">Width (px)</div>
                <input type="number" min={0} value={settings.width} onChange={(e) => setS({ width: Number(e.target.value) })} className="input-base w-full" data-testid="width-input" />
              </div>
              <div>
                <div className="label-tiny mb-2">Height (px)</div>
                <input type="number" min={0} value={settings.height} onChange={(e) => setS({ height: Number(e.target.value) })} className="input-base w-full" data-testid="height-input" />
              </div>
            </div>
            <Toggle checked={settings.lockAspect} onChange={(v) => setS({ lockAspect: v })} label="Lock aspect ratio" testid="lock-aspect-toggle" />
            <Toggle checked={settings.upscale} onChange={(v) => setS({ upscale: v })} label="Allow upscale" testid="upscale-toggle" />
            <Toggle checked={settings.bleed} onChange={(v) => setS({ bleed: v })} label="Add 3mm print bleed" testid="bleed-toggle" />
          </Card>

          <Card title="Enhance" icon={Sparkles} testid="card-enhance">
            <Slider label="Sharpen" value={settings.sharpen} min={0} max={10} onChange={(v) => setS({ sharpen: v })} testid="sharpen-slider" />
            <Slider label="Brightness" value={settings.brightness} min={-50} max={50} onChange={(v) => setS({ brightness: v })} testid="brightness-slider" />
            <Slider label="Contrast" value={settings.contrast} min={-50} max={50} onChange={(v) => setS({ contrast: v })} testid="contrast-slider" />
            <Slider label="Saturation" value={settings.saturation} min={-50} max={50} onChange={(v) => setS({ saturation: v })} testid="saturation-slider" />
          </Card>

          <Card title="Background Removal" icon={Eraser} testid="card-bgremove">
            <Toggle checked={settings.removeBg} onChange={(v) => setS({ removeBg: v })} label="Remove background (AI)" testid="bg-toggle" />
            <p className="text-xs text-raven-muted leading-relaxed">
              Runs entirely on your device — no upload, no API key. First use downloads a one-off ~40&nbsp;MB AI model (cached after).
            </p>
            {settings.removeBg && (
              <div className="text-xs px-3 py-2 rounded-md bg-raven-violet/10 border border-raven-violet/30 text-raven-violetBright" data-testid="bg-info">
                Output will be saved as PNG with transparency.
              </div>
            )}
          </Card>
        </div>

        {/* Process button + progress */}
        <div className="flex flex-col items-center gap-4">
          <button onClick={process} disabled={busy || files.length === 0} className="btn-primary text-lg px-12 py-4 animate-pulse-glow" data-testid="process-button">
            {busy ? "PROCESSING…" : results.length > 0 ? "OPTIMISE AGAIN" : "OPTIMISE"} <ChevronRight size={18} />
          </button>
          {busy && (
            <div className="w-full max-w-xl" data-testid="progress-wrap">
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-raven-violet to-raven-cyan transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-xs text-raven-muted mt-2 text-center truncate">{progress.text} · {progressPct}%</div>
            </div>
          )}
        </div>

        {/* Preview */}
        {results.length > 0 && preview && (
          <section className="surface p-5 space-y-4" data-testid="preview-section">
            <div className="flex items-center justify-between">
              <h3 className="font-display tracking-[0.18em] text-sm uppercase">Before / After</h3>
              {results.length > 1 && (
                <select value={previewIdx} onChange={(e) => setPreviewIdx(Number(e.target.value))} className="input-base text-xs" data-testid="preview-select">
                  {results.map((r, i) => (<option key={r.id} value={i}>{r.name}</option>))}
                </select>
              )}
            </div>
            <ReactCompareSlider
              data-testid="before-after-slider"
              itemOne={<ReactCompareSliderImage src={preview.originalURL} alt="Before" />}
              itemTwo={<ReactCompareSliderImage src={preview.outputURL} alt="After" />}
              style={{ height: 480, borderRadius: 12, overflow: "hidden", background: "#000" }}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><div className="label-tiny mb-1">Output dims</div><div>{preview.width}×{preview.height}</div></div>
              <div><div className="label-tiny mb-1">DPI</div><div>{preview.dpi}</div></div>
              <div><div className="label-tiny mb-1">Original</div><div>{fmtKB(preview.originalSize)}</div></div>
              <div><div className="label-tiny mb-1">Output</div><div className="text-emerald-400">{fmtKB(preview.outputSize)}</div></div>
            </div>
          </section>
        )}

        {/* Download grid */}
        {results.length > 0 && (
          <section className="surface p-5 space-y-4" data-testid="download-section">
            <div className="flex items-center justify-between">
              <h3 className="font-display tracking-[0.18em] text-sm uppercase">Download</h3>
              <button onClick={downloadAll} className="btn-ghost" data-testid="download-all-button">
                <Download size={14} /> All as ZIP
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.map((r) => (
                <div key={r.id} className="rounded-lg border border-raven-border bg-black/30 p-3 flex items-center gap-3" data-testid={`download-row-${r.id}`}>
                  <div className="h-12 w-12 rounded overflow-hidden bg-black/40">
                    <img src={r.outputURL} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{r.name}</div>
                    <div className="label-tiny">{r.width}×{r.height} · {fmtKB(r.outputSize)}</div>
                  </div>
                  <button onClick={() => downloadOne(r)} className="btn-ghost px-3 py-1.5" data-testid={`download-one-${r.id}`}>
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="text-center text-raven-muted text-xs py-8">
          Raven Sharp · Built for designers, sellers, and print pros.
        </div>
      </main>
      <Footer />
    </div>
  );
}
