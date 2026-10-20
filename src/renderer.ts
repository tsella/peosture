import type { DetectedPerson, Landmark, Posture, RenderOptions } from './types.js';

/**
 * Standard 33-landmark MediaPipe Pose skeleton connections.
 */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12],
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

export const PERSON_PALETTES = [
  { main: '#38bdf8', joint: '#0284c7' },
  { main: '#a855f7', joint: '#7e22ce' },
  { main: '#22c55e', joint: '#15803d' },
  { main: '#f59e0b', joint: '#b45309' },
  { main: '#ec4899', joint: '#be185d' },
  { main: '#14b8a6', joint: '#0f766e' },
] as const;

export const POSTURE_COLORS: Record<Posture, string> = {
  standing: '#10b981',
  upper_body: '#10b981',
  sitting: '#3b82f6',
  arms_raised: '#8b5cf6',
  slouching: '#f59e0b',
  lying: '#ef4444',
};

/**
 * Render detected people (skeletons + posture badges) onto a 2D canvas context.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  people: DetectedPerson[],
  options: RenderOptions = {}
): void {
  const {
    enabled = true,
    mirrored = false,
    showBadges = true,
    showSkeleton = true,
    clearCanvas = true,
  } = options;

  const { width, height } = ctx.canvas;
  ctx.save();

  if (clearCanvas) {
    ctx.clearRect(0, 0, width, height);
  }

  if (!enabled) {
    ctx.restore();
    return;
  }

  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const palette = PERSON_PALETTES[i % PERSON_PALETTES.length];

    if (showSkeleton) {
      drawSkeleton(ctx, person.landmarks, palette.main, palette.joint, width, height);
    }

    if (showBadges) {
      drawBadge(ctx, person, palette.main, mirrored, width, height);
    }
  }

  ctx.restore();
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  lineColor: string,
  jointColor: string,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
    const a = landmarks[startIdx];
    const b = landmarks[endIdx];
    if (!a || !b || (a.visibility ?? 1) < 0.35 || (b.visibility ?? 1) < 0.35) continue;

    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  for (const lm of landmarks) {
    if (!lm || (lm.visibility ?? 1) < 0.35) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = jointColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  person: DetectedPerson,
  accentColor: string,
  mirrored: boolean,
  width: number,
  height: number
): void {
  const x = person.anchor.x * width;
  const y = person.anchor.y * height;

  const title = `P${person.id}: ${person.label}`;
  const subLabel = `Spine ${person.metrics.torsoTiltDeg}° · Neck ${person.metrics.neckTiltDeg}°`;
  const statusColor = POSTURE_COLORS[person.posture] || accentColor;

  ctx.save();
  ctx.translate(x, y);
  if (mirrored) ctx.scale(-1, 1);

  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  const titleWidth = ctx.measureText(title).width;
  ctx.font = '500 11px system-ui, -apple-system, sans-serif';
  const subWidth = ctx.measureText(subLabel).width;

  const boxWidth = Math.max(titleWidth + 14, subWidth) + 24;
  const boxHeight = 44;
  const rx = -boxWidth / 2;
  const ry = -boxHeight;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(rx, ry, boxWidth, boxHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(rx + 12, ry + 16, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, rx + 21, ry + 20);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(subLabel, rx + 12, ry + 36);

  ctx.restore();
}
