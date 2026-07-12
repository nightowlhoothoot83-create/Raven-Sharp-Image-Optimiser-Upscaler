import React, { useState } from "react";
import { X, HelpCircle } from "lucide-react";

const STORAGE_KEY = "ravensharp_imageopt_guide_dismissed";

/**
 * Closeable step-by-step "how this page works" guide.
 * Dismissal is remembered in localStorage so it doesn't reappear every visit.
 * A small "?" button stays available to reopen it at any time.
 */
export default function HowToGuide() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  const reopen = () => {
    setDismissed(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  if (dismissed) {
    return (
      <button onClick={reopen}
        className="mb-6 flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--raven-glow)] transition-colors">
        <HelpCircle className="w-3.5 h-3.5" /> How does this work?
      </button>
    );
  }

  const steps = [
    { n: 1, title: "Upload your images", body: "Drag images in or click to browse. You can select multiple at once." },
    { n: 2, title: "Pick what each image needs", body: "Select an image, then choose actions for it — crop, background removal, watermark or auto-enhance. Each image can have different settings." },
    { n: 3, title: "Set your output options", body: "Choose resize, DPI and format under the tabs above the tool area — these apply when you process." },
    { n: 4, title: "Process", body: "Hit Process to run everything. AI upscaling and background removal happen on our servers; resizing, cropping and watermarking happen instantly in your browser." },
    { n: 5, title: "Download", body: "Once processing finishes, download your results individually or as a batch." },
  ];

  return (
    <div className="mb-8 rounded-2xl border border-[var(--raven)]/25 bg-[var(--raven)]/[0.06] p-5 relative">
      <button onClick={dismiss} aria-label="Close guide"
        className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
      <h2 className="text-sm font-semibold mb-4 pr-8">How this tool works</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(s => (
          <div key={s.n} className="flex gap-2.5">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--raven)]/25 border border-[var(--raven)]/40 flex items-center justify-center text-xs font-bold text-[var(--raven-glow)]">
              {s.n}
            </div>
            <div>
              <div className="text-xs font-semibold mb-0.5">{s.title}</div>
              <div className="text-xs text-[var(--muted)] leading-snug">{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
