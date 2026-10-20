import type { DetectionResult, Landmark, LoopOptions, ModelVariant, PeostureOptions, RenderOptions } from './types.js';
export declare const MODEL_PRESETS: Record<'lite' | 'full' | 'heavy', string>;
export declare class Peosture {
    private options;
    private visionFileset;
    private poseLandmarker;
    private activeDelegate;
    private mediaStream;
    private activeCanvas;
    private renderOptions;
    private animFrameId;
    private runningLoop;
    private lastVideoTime;
    private lastTimestampMs;
    private frameCount;
    private lastFpsTime;
    private currentFps;
    constructor(options?: PeostureOptions);
    static create(options?: PeostureOptions): Promise<Peosture>;
    init(overrideOptions?: Partial<PeostureOptions>): Promise<{
        delegate: 'GPU' | 'CPU';
        model: ModelVariant;
    }>;
    setOptions(partial: Partial<Pick<PeostureOptions, 'maxPeople' | 'minConfidence'>>): Promise<void>;
    get isReady(): boolean;
    get delegate(): 'GPU' | 'CPU';
    get overlayEnabled(): boolean;
    setOverlay(enabledOrOptions: boolean | Partial<RenderOptions>): void;
    detect(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap, timestampMs?: number): DetectionResult;
    analyze(landmarksList: Landmark[][], worldLandmarksList?: Landmark[][], timestampMs?: number): DetectionResult;
    startWebcam(videoElement: HTMLVideoElement, options?: LoopOptions): Promise<MediaStream>;
    startLoop(videoElement: HTMLVideoElement, options?: LoopOptions): void;
    stop(): void;
    dispose(): void;
    private tickFps;
}
