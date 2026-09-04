# Image Optimiser regression repair — 2026-08-22

Acceptance criteria:
- background removal is per-image opt-in only;
- signed-in background removal uses backend processing and preserves PNG transparency;
- failed/unavailable AI upscaling never enlarges source pixels via canvas fallback;
- successful AI upscale is not enlarged a second time client-side;
- crop behaviour is unchanged;
- failed transforms preserve the original preview;
- processed previews use blob URLs to reduce mobile preview latency/memory pressure.
