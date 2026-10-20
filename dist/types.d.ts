export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type Posture =
  | 'standing'
  | 'sitting'
  | 'slouching'
  | 'lying'
  | 'arms_raised'
  | 'upper_body';

export interface PostureMetrics {
  torsoTiltDeg: number;
  neckTiltDeg: number;
  hipAngleDeg: number | null;
  kneeAngleDeg: number | null;
  shoulderRollDeg: number;
}

export interface PostureAnalysis {
  posture: Posture;
  label: string;
  confidence: number;
  alerts: string[];
  metrics: PostureMetrics;
  anchor: { x: number; y: number };
}

export interface DetectedPerson extends PostureAnalysis {
  id: number;
  landmarks: Landmark[];
  worldLandmarks: Landmark[] | null;
}

export interface DetectionResult {
  count: number;
  people: DetectedPerson[];
  byPosture: Record<Posture, number>;
  summary: string;
  timestampMs: number;
  fps: number;
}

export type ModelVariant = 'lite' | 'full' | 'heavy' | (string & {});

export interface PeostureOptions {
  model?: ModelVariant;
  maxPeople?: number;
  delegate?: 'GPU' | 'CPU';
  minConfidence?: number;
  wasmPath?: string;
}

export interface RenderOptions {
  enabled?: boolean;
  mirrored?: boolean;
  showBadges?: boolean;
  showSkeleton?: boolean;
  clearCanvas?: boolean;
}

export interface LoopOptions extends RenderOptions {
  canvas?: HTMLCanvasElement | null;
  onFrame?: (result: DetectionResult) => void;
  videoConstraints?: MediaTrackConstraints;
}
