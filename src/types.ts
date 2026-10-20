/**
 * 2D/3D pose landmark from MediaPipe Pose Landmarker (33 keypoints per person).
 */
export interface Landmark {
  /** Normalized X coordinate in [0, 1] (or meters for world landmarks). */
  x: number;
  /** Normalized Y coordinate in [0, 1] (or meters for world landmarks). */
  y: number;
  /** Depth coordinate relative to hip midpoint. */
  z: number;
  /** Visibility likelihood in [0, 1]. */
  visibility?: number;
}

/**
 * Primary posture classification categories.
 */
export type Posture =
  | 'standing'
  | 'sitting'
  | 'slouching'
  | 'lying'
  | 'arms_raised'
  | 'upper_body';

/**
 * Biomechanical joint and inclination angles in degrees.
 */
export interface PostureMetrics {
  /** Spine inclination (mid-hip to mid-shoulder) from vertical UP (0° = upright). */
  torsoTiltDeg: number;
  /** Neck inclination (mid-shoulder to ear/nose) from vertical UP. */
  neckTiltDeg: number;
  /** Mean hip flexion angle (shoulder–hip–knee), or `null` if legs are out of frame. */
  hipAngleDeg: number | null;
  /** Mean knee flexion angle (hip–knee–ankle), or `null` if ankles are out of frame. */
  kneeAngleDeg: number | null;
  /** Lateral shoulder tilt relative to horizontal. */
  shoulderRollDeg: number;
}

/**
 * Posture classification result for a single person.
 */
export interface PostureAnalysis {
  /** Machine-friendly posture category. */
  posture: Posture;
  /** Human-readable posture label (e.g. "Standing", "Sitting", "Slouching"). */
  label: string;
  /** Landmark visibility confidence in [0, 100]. */
  confidence: number;
  /** Active posture warnings or secondary flags (e.g. "Forward head tilt", "Hand raised"). */
  alerts: string[];
  /** Biomechanical angle measurements. */
  metrics: PostureMetrics;
  /** Normalized 2D anchor `{ x, y }` above the head for overlay badges. */
  anchor: { x: number; y: number };
}

/**
 * Full detection record for a single person in a frame.
 */
export interface DetectedPerson extends PostureAnalysis {
  /** 1-based person index in the frame. */
  id: number;
  /** 33 normalized image-space landmarks ([0, 1]). */
  landmarks: Landmark[];
  /** 33 3D world-space landmarks in meters (if available). */
  worldLandmarks: Landmark[] | null;
}

/**
 * Frame-level detection result returned by `Peosture`.
 */
export interface DetectionResult {
  /** Total number of people detected. */
  count: number;
  /** Detected individuals sorted by detection confidence/order. */
  people: DetectedPerson[];
  /** Breakdown of detected people by `Posture`. */
  byPosture: Record<Posture, number>;
  /** Concise human-readable summary (e.g. "1 Standing · 1 Sitting"). */
  summary: string;
  /** Frame timestamp in milliseconds. */
  timestampMs: number;
  /** Rolling frames-per-second throughput. */
  fps: number;
}

/**
 * Built-in MediaPipe model preset or custom `.task` model URL.
 */
export type ModelVariant = 'lite' | 'full' | 'heavy' | (string & {});

/**
 * Configuration options for `Peosture`.
 */
export interface PeostureOptions {
  /**
   * Model preset ('lite' ~5MB, 'full' ~9MB, 'heavy' ~30MB) or custom `.task` URL.
   * @default 'lite'
   */
  model?: ModelVariant;
  /**
   * Maximum number of people to detect simultaneously.
   * @default 4
   */
  maxPeople?: number;
  /**
   * Preferred WASM hardware delegate. Automatically falls back to 'CPU' if 'GPU' is unavailable.
   * @default 'GPU'
   */
  delegate?: 'GPU' | 'CPU';
  /**
   * Minimum confidence threshold in [0, 1] for pose detection and tracking.
   * @default 0.5
   */
  minConfidence?: number;
  /**
   * Custom URL or local path to the MediaPipe WASM binaries directory.
   */
  wasmPath?: string;
}

/**
 * Options for rendering skeletons and posture badges onto a 2D canvas.
 */
export interface RenderOptions {
  /** Master toggle to enable or disable canvas overlay drawing. @default true */
  enabled?: boolean;
  /** Counter-flip text badges when the canvas is CSS-mirrored (`scaleX(-1)`). @default false */
  mirrored?: boolean;
  /** Render floating posture & spine-angle badges above each person. @default true */
  showBadges?: boolean;
  /** Render skeleton bones and keypoints. @default true */
  showSkeleton?: boolean;
  /** Clear canvas before drawing. @default true */
  clearCanvas?: boolean;
}

/**
 * Options for `startWebcam()` and `startLoop()`.
 */
export interface LoopOptions extends RenderOptions {
  /** Optional `<canvas>` to automatically draw skeletons and badges onto each frame. */
  canvas?: HTMLCanvasElement | null;
  /** Callback fired on every analyzed video frame. */
  onFrame?: (result: DetectionResult) => void;
  /** Custom `MediaTrackConstraints` for `startWebcam()`. */
  videoConstraints?: MediaTrackConstraints;
}
