import {
  Peosture,
  drawOverlay,
  PERSON_PALETTES,
  POSTURE_COLORS,
} from './dist/index.js';

// DOM Elements
const videoEl = document.getElementById('webcam');
const canvasEl = document.getElementById('overlay');
const ctx = canvasEl.getContext('2d');
const statusBadgeEl = document.getElementById('model-status');
const fpsBadgeEl = document.getElementById('fps-counter');
const peopleCountEl = document.getElementById('people-count');
const postureSummaryEl = document.getElementById('posture-summary');
const peopleListEl = document.getElementById('people-list');
const cameraBtn = document.getElementById('toggle-camera-btn');
const demoBtn = document.getElementById('toggle-demo-btn');
const overlayCheckbox = document.getElementById('overlay-toggle');
const mirrorCheckbox = document.getElementById('mirror-toggle');
const modelSelect = document.getElementById('model-select');
const maxPosesSlider = document.getElementById('max-poses-slider');
const maxPosesLabel = document.getElementById('max-poses-value');
const cameraOverlayPrompt = document.getElementById('camera-prompt');

// Instantiate Peosture
const peosture = new Peosture({
  model: modelSelect.value,
  maxPeople: parseInt(maxPosesSlider.value, 10),
});

let webcamRunning = false;
let demoRunning = false;
let demoAnimId = null;

function setStatus(text, state) {
  statusBadgeEl.textContent = text;
  statusBadgeEl.dataset.state = state;
}

async function bootModel() {
  const model = modelSelect.value;
  const maxPeople = parseInt(maxPosesSlider.value, 10);
  setStatus('Loading WASM & Model…', 'loading');

  try {
    const info = await peosture.init({ model, maxPeople });
    setStatus(`WASM Ready (${String(info.model).toUpperCase()} · ${info.delegate})`, 'ready');
    cameraBtn.disabled = false;
    demoBtn.disabled = false;
  } catch (err) {
    console.error('Failed to initialize Peosture:', err);
    setStatus('Model Load Error', 'error');
  }
}

async function toggleCamera() {
  if (demoRunning) stopDemo();

  if (webcamRunning) {
    stopCamera();
    return;
  }

  try {
    await peosture.startWebcam(videoEl, {
      canvas: canvasEl,
      enabled: overlayCheckbox.checked,
      mirrored: mirrorCheckbox.checked,
      onFrame: (result) => {
        fpsBadgeEl.textContent = `${result.fps} FPS`;
        renderDashboard(result);
      },
    });

    webcamRunning = true;
    cameraBtn.textContent = 'Stop Camera';
    cameraBtn.classList.add('active-danger');
    cameraOverlayPrompt.hidden = true;
  } catch (err) {
    console.error('Camera access denied or unavailable:', err);
    alert(`Could not access camera: ${err.message}\nYou can still use "Simulate Demo" to preview multi-person posture detection.`);
  }
}

function stopCamera() {
  webcamRunning = false;
  peosture.stop();
  videoEl.srcObject = null;
  cameraBtn.textContent = 'Start Camera';
  cameraBtn.classList.remove('active-danger');
  cameraOverlayPrompt.hidden = false;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  renderDashboard(null);
}

function renderDashboard(result) {
  if (!result || result.count === 0) {
    peopleCountEl.textContent = '0';
    postureSummaryEl.textContent =
      webcamRunning || demoRunning
        ? 'No people currently in frame'
        : 'Start camera or demo to detect postures';
    peopleListEl.innerHTML = `
      <div class="empty-state">
        <p>Waiting for detections…</p>
        <span>Up to ${maxPosesSlider.value} people can be tracked simultaneously in WASM.</span>
      </div>
    `;
    return;
  }

  peopleCountEl.textContent = String(result.count);
  postureSummaryEl.textContent = result.summary;

  peopleListEl.innerHTML = result.people
    .map((p, idx) => {
      const palette = PERSON_PALETTES[idx % PERSON_PALETTES.length];
      const statusColor = POSTURE_COLORS[p.posture] || palette.main;
      const hipText = p.metrics.hipAngleDeg !== null ? `${p.metrics.hipAngleDeg}°` : '—';
      const kneeText = p.metrics.kneeAngleDeg !== null ? `${p.metrics.kneeAngleDeg}°` : '—';
      const alertsHtml = p.alerts.length
        ? `<div class="person-alerts">${p.alerts.map((a) => `<span class="alert-chip">${a}</span>`).join('')}</div>`
        : '';

      return `
        <article class="person-card" style="--person-accent: ${palette.main}; --posture-color: ${statusColor}">
          <div class="person-card-header">
            <span class="person-id">
              <span class="person-dot"></span>
              Person #${p.id}
            </span>
            <span class="posture-pill">${p.label}</span>
          </div>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Torso Tilt</span>
              <span class="metric-val">${p.metrics.torsoTiltDeg}°</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Neck Tilt</span>
              <span class="metric-val">${p.metrics.neckTiltDeg}°</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Hip Angle</span>
              <span class="metric-val">${hipText}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Knee Angle</span>
              <span class="metric-val">${kneeText}</span>
            </div>
          </div>
          ${alertsHtml}
        </article>
      `;
    })
    .join('');
}

/* ============================================================================
 * Interactive Simulated Multi-Person Demo Mode (Uses peosture.analyze)
 * ========================================================================== */

function toggleDemo() {
  if (webcamRunning) stopCamera();
  if (demoRunning) {
    stopDemo();
    return;
  }

  demoRunning = true;
  demoBtn.textContent = 'Stop Demo';
  demoBtn.classList.add('active-primary');
  cameraOverlayPrompt.hidden = true;
  canvasEl.width = 960;
  canvasEl.height = 540;

  const startTime = performance.now();
  function demoTick(now) {
    if (!demoRunning) return;
    const t = (now - startTime) / 1000;
    const { landmarksList, worldLandmarksList } = generateSyntheticPoses(
      t,
      parseInt(maxPosesSlider.value, 10)
    );

    const result = peosture.analyze(landmarksList, worldLandmarksList, now);
    drawSimulatedBackground(ctx, canvasEl.width, canvasEl.height);
    drawOverlay(ctx, result.people, {
      enabled: overlayCheckbox.checked,
      mirrored: mirrorCheckbox.checked,
      clearCanvas: false,
    });

    fpsBadgeEl.textContent = `${result.fps} FPS`;
    renderDashboard(result);
    demoAnimId = requestAnimationFrame(demoTick);
  }

  demoAnimId = requestAnimationFrame(demoTick);
}

function stopDemo() {
  demoRunning = false;
  if (demoAnimId) cancelAnimationFrame(demoAnimId);
  demoBtn.textContent = 'Simulate Demo (3 People)';
  demoBtn.classList.remove('active-primary');
  cameraOverlayPrompt.hidden = false;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  renderDashboard(null);
}

function drawSimulatedBackground(context, w, h) {
  const grad = context.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e293b');
  context.fillStyle = grad;
  context.fillRect(0, 0, w, h);

  context.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, h * 0.85);
  context.lineTo(w, h * 0.85);
  context.stroke();
}

function generateSyntheticPoses(t, maxPoses) {
  const basePose = (cx, cy) =>
    Array.from({ length: 33 }, () => ({ x: cx, y: cy, z: 0, visibility: 0.95 }));

  const p1 = basePose(0.22, 0.5);
  const wave = Math.sin(t * 2.2);
  setFullBodyPose(p1, {
    cx: 0.22,
    headY: 0.24,
    shoulderY: 0.34,
    hipY: 0.56,
    kneeY: 0.71,
    ankleY: 0.84,
    leanX: 0.0,
    rightWristY: wave > 0 ? 0.21 - wave * 0.05 : 0.48,
    rightElbowY: wave > 0 ? 0.29 : 0.43,
  });

  const p2 = basePose(0.52, 0.55);
  setFullBodyPose(p2, {
    cx: 0.52,
    headY: 0.32,
    shoulderY: 0.42,
    hipY: 0.62,
    kneeY: 0.66,
    ankleY: 0.83,
    kneeSpread: 0.06,
    leanX: 0.01 * Math.sin(t),
  });

  const p3 = basePose(0.80, 0.5);
  const slouchAmount = 0.095 + 0.02 * Math.sin(t * 1.4);
  setFullBodyPose(p3, {
    cx: 0.80,
    headY: 0.31 + slouchAmount * 0.35,
    shoulderY: 0.36,
    hipY: 0.57,
    kneeY: 0.72,
    ankleY: 0.84,
    leanX: -slouchAmount,
    headForwardX: -slouchAmount * 1.55,
  });

  const all = [p1, p2, p3].slice(0, Math.min(3, maxPoses));
  return { landmarksList: all, worldLandmarksList: all };
}

function setFullBodyPose(lm, cfg) {
  const {
    cx,
    headY,
    shoulderY,
    hipY,
    kneeY,
    ankleY,
    leanX = 0,
    headForwardX = leanX,
    kneeSpread = 0.04,
    rightWristY = shoulderY + 0.16,
    rightElbowY = shoulderY + 0.09,
  } = cfg;

  lm[0] = { x: cx + headForwardX, y: headY, z: 0, visibility: 0.98 };
  for (let i = 1; i <= 10; i++) {
    lm[i] = { x: cx + headForwardX + (i % 2 ? -0.015 : 0.015), y: headY - 0.01, z: 0, visibility: 0.95 };
  }

  lm[11] = { x: cx + leanX + 0.055, y: shoulderY, z: 0, visibility: 0.98 };
  lm[12] = { x: cx + leanX - 0.055, y: shoulderY, z: 0, visibility: 0.98 };

  lm[13] = { x: cx + leanX + 0.075, y: shoulderY + 0.09, z: 0, visibility: 0.95 };
  lm[14] = { x: cx + leanX - 0.08, y: rightElbowY, z: 0, visibility: 0.95 };
  lm[15] = { x: cx + leanX + 0.07, y: shoulderY + 0.17, z: 0, visibility: 0.95 };
  lm[16] = { x: cx + leanX - 0.09, y: rightWristY, z: 0, visibility: 0.95 };

  for (let i = 17; i <= 22; i++) {
    lm[i] = i % 2 === 1 ? { ...lm[15] } : { ...lm[16] };
  }

  lm[23] = { x: cx + 0.04, y: hipY, z: 0, visibility: 0.98 };
  lm[24] = { x: cx - 0.04, y: hipY, z: 0, visibility: 0.98 };

  lm[25] = { x: cx + kneeSpread, y: kneeY, z: 0, visibility: 0.95 };
  lm[26] = { x: cx - kneeSpread, y: kneeY, z: 0, visibility: 0.95 };

  lm[27] = { x: cx + 0.04, y: ankleY, z: 0, visibility: 0.92 };
  lm[28] = { x: cx - 0.04, y: ankleY, z: 0, visibility: 0.92 };
  for (let i = 29; i <= 32; i++) {
    lm[i] = i % 2 === 1 ? { ...lm[27] } : { ...lm[28] };
  }
}

/* ============================================================================
 * Event Listeners & Startup
 * ========================================================================== */

cameraBtn.addEventListener('click', toggleCamera);
demoBtn.addEventListener('click', toggleDemo);

overlayCheckbox.addEventListener('change', () => {
  peosture.setOverlay(overlayCheckbox.checked);
});

mirrorCheckbox.addEventListener('change', () => {
  const mirrored = mirrorCheckbox.checked;
  videoEl.classList.toggle('mirrored', mirrored);
  canvasEl.classList.toggle('mirrored', mirrored);
  peosture.setOverlay({ mirrored });
});

modelSelect.addEventListener('change', async () => {
  const wasWebcamRunning = webcamRunning;
  if (wasWebcamRunning) stopCamera();
  await bootModel();
  if (wasWebcamRunning) toggleCamera();
});

maxPosesSlider.addEventListener('input', () => {
  maxPosesLabel.textContent = maxPosesSlider.value;
});

maxPosesSlider.addEventListener('change', () => {
  peosture.setOptions({ maxPeople: parseInt(maxPosesSlider.value, 10) });
});

bootModel();
