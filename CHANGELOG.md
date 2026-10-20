# Changelog

All notable changes to `peosture` will be documented in this file.

## [0.1.1] - 2026-10-19

### Added
- Runtime overlay toggling via `peosture.setOverlay(enabledOrOptions)`, `peosture.overlayEnabled`, and `RenderOptions.enabled`.
- Browser compatibility matrix (Chrome 99+, Safari/WebKit 16.4+, Firefox 112+) in `README.md`, `AGENTS.md`, and `docs/API.md`.
- `CLAUDE.md` referencing `@AGENTS.md`.

### Fixed
- Side-profile single-ear fallback when computing `neckTiltDeg` in `analyzePosture`.
- Upper-body confidence calculation when lower-body joints are outside the webcam frame.
- Defensive landmark bounds and core-joint guards in `analyzePosture`.
- Automatic canvas clearing when `peosture.stop()` or `peosture.setOverlay(false)` is called.

## [0.1.0] - 2026-10-19

### Added
- **`Peosture` Core WASM Detector (`src/detector.ts`)**:
  - In-browser multi-person pose detection powered by MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`) with `GPU` and automatic `CPU` WASM fallback.
  - Static factory `Peosture.create(options)` and methods `init()`, `setOptions()`, `detect()`, `analyze()`, `startWebcam()`, `startLoop()`, `stop()`, and `dispose()`.
  - Monotonic timestamp protection for MediaPipe `VIDEO` mode.
- **Biomechanical Posture Classifier (`src/posture.ts`, `peosture/posture`)**:
  - Real-time posture classification (`standing`, `sitting`, `slouching`, `lying`, `arms_raised`, `upper_body`) using 2D and 3D world landmarks.
  - Joint angle metrics (`torsoTiltDeg`, `neckTiltDeg`, `hipAngleDeg`, `kneeAngleDeg`, `shoulderRollDeg`) and posture alerts.
- **Canvas Overlay Renderer (`src/renderer.ts`, `peosture/renderer`)**:
  - Standalone 2D canvas skeleton and floating posture badge renderer (`drawOverlay`) with support for CSS-mirrored views (`mirrored: true`).
- **Interactive Demo & Documentation**:
  - Browser demo (`index.html`, `app.js`, `style.css`) with live webcam and 3-person synthetic simulator.
  - Agent integration guide (`AGENTS.md`) and full API reference (`docs/API.md`).
  - MIT License (`Copyright (c) 2026 Tom Sella`) with Apache 2.0 model attribution for Google MediaPipe Pose Landmarker.
