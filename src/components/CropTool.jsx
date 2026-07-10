import React, { useRef, useState, useEffect, useCallback } from "react";
import { Crop, Check, X, RotateCcw } from "lucide-react";
import { CROP_RATIOS } from "../lib/imageProcessing";

/**
 * CropTool — Interactive crop overlay on top of the image.
 * Returns crop rect in ORIGINAL image pixels via onCrop({ x, y, width, height }).
 * Renders a rule-of-thirds grid inside the crop box.
 */
export default function CropTool({ imageURL, originalWidth, originalHeight, onCrop, onCancel }) {
  const containerRef = useRef(null);
  const [selectedRatio, setSelectedRatio] = useState(null); // null = free
  const [drag, setDrag] = useState(null);
  const [cropBox, setCropBox] = useState(null); // { x, y, w, h } in display px
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Read the size immediately on mount — don't rely solely on
    // ResizeObserver's first callback, which can be delayed or skipped
    // if the container starts at 0×0 (e.g. still inside a tab-switch
    // transition), leaving containerSize stuck and cropBox never
    // initializing (which is why nothing appeared and the ratio
    // buttons silently did nothing — they require cropBox to exist).
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width && rect.height) {
      setContainerSize({ w: rect.width, h: rect.height });
    }

    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width && height) setContainerSize({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Scale factor: original pixels → display pixels
  const scaleX = containerSize.w ? containerSize.w / originalWidth  : 1;
  const scaleY = containerSize.h ? containerSize.h / originalHeight : 1;
  const scale  = Math.min(scaleX, scaleY);
  const dispW  = originalWidth  * scale;
  const dispH  = originalHeight * scale;
  const offsetX = (containerSize.w - dispW) / 2;
  const offsetY = (containerSize.h - dispH) / 2;

  const toDisplayX = x  => x  * scale + offsetX;
  const toDisplayY = y  => y  * scale + offsetY;
  const toOrigX    = dx => (dx - offsetX) / scale;
  const toOrigY    = dy => (dy - offsetY) / scale;

  // Default crop = full image
  useEffect(() => {
    if (dispW && dispH && !cropBox) {
      setCropBox({ x: offsetX, y: offsetY, w: dispW, h: dispH });
    }
  }, [dispW, dispH, offsetX, offsetY]);

  const startDrag = useCallback((e, handle) => {
    if (e.cancelable) e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDrag({ handle, startX: clientX, startY: clientY, startBox: { ...cropBox } });
  }, [cropBox]);

  const onMove = useCallback((e) => {
    if (!drag || !cropBox) return;
    if (e.cancelable) e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    const sb = drag.startBox;
    let { x, y, w, h } = sb;

    if (drag.handle === "move") {
      x = Math.max(offsetX, Math.min(offsetX + dispW - w, sb.x + dx));
      y = Math.max(offsetY, Math.min(offsetY + dispH - h, sb.y + dy));
    } else {
      if (drag.handle.includes("e")) w = Math.max(20, Math.min(offsetX + dispW - x, sb.w + dx));
      if (drag.handle.includes("s")) h = Math.max(20, Math.min(offsetY + dispH - y, sb.h + dy));
      if (drag.handle.includes("w")) { x = Math.max(offsetX, Math.min(sb.x + dx, sb.x + sb.w - 20)); w = sb.w - (x - sb.x); }
      if (drag.handle.includes("n")) { y = Math.max(offsetY, Math.min(sb.y + dy, sb.y + sb.h - 20)); h = sb.h - (y - sb.y); }

      // Enforce aspect ratio
      if (selectedRatio) {
        if (drag.handle.includes("e") || drag.handle.includes("w")) h = w / selectedRatio;
        else w = h * selectedRatio;
        // Clamp
        if (x + w > offsetX + dispW) w = offsetX + dispW - x;
        if (y + h > offsetY + dispH) h = offsetY + dispH - y;
      }
    }
    setCropBox({ x, y, w, h });
  }, [drag, offsetX, offsetY, dispW, dispH, selectedRatio]);

  const endDrag = useCallback(() => setDrag(null), []);

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", endDrag);
    window.addEventListener("touchcancel", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", onMove, { passive: false });
      window.removeEventListener("touchend", endDrag);
      window.removeEventListener("touchcancel", endDrag);
    };
  }, [onMove, endDrag]);

  const applyRatio = (ratio) => {
    setSelectedRatio(ratio);
    if (!cropBox || !ratio) return;
    const { x, y, w } = cropBox;
    const h = w / ratio;
    if (y + h <= offsetY + dispH) setCropBox({ x, y, w, h });
  };

  const resetCrop = () => {
    setCropBox({ x: offsetX, y: offsetY, w: dispW, h: dispH });
  };

  const confirmCrop = () => {
    if (!cropBox) return;
    const origX = Math.round(toOrigX(cropBox.x));
    const origY = Math.round(toOrigY(cropBox.y));
    const origW = Math.round(cropBox.w / scale);
    const origH = Math.round(cropBox.h / scale);
    onCrop({
      x: Math.max(0, origX),
      y: Math.max(0, origY),
      width:  Math.min(origW, originalWidth  - Math.max(0, origX)),
      height: Math.min(origH, originalHeight - Math.max(0, origY)),
    });
  };

  const cb = cropBox;
  const HANDLES = ["n","ne","e","se","s","sw","w","nw"];
  const handlePos = {
    n:  { left: cb ? cb.x + cb.w/2 - 5 : 0, top: cb ? cb.y - 5 : 0 },
    ne: { left: cb ? cb.x + cb.w - 5  : 0, top: cb ? cb.y - 5 : 0 },
    e:  { left: cb ? cb.x + cb.w - 5  : 0, top: cb ? cb.y + cb.h/2 - 5 : 0 },
    se: { left: cb ? cb.x + cb.w - 5  : 0, top: cb ? cb.y + cb.h - 5 : 0 },
    s:  { left: cb ? cb.x + cb.w/2 - 5: 0, top: cb ? cb.y + cb.h - 5 : 0 },
    sw: { left: cb ? cb.x - 5         : 0, top: cb ? cb.y + cb.h - 5 : 0 },
    w:  { left: cb ? cb.x - 5         : 0, top: cb ? cb.y + cb.h/2 - 5 : 0 },
    nw: { left: cb ? cb.x - 5         : 0, top: cb ? cb.y - 5 : 0 },
  };
  const CURSORS = { n:"ns-resize",ne:"nesw-resize",e:"ew-resize",se:"nwse-resize",s:"ns-resize",sw:"nesw-resize",w:"ew-resize",nw:"nwse-resize" };

  return (
    <div className="flex flex-col gap-4">
      {/* Ratio picker */}
      <div className="flex flex-wrap gap-2">
        {CROP_RATIOS.map(r => (
          <button key={r.label} onClick={() => applyRatio(r.ratio)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedRatio === r.ratio
                ? "bg-[var(--raven)]/30 text-[var(--raven-glow)] border border-[var(--raven)]/40"
                : "bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10"
            }`}>
            {r.label}
          </button>
        ))}
        <button onClick={resetCrop}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-[var(--muted)] border border-white/10 hover:bg-white/10 flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef}
        className="relative rounded-xl overflow-hidden bg-black/50"
        style={{ height: "360px", touchAction: "none" }}
        onMouseMove={onMove} onTouchMove={onMove}
        onMouseUp={endDrag} onTouchEnd={endDrag}
      >
        {/* Image */}
        <img src={imageURL} alt="crop"
          style={{ position:"absolute", left: offsetX, top: offsetY,
                   width: dispW, height: dispH, pointerEvents:"none", userSelect:"none" }} />

        {/* Dark overlay outside crop */}
        {cb && (
          <>
            <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.55)", pointerEvents:"none" }} />
            {/* Clear crop area */}
            <div style={{ position:"absolute", left:cb.x, top:cb.y, width:cb.w, height:cb.h,
                         boxShadow:"0 0 0 9999px rgba(0,0,0,0.55)", pointerEvents:"none" }} />

            {/* Rule of thirds grid */}
            <svg style={{ position:"absolute", left:cb.x, top:cb.y, width:cb.w, height:cb.h, pointerEvents:"none" }}>
              <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="1.5" />
            </svg>

            {/* Move handle (inside box) */}
            <div style={{ position:"absolute", left:cb.x, top:cb.y, width:cb.w, height:cb.h,
                         cursor:"move", zIndex:10, touchAction:"none" }}
              onMouseDown={e => startDrag(e, "move")}
              onTouchStart={e => startDrag(e, "move")} />

            {/* Resize handles */}
            {HANDLES.map(h => (
              <div key={h} style={{
                position:"absolute",
                left: handlePos[h].left, top: handlePos[h].top,
                width:10, height:10,
                background:"white",
                border:"2px solid var(--raven-glow)",
                borderRadius:2,
                cursor: CURSORS[h],
                zIndex:20,
                touchAction:"none",
              }}
                onMouseDown={e => startDrag(e, h)}
                onTouchStart={e => startDrag(e, h)} />
            ))}

            {/* Dimensions badge */}
            <div style={{ position:"absolute", left:cb.x+6, top:cb.y+6,
                         background:"rgba(0,0,0,0.7)", borderRadius:4, padding:"2px 6px",
                         fontSize:10, color:"rgba(255,255,255,0.7)", fontFamily:"monospace",
                         pointerEvents:"none", zIndex:30 }}>
              {Math.round(cb.w / scale)} × {Math.round(cb.h / scale)}px
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={confirmCrop}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-xl text-sm font-semibold transition-all">
          <Check className="w-4 h-4" /> Apply Crop
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-[var(--muted)] rounded-xl text-sm transition-all">
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>
    </div>
  );
}
