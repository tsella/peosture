# AGENTS.md — `peosture` Implementation & Agent Guide

`peosture` is an in-browser WebAssembly multi-person pose detector and biomechanical posture classifier built on MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`).

> **Full API & Type Reference**: See **[`docs/API.md`](./docs/API.md)** for complete method signatures, TypeScript interfaces, posture classification thresholds, and React/Next.js/offline recipes.

---

## 1. Choosing the Right Entrypoint

Depending on the task, import only what is needed:

- **`peosture`** (Full WASM detector + classifier + canvas overlay):
  Use when the app needs to detect people from a webcam, `<video>`, `<img>`, or `<canvas>` using MediaPipe WASM.
- **`peosture/posture`** (Zero-dependency posture classifier):
  Use when the app already has 33-keypoint pose landmarks (e.g. from a custom worker or existing MediaPipe pipeline) and only needs posture classification (`analyzePosture`) or angle math (`angleBetweenPoints`, `angleFromVertical`).
- **`peosture/renderer`** (Standalone 2D canvas renderer):
  Use when rendering `DetectedPerson[]` skeletons and posture badges onto a `<canvas>` (`drawOverlay`).

---

## 2. Standard Implementation Patterns

### Pattern A: Live Webcam + Skeleton Overlay + Callback (Most Common)
```ts
import { Peosture, type DetectionResult } from 'peosture';

const peosture = await Peosture.create({
  model: 'lite',   // 'lite' (~5MB) | 'full' (~9MB) | 'heavy' (~30MB) | custom .task URL
  maxPeople: 4,    // 1..6+
  delegate: 'GPU', // Auto-falls back to 'CPU' WASM if WebGL is unavailable
});

await peosture.startWebcam(videoElement, {
  canvas: canvasElement,
  mirrored: true,  // Set true if video/canvas uses CSS `transform: scaleX(-1)`
  onFrame: (result: DetectionResult) => {
    // result.count: number
    // result.summary: string (e.g. "1 Standing · 1 Sitting")
    // result.byPosture: Record<Posture, number>
    // result.people: DetectedPerson[]
  },
});
```

### Pattern B: Single-Frame or Custom Loop Detection
```ts
import { Peosture, drawOverlay } from 'peosture';

const peosture = await Peosture.create({ model: 'lite', maxPeople: 4 });
const result = peosture.detect(videoOrImageOrCanvasElement);

if (canvasCtx) {
  drawOverlay(canvasCtx, result.people, { mirrored: true });
}
```

### Pattern C: Pure Landmark Classification (No WASM Loader)
```ts
import { analyzePosture } from 'peosture/posture';

const analysis = analyzePosture(landmarks2D, worldLandmarks3D);
// analysis.posture: 'standing' | 'sitting' | 'slouching' | 'lying' | 'arms_raised' | 'upper_body'
// analysis.label: string (human-readable)
// analysis.metrics: { torsoTiltDeg, neckTiltDeg, hipAngleDeg, kneeAngleDeg, shoulderRollDeg }
// analysis.alerts: string[]
```

---

## 3. Critical Rules & Guardrails for Agents

1. **Browser-Only Execution (SSR Guard)**:
   `Peosture` relies on browser WebAssembly, WebGL, DOM `<video>`/`<canvas>`, and `navigator.mediaDevices`. In SSR frameworks (Next.js, Nuxt, Remix, SvelteKit), **never** call `Peosture.create()` or `peosture.init()` at module top-level or during server rendering—always run inside `useEffect` / `onMounted` or a client-only module.
2. **Always Clean Up on Unmount**:
   Call `peosture.stop()` to halt the `requestAnimationFrame` loop and stop webcam `MediaStreamTrack`s, or `peosture.dispose()` to also free WASM/GPU memory when a component unmounts.
3. **Check `person.posture` vs `person.label`**:
   - Use `person.posture` (`'standing' | 'sitting' | 'slouching' | 'lying' | 'arms_raised' | 'upper_body'`) for branching logic and state machines.
   - Use `person.label` (e.g. `"Sitting (Hand Raised)"`, `"Slouching / Leaning"`) for UI display.
4. **Mirroring Text Badges**:
   When a webcam `<video>` and overlay `<canvas>` are flipped horizontally via CSS (`transform: scaleX(-1)`), pass `mirrored: true` to `startWebcam`, `startLoop`, or `drawOverlay` so floating text badges are counter-flipped and remain readable.
5. **Browser Support Policy**:
   - **Chrome / Chromium**: **Chrome 99+** (ES2022, WebAssembly SIMD, WebGL 2.0, `ctx.roundRect`).
   - **Safari / WebKit (macOS & iOS)**: **Safari 16.4+** / WebKit `615.1.26+` (for native WASM SIMD + `ctx.roundRect`; Safari 16.0–16.3 runs via MediaPipe's non-SIMD WASM fallback).
   - **Firefox**: **Firefox 112+**.
   - `startWebcam()` requires a **Secure Context** (`https://` or `http://localhost`).
6. **Modifying This Repository**:
   - Source files live in `src/` (`src/types.ts`, `src/posture.ts`, `src/renderer.ts`, `src/detector.ts`, `src/index.ts`).
   - Pre-built ESM and `.d.ts` files live in `dist/`. Whenever you edit `src/*.ts`, run `npm run build` (or update the corresponding `dist/*.js` and `dist/*.d.ts` files) so `dist/` stays in sync.
   - See **[`docs/API.md`](./docs/API.md)** for full details on internal heuristics and types.
