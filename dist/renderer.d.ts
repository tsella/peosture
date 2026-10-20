import type { DetectedPerson, Posture, RenderOptions } from './types.js';
export declare const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]>;
export declare const PERSON_PALETTES: readonly [{
    readonly main: "#38bdf8";
    readonly joint: "#0284c7";
}, {
    readonly main: "#a855f7";
    readonly joint: "#7e22ce";
}, {
    readonly main: "#22c55e";
    readonly joint: "#15803d";
}, {
    readonly main: "#f59e0b";
    readonly joint: "#b45309";
}, {
    readonly main: "#ec4899";
    readonly joint: "#be185d";
}, {
    readonly main: "#14b8a6";
    readonly joint: "#0f766e";
}];
export declare const POSTURE_COLORS: Record<Posture, string>;
export declare function drawOverlay(ctx: CanvasRenderingContext2D, people: DetectedPerson[], options?: RenderOptions): void;
