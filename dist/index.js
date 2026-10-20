export const VERSION = '0.1.0';

export { Peosture, MODEL_PRESETS } from './detector.js';
export {
  analyzePosture,
  angleBetweenPoints,
  angleFromVertical,
  LANDMARK_INDEX,
} from './posture.js';
export {
  drawOverlay,
  POSE_CONNECTIONS,
  PERSON_PALETTES,
  POSTURE_COLORS,
} from './renderer.js';
