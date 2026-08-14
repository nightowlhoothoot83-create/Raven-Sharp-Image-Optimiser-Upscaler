# Image Optimiser core-function regression — 2026-08-15

User-verified failures on mobile production/pages.dev:

- Initial uploaded-image preview is not shown prominently after upload.
- Background removal fails before processing with `no available backend found` / WASM dynamic import error.
- AI upscaling fails to create an inference session.
- Failed processing can leave blank/empty result panes, which must never replace a valid source preview.

Required repair acceptance:

1. Uploaded images render an immediate preview before any processing.
2. Background removal completes on a real image in production, or fails without mutating/removing the source image.
3. AI upscaling completes on a real authenticated image in production, or fails without mutating/removing the source image.
4. A failed transform preserves the original preview and reports a concise error.
5. Final result view never renders an empty/blank image for a failed job.
6. Verify on mobile and desktop before locking baseline.

Observed implementation note: `src/lib/imageProcessing.js` uses `@imgly/background-removal` locally and `src/pages/Optimiser.jsx` creates upload object URLs. The failure occurs during local inference session initialisation, before pixel processing.
