import { analyzePosture } from './posture.js';
import { drawOverlay } from './renderer.js';
import type {
  DetectedPerson,
  DetectionResult,
  Landmark,
  LoopOptions,
  ModelVariant,
  PeostureOptions,
  Posture,
  RenderOptions,
} from './types.js';

const DEFAULT_WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const DEFAULT_BUNDLE_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';

export const MODEL_PRESETS: Record<'lite' | 'full' | 'heavy', string> = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  heavy:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};

function resolveModelUrl(model: ModelVariant = 'lite'): string {
  if (model === 'lite' || model === 'full' || model === 'heavy') {
    return MODEL_PRESETS[model];
  }
  return model;
}

async function loadMediaPipeVision(): Promise<any> {
  try {
    const pkgName = '@mediapipe/tasks-vision';
    return await import(/* @vite-ignore */ pkgName);
  } catch {
    return await import(/* @vite-ignore */ DEFAULT_BUNDLE_CDN);
  }
}

/**
 * WASM multi-person pose detector and posture classifier.
 */
export class Peosture {
  private options: Required<PeostureOptions>;
  private visionFileset: any = null;
  private poseLandmarker: any = null;
  private activeDelegate: 'GPU' | 'CPU' = 'GPU';

  private mediaStream: MediaStream | null = null;
  private activeCanvas: HTMLCanvasElement | null = null;
  private renderOptions: Required<RenderOptions> = {
    enabled: true,
    mirrored: false,
    showBadges: true,
    showSkeleton: true,
    clearCanvas: true,
  };
  private animFrameId: number | null = null;
  private runningLoop = false;
  private lastVideoTime = -1;
  private lastTimestampMs = 0;

  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 0;

  constructor(options: PeostureOptions = {}) {
    this.options = {
      model: options.model ?? 'lite',
      maxPeople: options.maxPeople ?? 4,
      delegate: options.delegate ?? 'GPU',
      minConfidence: options.minConfidence ?? 0.5,
      wasmPath: options.wasmPath ?? DEFAULT_WASM_CDN,
    };
  }

  /**
   * Create and initialize a `Peosture` instance in one step.
   */
  static async create(options: PeostureOptions = {}): Promise<Peosture> {
    const instance = new Peosture(options);
    await instance.init();
    return instance;
  }

  /**
   * Initialize or reload the MediaPipe WASM PoseLandmarker runtime.
   */
  async init(
    overrideOptions?: Partial<PeostureOptions>
  ): Promise<{ delegate: 'GPU' | 'CPU'; model: ModelVariant }> {
    if (overrideOptions) {
      this.options = { ...this.options, ...overrideOptions };
    }

    const { PoseLandmarker, FilesetResolver } = await loadMediaPipeVision();

    if (!this.visionFileset) {
      this.visionFileset = await FilesetResolver.forVisionTasks(this.options.wasmPath);
    }

    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }

    this.lastTimestampMs = 0;
    const modelAssetPath = resolveModelUrl(this.options.model);
    const sharedConfig = {
      runningMode: 'VIDEO',
      numPoses: this.options.maxPeople,
      minPoseDetectionConfidence: this.options.minConfidence,
      minPosePresenceConfidence: this.options.minConfidence,
      minTrackingConfidence: this.options.minConfidence,
    };

    try {
      this.poseLandmarker = await PoseLandmarker.createFromOptions(this.visionFileset, {
        baseOptions: { modelAssetPath, delegate: this.options.delegate },
        ...sharedConfig,
      });
      this.activeDelegate = this.options.delegate;
    } catch {
      this.poseLandmarker = await PoseLandmarker.createFromOptions(this.visionFileset, {
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        ...sharedConfig,
      });
      this.activeDelegate = 'CPU';
    }

    return {
      delegate: this.activeDelegate,
      model: this.options.model,
    };
  }

  /**
   * Dynamically update runtime detection options (`maxPeople`, `minConfidence`).
   */
  async setOptions(
    partial: Partial<Pick<PeostureOptions, 'maxPeople' | 'minConfidence'>>
  ): Promise<void> {
    if (partial.maxPeople !== undefined) this.options.maxPeople = partial.maxPeople;
    if (partial.minConfidence !== undefined) this.options.minConfidence = partial.minConfidence;

    if (this.poseLandmarker) {
      await this.poseLandmarker.setOptions({
        numPoses: this.options.maxPeople,
        minPoseDetectionConfidence: this.options.minConfidence,
        minPosePresenceConfidence: this.options.minConfidence,
        minTrackingConfidence: this.options.minConfidence,
      });
    }
  }

  /** Whether the WASM model is initialized and ready for inference. */
  get isReady(): boolean {
    return Boolean(this.poseLandmarker);
  }

  /** Active WASM execution delegate (`'GPU'` or `'CPU'`). */
  get delegate(): 'GPU' | 'CPU' {
    return this.activeDelegate;
  }

  /** Whether canvas overlay rendering is currently enabled. */
  get overlayEnabled(): boolean {
    return this.renderOptions.enabled;
  }

  /**
   * Enable, disable, or configure canvas overlay rendering at runtime.
   * Pass a boolean (`peosture.setOverlay(false)`) or partial `RenderOptions`
   * (`peosture.setOverlay({ showBadges: false, mirrored: true })`).
   */
  setOverlay(enabledOrOptions: boolean | Partial<RenderOptions>): void {
    if (typeof enabledOrOptions === 'boolean') {
      this.renderOptions.enabled = enabledOrOptions;
    } else {
      this.renderOptions = { ...this.renderOptions, ...enabledOrOptions };
    }

    if (
      this.activeCanvas &&
      (!this.renderOptions.enabled ||
        (!this.renderOptions.showBadges && !this.renderOptions.showSkeleton))
    ) {
      const ctx = this.activeCanvas.getContext('2d');
      ctx?.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
    }
  }

  /**
   * Detect people and classify postures on a single video/image/canvas frame.
   */
  detect(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    timestampMs: number = performance.now()
  ): DetectionResult {
    if (!this.poseLandmarker) {
      throw new Error('Peosture is not initialized. Call `await peosture.init()` first.');
    }

    // MediaPipe VIDEO mode requires strictly monotonically increasing timestamps
    const safeTimestamp = Math.max(this.lastTimestampMs + 1, Math.floor(timestampMs));
    this.lastTimestampMs = safeTimestamp;

    const raw = this.poseLandmarker.detectForVideo(source, safeTimestamp);
    return this.analyze(raw.landmarks || [], raw.worldLandmarks || [], safeTimestamp);
  }

  /**
   * Classify an array of 33-keypoint pose landmarks (from MediaPipe or custom sources).
   */
  analyze(
    landmarksList: Landmark[][],
    worldLandmarksList: Landmark[][] = [],
    timestampMs: number = performance.now()
  ): DetectionResult {
    this.tickFps(timestampMs);

    const byPosture: Record<Posture, number> = {
      standing: 0,
      sitting: 0,
      slouching: 0,
      lying: 0,
      arms_raised: 0,
      upper_body: 0,
    };

    const labelCounts: Record<string, number> = {};
    const people: DetectedPerson[] = [];

    for (let i = 0; i < landmarksList.length; i++) {
      const landmarks = landmarksList[i];
      const worldLandmarks = worldLandmarksList[i] ?? null;
      const analysis = analyzePosture(landmarks, worldLandmarks);

      byPosture[analysis.posture] = (byPosture[analysis.posture] || 0) + 1;
      labelCounts[analysis.label] = (labelCounts[analysis.label] || 0) + 1;

      people.push({
        id: i + 1,
        landmarks,
        worldLandmarks,
        ...analysis,
      });
    }

    const summary =
      people.length === 0
        ? 'No people detected'
        : Object.entries(labelCounts)
            .map(([label, count]) => `${count} ${label}`)
            .join(' · ');

    return {
      count: people.length,
      people,
      byPosture,
      summary,
      timestampMs,
      fps: this.currentFps,
    };
  }

  /**
   * Open webcam stream, attach to `videoElement`, and begin continuous detection.
   */
  async startWebcam(
    videoElement: HTMLVideoElement,
    options: LoopOptions = {}
  ): Promise<MediaStream> {
    if (!this.poseLandmarker) {
      await this.init();
    }

    this.stop();

    const constraints: MediaStreamConstraints = {
      video: options.videoConstraints ?? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = this.mediaStream;
    await videoElement.play();

    this.startLoop(videoElement, options);
    return this.mediaStream;
  }

  /**
   * Run continuous `requestAnimationFrame` detection on a playing `<video>` element.
   */
  startLoop(videoElement: HTMLVideoElement, options: LoopOptions = {}): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.activeCanvas = options.canvas ?? null;
    this.renderOptions = {
      enabled: options.enabled ?? this.renderOptions.enabled,
      mirrored: options.mirrored ?? this.renderOptions.mirrored,
      showBadges: options.showBadges ?? this.renderOptions.showBadges,
      showSkeleton: options.showSkeleton ?? this.renderOptions.showSkeleton,
      clearCanvas: options.clearCanvas ?? this.renderOptions.clearCanvas,
    };

    this.runningLoop = true;
    this.lastVideoTime = -1;

    const tick = () => {
      if (!this.runningLoop) return;

      if (videoElement.readyState >= 2 && this.poseLandmarker) {
        const canvas = this.activeCanvas;
        if (
          canvas &&
          (canvas.width !== videoElement.videoWidth ||
            canvas.height !== videoElement.videoHeight)
        ) {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
        }

        const nowMs = performance.now();
        if (videoElement.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = videoElement.currentTime;
          const result = this.detect(videoElement, nowMs);

          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawOverlay(ctx, result.people, this.renderOptions);
          }

          options.onFrame?.(result);
        }
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Stop the active detection loop and release any webcam stream.
   */
  stop(): void {
    this.runningLoop = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.activeCanvas) {
      const ctx = this.activeCanvas.getContext('2d');
      ctx?.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
    }
    this.frameCount = 0;
    this.lastFpsTime = 0;
    this.currentFps = 0;
  }

  /**
   * Stop detection and free WASM resources.
   */
  dispose(): void {
    this.stop();
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
  }

  private tickFps(nowMs: number): void {
    if (this.lastFpsTime === 0) this.lastFpsTime = nowMs;
    this.frameCount++;
    const elapsed = nowMs - this.lastFpsTime;
    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = nowMs;
    }
  }
}
