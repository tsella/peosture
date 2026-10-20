export declare const VERSION = "0.1.1";
export { Peosture, MODEL_PRESETS } from './detector.js';
export { analyzePosture, angleBetweenPoints, angleFromVertical, LANDMARK_INDEX } from './posture.js';
export { drawOverlay, POSE_CONNECTIONS, PERSON_PALETTES, POSTURE_COLORS } from './renderer.js';
export type { Landmark, Posture, PostureMetrics, PostureAnalysis, DetectedPerson, DetectionResult, ModelVariant, PeostureOptions, RenderOptions, LoopOptions } from './types.js';
