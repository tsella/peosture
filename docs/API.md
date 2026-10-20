# `peosture` — Complete API & Integration Reference

This document provides the full API specification, TypeScript data structures, posture classification heuristics, and framework integration patterns for `peosture`.

---

## 1. Package Entrypoints

| Import Path | Exports | When to Use |
| :--- | :--- | :--- |
| `peosture` | `Peosture`, `MODEL_PRESETS`, `analyzePosture`, `angleBetweenPoints`, `angleFromVertical`, `LANDMARK_INDEX`, `drawOverlay`, `POSE_CONNECTIONS`, `PERSON_PALETTES`, `POSTURE_COLORS`, all TS types | Full WASM detection + posture classification + canvas rendering. |
| `peosture/posture` | `analyzePosture`, `angleBetweenPoints`, `angleFromVertical`, `LANDMARK_INDEX` | Zero-dependency posture math when you already have 33-keypoint landmarks. |
| `peosture/renderer` | `drawOverlay`, `POSE_CONNECTIONS`, `PERSON_PALETTES`, `POSTURE_COLORS` | Standalone 2D canvas skeleton and badge renderer. |

---

## 2. Core Class: `Peosture`

### `Peosture.create(options?: PeostureOptions): Promise<Peosture>`
Static factory that instantiates `Peosture` and awaits `.init()` in a single call.

```ts
const peosture = await Peosture.create({
  model: 'lite',
  maxPeople: 4,
  delegate: 'GPU',
  minConfidence: 0.5,
});
```

### `new Peosture(options?: PeostureOptions)`
Constructs an uninitialized instance. You must call `await peosture.init()` before calling `detect()` (note: `startWebcam()` calls `init()` automatically if not yet initialized).

### `peosture.init(overrideOptions?: Partial<PeostureOptions>): Promise<{ delegate: 'GPU' | 'CPU'; model: ModelVariant }>`
Loads the MediaPipe Tasks Vision WASM binary and `.task` model bundle.
- Tries the requested `delegate` (`'GPU'` by default) first.
- Automatically falls back to `'CPU'` WASM if WebGL/GPU initialization fails.
- Safe to call multiple times to switch models at runtime (closes the previous WASM instance first).

### `peosture.setOptions(partial: Partial<Pick<PeostureOptions, 'maxPeople' | 'minConfidence'>>): Promise<void>`
Updates `maxPeople` or `minConfidence` on the live WASM detector without reloading the model weights.

### `peosture.setOverlay(enabledOrOptions: boolean | Partial<RenderOptions>): void`
Enables, disables, or updates canvas overlay rendering at runtime without restarting the video loop.
- Pass `false` (`peosture.setOverlay(false)`) to hide the overlay and immediately clear the `<canvas>`, or `true` to re-enable it.
- Pass a partial `RenderOptions` object (`peosture.setOverlay({ showBadges: false, showSkeleton: true, mirrored: true })`) to selectively toggle badges or skeleton rendering on the fly.

### `peosture.detect(source, timestampMs?: number): DetectionResult`
Runs synchronous multi-person pose detection and posture analysis on a single frame.
- **`source`**: `HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap`
- **`timestampMs`**: Frame timestamp (defaults to `performance.now()`). Internally clamped to be strictly monotonically increasing so MediaPipe's `VIDEO` mode never throws a timestamp mismatch error.

### `peosture.analyze(landmarksList: Landmark[][], worldLandmarksList?: Landmark[][], timestampMs?: number): DetectionResult`
Runs posture classification on pre-extracted or synthetic 33-landmark arrays without invoking the WASM detector. Also updates rolling FPS and aggregates `byPosture` counts.

### `peosture.startWebcam(videoElement: HTMLVideoElement, options?: LoopOptions): Promise<MediaStream>`
Requests camera permissions via `navigator.mediaDevices.getUserMedia`, binds the stream to `videoElement`, plays the video, and starts a `requestAnimationFrame` detection loop (`startLoop`).

### `peosture.startLoop(videoElement: HTMLVideoElement, options?: LoopOptions): void`
Starts a continuous `requestAnimationFrame` loop over an already-playing `HTMLVideoElement`.
- Automatically syncs `options.canvas.width` and `options.canvas.height` to `videoElement.videoWidth` and `videoElement.videoHeight`.
- Only runs inference when `videoElement.currentTime` advances to a new frame.
- Draws skeletons and posture badges when `options.canvas` is provided.
- Invokes `options.onFrame(result)` with the `DetectionResult`.

### `peosture.stop(): void`
Cancels the active `requestAnimationFrame` loop, stops all `MediaStreamTrack`s opened by `startWebcam()`, and resets FPS counters. Does **not** unload the WASM model (so detection can be restarted immediately).

### `peosture.dispose(): void`
Calls `stop()` and closes the underlying MediaPipe `PoseLandmarker` WASM instance to free GPU/WASM heap memory. Call this when unmounting components.

### Properties
- **`peosture.isReady: boolean`** — `true` once WASM initialization has succeeded.
- **`peosture.delegate: 'GPU' | 'CPU'`** — Active hardware delegate.
- **`peosture.overlayEnabled: boolean`** — Whether canvas overlay rendering is currently enabled.

---

## 3. Data Types (`src/types.ts`)

```ts
export type Posture =
  | 'standing'
  | 'sitting'
  | 'slouching'
  | 'lying'
  | 'arms_raised'
  | 'upper_body';

export interface Landmark {
  x: number;          // Normalized [0, 1] in image space (or meters in world space)
  y: number;          // Normalized [0, 1] in image space (or meters in world space)
  z: number;          // Depth relative to hip midpoint
  visibility?: number; // [0, 1] likelihood that keypoint is not occluded
}

export interface PostureMetrics {
  torsoTiltDeg: number;       // Spine angle from vertical UP (0° = vertical, 90° = horizontal)
  neckTiltDeg: number;        // Neck/head angle from vertical UP
  hipAngleDeg: number | null; // Mean shoulder-hip-knee angle (3D when worldLandmarks present), or null
  kneeAngleDeg: number | null;// Mean hip-knee-ankle angle (3D when worldLandmarks present), or null
  shoulderRollDeg: number;    // Lateral shoulder tilt from horizontal
}

export interface PostureAnalysis {
  posture: Posture;           // Machine-readable category key
  label: string;              // Human-readable display label (e.g. "Sitting", "Slouching / Leaning")
  confidence: number;         // Visibility confidence in [0, 100]
  alerts: string[];           // Active warnings: 'Uneven shoulders' | 'Forward head tilt' | 'Leaning torso' | 'Hand raised' | 'Both hands raised'
  metrics: PostureMetrics;
  anchor: { x: number; y: number }; // Clamped normalized coordinates above the head for badge rendering
}

export interface DetectedPerson extends PostureAnalysis {
  id: number;                        // 1-based person index in frame
  landmarks: Landmark[];             // 33 normalized image-space landmarks
  worldLandmarks: Landmark[] | null; // 33 metric 3D landmarks in meters
}

export interface DetectionResult {
  count: number;                     // Number of people detected
  people: DetectedPerson[];
  byPosture: Record<Posture, number>;
  summary: string;                   // e.g. "1 Standing · 1 Sitting" or "No people detected"
  timestampMs: number;
  fps: number;
}
```

### Configuration Options

```ts
export interface PeostureOptions {
  model?: 'lite' | 'full' | 'heavy' | (string & {}); // Default: 'lite'
  maxPeople?: number;                                // Default: 4
  delegate?: 'GPU' | 'CPU';                          // Default: 'GPU' (auto-fallbacks to 'CPU')
  minConfidence?: number;                            // Default: 0.5
  wasmPath?: string;                                 // Default: jsDelivr @mediapipe/tasks-vision@0.10.18/wasm
}

export interface RenderOptions {
  enabled?: boolean;      // Master toggle to enable or disable overlay drawing. Default: true
  mirrored?: boolean;     // Counter-flip text badges when canvas has CSS scaleX(-1). Default: false
  showBadges?: boolean;   // Draw floating posture & angle pills. Default: true
  showSkeleton?: boolean; // Draw 33 keypoints and bone connectors. Default: true
  clearCanvas?: boolean;  // Clear canvas before drawing. Default: true
}

export interface LoopOptions extends RenderOptions {
  canvas?: HTMLCanvasElement | null;
  onFrame?: (result: DetectionResult) => void;
  videoConstraints?: MediaTrackConstraints;
}
```

---

## 4. Posture Classification Heuristics (`src/posture.ts`)

`analyzePosture(landmarks, worldLandmarks?)` evaluates postures in priority order:

1. **`'lying'` (`"Lying Down"`)**:
   - Triggered when hips are visible and `torsoTiltDeg > 55°` from vertical.
2. **`'slouching'` (`"Slouching / Leaning"`)**:
   - Triggered when `torsoTiltDeg > 22°`, OR `neckTiltDeg > 28°`, OR foreshortened neck-to-shoulder width ratio `< 0.27`, OR 3D head Z-offset leans forward `< -0.16m` relative to shoulders.
3. **`'sitting'` vs `'standing'`** (when at least one hip + knee pair has `visibility >= 0.4`):
   - Computes 3D hip flexion (`shoulder–hip–knee`) and knee flexion (`hip–knee–ankle`) angles using `worldLandmarks` (falling back to 2D if 3D landmarks are omitted), plus 2D thigh-to-torso vertical ratio.
   - Classified as `'sitting'` if `hipAngleDeg < 135°`, `kneeAngleDeg < 135°`, or `thighToTorsoRatio < 0.55`; otherwise `'standing'`.
4. **`'arms_raised'` / `'upper_body'`** (when legs are outside the camera frame, e.g. desk webcam):
   - If either wrist is above the shoulder (`wrist.y < shoulder.y - 0.08`), classified as `'arms_raised'` (`"Hand Raised"` / `"Both Hands Raised"`).
   - Otherwise classified as `'upper_body'` (`"Good Posture (Desk)"`).

---

## 5. Framework Integration Recipes

### React / Next.js Component Example

> **Important for SSR (Next.js / Remix)**: `Peosture` uses browser WebAssembly, WebGL, and `navigator.mediaDevices`. Always initialize inside `useEffect` (client-side only) and call `peosture.dispose()` in the cleanup function.

```tsx
import { useEffect, useRef, useState } from 'react';
import { Peosture, type DetectionResult } from 'peosture';

export function PostureMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);

  useEffect(() => {
    let active = true;
    const detector = new Peosture({ model: 'lite', maxPeople: 4 });

    async function start() {
      if (!videoRef.current || !canvasRef.current) return;
      await detector.init();
      if (!active) return;

      await detector.startWebcam(videoRef.current, {
        canvas: canvasRef.current,
        mirrored: true,
        onFrame: (res) => {
          if (active) setResult(res);
        },
      });
    }

    start().catch(console.error);

    return () => {
      active = false;
      detector.dispose();
    };
  }, []);

  return (
    <div>
      <div style={{ position: 'relative', width: 640, height: 360 }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }}
        />
      </div>
      <p>People: {result?.count ?? 0} — {result?.summary}</p>
    </div>
  );
}
```

### Offline / Self-Hosted WASM & Model Assets

By default, `Peosture` loads the MediaPipe WASM binaries from jsDelivr CDN and the `.task` model from Google Cloud Storage. To run completely offline or behind a strict CSP:

1. Copy `node_modules/@mediapipe/tasks-vision/wasm/*` to your static public folder (e.g. `/public/wasm`).
2. Download `pose_landmarker_lite.task` to `/public/models/pose_landmarker_lite.task`.
3. Pass custom paths to `Peosture`:

```ts
const peosture = await Peosture.create({
  wasmPath: '/wasm',
  model: '/models/pose_landmarker_lite.task',
});
```

---

## 6. Minimum Browser Requirements

| Engine / Browser | Minimum Version | Key Web Platform Dependencies |
| :--- | :--- | :--- |
| **Chromium** (Chrome, Edge, Brave) | **Chrome 99+** | WebAssembly SIMD (Chrome 91+), WebGL 2.0, ES2022, `ctx.roundRect()` (Chrome 99+). |
| **WebKit** (Safari macOS & iOS/iPadOS) | **Safari 16.4+** (WebKit `615.1.26+`) | WebAssembly SIMD (Safari 16.4+), WebGL 2.0 (Safari 15+), `ctx.roundRect()` (Safari 16.0+). *Note: Safari 16.0–16.3 runs using MediaPipe's non-SIMD WASM fallback.* |
| **Gecko** (Firefox) | **Firefox 112+** | WebAssembly SIMD (Firefox 89+), WebGL 2.0, `ctx.roundRect()` (Firefox 112+). |

