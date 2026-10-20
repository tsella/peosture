<div align="center">

# `peosture`

**In-browser WebAssembly multi-person detection & biomechanical posture classification.**

[![Version](https://img.shields.io/badge/version-0.1.0-38bdf8?style=flat-square)](https://github.com/tsella/peosture/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](./LICENSE)
[![Model: MediaPipe Pose](https://img.shields.io/badge/WASM-MediaPipe_Pose-a855f7?style=flat-square)](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6?style=flat-square)](./src/types.ts)

[Quick Start](#quick-start) · [Posture Heuristics](#posture-classification--biomechanical-metrics) · [API Reference](./docs/API.md) · [Agent Guide](./AGENTS.md)

</div>

---

`peosture` is a lightweight, zero-backend TypeScript/JavaScript library that runs **MediaPipe Pose Landmarker in WebAssembly (`@mediapipe/tasks-vision`)** directly in the browser. It detects and counts multiple people in front of a camera, renders 33-keypoint skeletons, and classifies each person's posture in real time.

### Highlights

- **100% Client-Side WASM**: Runs locally via WebGL GPU delegate with automatic CPU WASM fallback. No video frames ever leave the browser.
- **Multi-Person Counting & Tracking**: Tracks 1 to 6+ people simultaneously with per-person posture and angle breakdowns.
- **3D Biomechanical Posture Engine**: Computes spine tilt, neck inclination, 3D hip & knee flexion angles, and shoulder roll to distinguish **Standing**, **Sitting**, **Slouching / Leaning**, **Lying Down**, **Hands Raised**, and **Desk Posture**.
- **Modular Entrypoints**: Import the full WASM detector (`peosture`), just the zero-dependency posture classifier (`peosture/posture`), or the standalone canvas renderer (`peosture/renderer`).
- **Works Everywhere**: Ready for Vite, Next.js, Webpack, Rollup, esbuild, or native browser `<script type="module">` without a build step.

---

## Installation

```bash
# Install directly from GitHub
npm install github:tsella/peosture

# Or with pnpm / yarn
pnpm add github:tsella/peosture
```

---

## Quick Start

### 1. Live Webcam + Skeleton Overlay

```ts
import { Peosture, type DetectionResult } from 'peosture';

const video = document.querySelector<HTMLVideoElement>('#webcam')!;
const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!;

const peosture = await Peosture.create({
  model: 'lite',   // 'lite' (~5 MB) | 'full' (~9 MB) | 'heavy' (~30 MB) | custom .task URL
  maxPeople: 4,    // Simultaneous people to detect
  delegate: 'GPU', // Automatically falls back to 'CPU' WASM if WebGL is unavailable
});

await peosture.startWebcam(video, {
  canvas,          // Optional: automatically renders skeletons & posture badges
  mirrored: true,  // Counter-flips text badges when video/canvas uses CSS scaleX(-1)
  onFrame: (result: DetectionResult) => {
    console.log(`${result.count} people (${result.fps} FPS): ${result.summary}`);

    for (const person of result.people) {
      console.log(
        `Person #${person.id}: ${person.label} [${person.posture}]`,
        person.metrics, // { torsoTiltDeg, neckTiltDeg, hipAngleDeg, kneeAngleDeg, shoulderRollDeg }
        person.alerts   // e.g. ['Forward head tilt', 'Hand raised']
      );
    }
  },
});

// Clean up when unmounting:
peosture.dispose();
```

### 2. Single-Frame or Custom Loop Detection

```ts
import { Peosture, drawOverlay } from 'peosture';

const peosture = await Peosture.create({ model: 'lite', maxPeople: 4 });

// Detect on any HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, or ImageBitmap
const result = peosture.detect(videoElement);

console.log(result.count);     // Total people in frame
console.log(result.byPosture); // { standing: 1, sitting: 1, slouching: 0, ... }

// Render skeletons and floating posture badges onto any 2D canvas context
drawOverlay(canvas.getContext('2d')!, result.people, { mirrored: true });
```

### 3. Standalone Posture Classifier (Bring Your Own Landmarks)

Already running a pose pipeline or Web Worker? Import `peosture/posture` with zero external dependencies:

```ts
import { analyzePosture } from 'peosture/posture';

const analysis = analyzePosture(landmarks2D, worldLandmarks3D);

console.log(analysis.posture); // 'standing' | 'sitting' | 'slouching' | 'lying' | 'arms_raised' | 'upper_body'
console.log(analysis.label);   // e.g. "Sitting (Hand Raised)", "Slouching / Leaning"
console.log(analysis.metrics); // { torsoTiltDeg, neckTiltDeg, hipAngleDeg, kneeAngleDeg, shoulderRollDeg }
```

---

## Posture Classification & Biomechanical Metrics

For every detected person, `peosture` computes five geometric angles from the 33 normalized 2D keypoints and 3D metric world landmarks:

| Metric | Description |
| :--- | :--- |
| `torsoTiltDeg` | Spine inclination (`midHip → midShoulder`) from vertical UP (`0°` = upright, `90°` = horizontal). |
| `neckTiltDeg` | Neck/head inclination (`midShoulder → midEar/nose`) from vertical UP. |
| `hipAngleDeg` | Mean 3D flexion angle at the hip (`shoulder–hip–knee`), or `null` if legs are out of frame. |
| `kneeAngleDeg` | Mean 3D flexion angle at the knee (`hip–knee–ankle`), or `null` if ankles are out of frame. |
| `shoulderRollDeg` | Lateral shoulder tilt relative to the horizontal plane. |

### Posture Categories (`Posture`)

| `person.posture` | `person.label` | Classification Criteria |
| :--- | :--- | :--- |
| `'standing'` | `"Standing"` | Upright torso with extended hip (`>= 135°`) and knee (`>= 135°`) angles. |
| `'sitting'` | `"Sitting"` | Flexed hips (`< 135°`), flexed knees (`< 135°`), or foreshortened thigh-to-torso ratio (`< 0.55`). |
| `'slouching'` | `"Slouching / Leaning"` | Torso lean `> 22°`, forward neck tilt `> 28°`, hunched neck-to-shoulder ratio `< 0.27`, or 3D head forward Z-offset `< -0.16m`. |
| `'lying'` | `"Lying Down"` | Near-horizontal spine orientation (`torsoTiltDeg > 55°`). |
| `'arms_raised'` | `"Hand Raised"` / `"Both Hands Raised"` | Upper-body frame with one or both wrists elevated above shoulders. |
| `'upper_body'` | `"Good Posture (Desk)"` | Upright upper body when lower body is outside the camera field of view. |

---

## Package Entrypoints & API Overview

See **[`docs/API.md`](./docs/API.md)** for full TypeScript interfaces, React/Next.js examples, and offline/self-hosted WASM configuration.

| Method / Function | Entrypoint | Description |
| :--- | :--- | :--- |
| `Peosture.create(options?)` | `peosture` | Async factory that constructs and initializes the WASM detector. |
| `peosture.init(options?)` | `peosture` | Loads or reloads the MediaPipe WASM runtime (`GPU` with `CPU` fallback). |
| `peosture.setOptions(partial)` | `peosture` | Updates `maxPeople` or `minConfidence` on the fly without reloading weights. |
| `peosture.setOverlay(opts)` | `peosture` | Enables/disables (`boolean`) or updates canvas overlay rendering at runtime. |
| `peosture.detect(source, ts?)` | `peosture` | Runs multi-person detection + posture analysis on a single frame. |
| `peosture.analyze(lm2D, lm3D?)` | `peosture` | Classifies an array of 33-keypoint landmark arrays directly. |
| `peosture.startWebcam(video, opts?)` | `peosture` | Opens camera stream and runs a continuous `requestAnimationFrame` loop. |
| `peosture.startLoop(video, opts?)` | `peosture` | Runs a continuous detection loop over an existing `<video>` element. |
| `peosture.stop()` / `dispose()` | `peosture` | Stops active loops/streams and frees WASM/GPU memory. |
| `analyzePosture(lm2D, lm3D?)` | `peosture/posture` | Pure function classifying a single person's 33 landmarks. |
| `drawOverlay(ctx, people, opts?)` | `peosture/renderer` | Renders skeletons and floating posture badges onto a 2D `<canvas>`. |

---

## Running the Interactive Demo Locally

Clone the repository and start the local static server to try live webcam detection or the built-in **3-Person Posture Simulator**:

```bash
git clone https://github.com/tsella/peosture.git
cd peosture
npm run demo
```

Then open **[http://localhost:8080](http://localhost:8080)** in your browser.

---

## Browser Compatibility

`peosture` relies on **WebAssembly SIMD**, **WebGL 2.0** (for the `GPU` delegate, with automatic `CPU` WASM fallback), **ES2022**, and `CanvasRenderingContext2D.roundRect()`:

| Browser / Engine | Minimum Version | Notes |
| :--- | :--- | :--- |
| **Chrome / Chromium** (Edge, Brave) | **Chrome 99+** | Full WASM SIMD + WebGL2 GPU delegate + `ctx.roundRect`. |
| **Safari / WebKit** (macOS & iOS) | **Safari 16.4+** (WebKit `615.1.26+`) | WebAssembly SIMD shipped in Safari 16.4 (Safari 16.0–16.3 falls back to non-SIMD WASM). |
| **Firefox** (Gecko) | **Firefox 112+** | Full WASM SIMD + WebGL2 + `ctx.roundRect`. |

> **Note**: Camera access (`peosture.startWebcam()`) requires a **Secure Context** (`https://` or `http://localhost`).

---

## License & Attribution

### `peosture` Library
Released under the **[MIT License](./LICENSE)** — Copyright © 2026 **Tom Sella**.

### Pose Detection Models & WASM Runtime
`peosture` uses the **MediaPipe Tasks Vision** WebAssembly runtime (`@mediapipe/tasks-vision`) and loads pre-trained **MediaPipe Pose Landmarker (BlazePose GHUM 3D)** models (`pose_landmarker_lite.task`, `pose_landmarker_full.task`, `pose_landmarker_heavy.task`) created by **Google**:

- **License**: [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- **Source & Model Card**: [Google MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) · [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe)
- **Copyright**: Copyright 2020–2026 The MediaPipe Authors / Google LLC.
