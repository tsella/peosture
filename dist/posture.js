export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

function isVisible(lm, threshold = 0.45) {
  return Boolean(lm && (lm.visibility === undefined || lm.visibility >= threshold));
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

export function angleBetweenPoints(a, b, c, use3D = false) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = use3D ? (a.z || 0) - (b.z || 0) : 0;

  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = use3D ? (c.z || 0) - (b.z || 0) : 0;

  const dot = abx * cbx + aby * cby + abz * cbz;
  const magAB = Math.hypot(abx, aby, abz);
  const magCB = Math.hypot(cbx, cby, cbz);
  if (magAB === 0 || magCB === 0) return 180;

  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function angleFromVertical(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return 0;
  const cos = Math.max(-1, Math.min(1, -dy / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function analyzePosture(landmarks, worldLandmarks = null) {
  if (
    !landmarks ||
    landmarks.length < 29 ||
    !landmarks[LANDMARK_INDEX.NOSE] ||
    !landmarks[LANDMARK_INDEX.LEFT_SHOULDER] ||
    !landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] ||
    !landmarks[LANDMARK_INDEX.LEFT_HIP] ||
    !landmarks[LANDMARK_INDEX.RIGHT_HIP]
  ) {
    return {
      posture: 'upper_body',
      label: 'Unknown',
      confidence: 0,
      alerts: [],
      metrics: {
        torsoTiltDeg: 0,
        neckTiltDeg: 0,
        hipAngleDeg: null,
        kneeAngleDeg: null,
        shoulderRollDeg: 0,
      },
      anchor: { x: 0.5, y: 0.1 },
    };
  }

  const lm = landmarks;
  const has3D = Boolean(worldLandmarks && worldLandmarks.length >= 29);
  const wlm = has3D ? worldLandmarks : landmarks;

  const nose = lm[LANDMARK_INDEX.NOSE];
  const lEar = lm[LANDMARK_INDEX.LEFT_EAR];
  const rEar = lm[LANDMARK_INDEX.RIGHT_EAR];
  const lShoulder = lm[LANDMARK_INDEX.LEFT_SHOULDER];
  const rShoulder = lm[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lWrist = lm[LANDMARK_INDEX.LEFT_WRIST];
  const rWrist = lm[LANDMARK_INDEX.RIGHT_WRIST];
  const lHip = lm[LANDMARK_INDEX.LEFT_HIP];
  const rHip = lm[LANDMARK_INDEX.RIGHT_HIP];
  const lKnee = lm[LANDMARK_INDEX.LEFT_KNEE];
  const rKnee = lm[LANDMARK_INDEX.RIGHT_KNEE];
  const lAnkle = lm[LANDMARK_INDEX.LEFT_ANKLE];
  const rAnkle = lm[LANDMARK_INDEX.RIGHT_ANKLE];

  const midShoulder = midpoint(lShoulder, rShoulder);
  const midEar =
    isVisible(lEar, 0.3) && isVisible(rEar, 0.3)
      ? midpoint(lEar, rEar)
      : isVisible(lEar, 0.3)
        ? lEar
        : isVisible(rEar, 0.3)
          ? rEar
          : nose;
  const midHip = midpoint(lHip, rHip);

  const shoulderDy = Math.abs(lShoulder.y - rShoulder.y);
  const shoulderDx = Math.max(0.001, Math.abs(lShoulder.x - rShoulder.x));
  const shoulderRollDeg = Math.round((Math.atan2(shoulderDy, shoulderDx) * 180) / Math.PI);

  const neckTiltDeg = Math.round(angleFromVertical(midShoulder, midEar));
  const hipsVisible = isVisible(lHip, 0.4) || isVisible(rHip, 0.4);
  const torsoTiltDeg = hipsVisible ? Math.round(angleFromVertical(midHip, midShoulder)) : 0;

  let hipAngleDeg = null;
  let kneeAngleDeg = null;

  const leftLegVisible = isVisible(lHip, 0.4) && isVisible(lKnee, 0.4);
  const rightLegVisible = isVisible(rHip, 0.4) && isVisible(rKnee, 0.4);

  if (leftLegVisible || rightLegVisible) {
    const hipAngles = [];
    if (leftLegVisible) {
      hipAngles.push(
        angleBetweenPoints(
          wlm[LANDMARK_INDEX.LEFT_SHOULDER],
          wlm[LANDMARK_INDEX.LEFT_HIP],
          wlm[LANDMARK_INDEX.LEFT_KNEE],
          has3D
        )
      );
    }
    if (rightLegVisible) {
      hipAngles.push(
        angleBetweenPoints(
          wlm[LANDMARK_INDEX.RIGHT_SHOULDER],
          wlm[LANDMARK_INDEX.RIGHT_HIP],
          wlm[LANDMARK_INDEX.RIGHT_KNEE],
          has3D
        )
      );
    }
    hipAngleDeg = Math.round(hipAngles.reduce((a, b) => a + b, 0) / hipAngles.length);
  }

  const leftAnkleVisible = leftLegVisible && isVisible(lAnkle, 0.35);
  const rightAnkleVisible = rightLegVisible && isVisible(rAnkle, 0.35);

  if (leftAnkleVisible || rightAnkleVisible) {
    const kneeAngles = [];
    if (leftAnkleVisible) {
      kneeAngles.push(
        angleBetweenPoints(
          wlm[LANDMARK_INDEX.LEFT_HIP],
          wlm[LANDMARK_INDEX.LEFT_KNEE],
          wlm[LANDMARK_INDEX.LEFT_ANKLE],
          has3D
        )
      );
    }
    if (rightAnkleVisible) {
      kneeAngles.push(
        angleBetweenPoints(
          wlm[LANDMARK_INDEX.RIGHT_HIP],
          wlm[LANDMARK_INDEX.RIGHT_KNEE],
          wlm[LANDMARK_INDEX.RIGHT_ANKLE],
          has3D
        )
      );
    }
    kneeAngleDeg = Math.round(kneeAngles.reduce((a, b) => a + b, 0) / kneeAngles.length);
  }

  const leftArmRaised = isVisible(lWrist, 0.4) && lWrist.y < lShoulder.y - 0.08;
  const rightArmRaised = isVisible(rWrist, 0.4) && rWrist.y < rShoulder.y - 0.08;
  const anyArmRaised = leftArmRaised || rightArmRaised;

  const shoulderWidth = Math.hypot(lShoulder.x - rShoulder.x, lShoulder.y - rShoulder.y);
  const neckHeight = midShoulder.y - nose.y;
  const neckToShoulderRatio = shoulderWidth > 0.01 ? neckHeight / shoulderWidth : 0.5;

  const worldHeadForwardZ = has3D
    ? (wlm[LANDMARK_INDEX.NOSE].z || 0) -
      (wlm[LANDMARK_INDEX.LEFT_SHOULDER].z + wlm[LANDMARK_INDEX.RIGHT_SHOULDER].z) / 2
    : 0;

  const alerts = [];
  if (shoulderRollDeg > 14) alerts.push('Uneven shoulders');
  if (neckTiltDeg > 26 || neckToShoulderRatio < 0.28) alerts.push('Forward head tilt');
  if (hipsVisible && torsoTiltDeg > 20 && torsoTiltDeg <= 55) alerts.push('Leaning torso');
  if (anyArmRaised) alerts.push(leftArmRaised && rightArmRaised ? 'Both hands raised' : 'Hand raised');

  let posture = 'upper_body';
  let label = 'Good Posture (Desk)';

  if (hipsVisible && torsoTiltDeg > 55) {
    posture = 'lying';
    label = 'Lying Down';
  } else if (
    (hipsVisible && torsoTiltDeg > 22) ||
    neckTiltDeg > 28 ||
    (shoulderWidth > 0.08 && neckToShoulderRatio < 0.27) ||
    worldHeadForwardZ < -0.16
  ) {
    posture = 'slouching';
    label = 'Slouching / Leaning';
  } else if (leftLegVisible || rightLegVisible) {
    const torsoHeight = Math.abs(midHip.y - midShoulder.y);
    const avgKneeY =
      leftLegVisible && rightLegVisible
        ? (lKnee.y + rKnee.y) / 2
        : leftLegVisible
          ? lKnee.y
          : rKnee.y;
    const thighToTorsoRatio =
      torsoHeight > 0.01 ? (avgKneeY - midHip.y) / torsoHeight : 1;

    const isSeated =
      (hipAngleDeg !== null && hipAngleDeg < 135) ||
      (kneeAngleDeg !== null && kneeAngleDeg < 135) ||
      thighToTorsoRatio < 0.55;

    if (isSeated) {
      posture = 'sitting';
      label = anyArmRaised ? 'Sitting (Hand Raised)' : 'Sitting';
    } else {
      posture = 'standing';
      label = anyArmRaised ? 'Standing (Hand Raised)' : 'Standing';
    }
  } else if (anyArmRaised) {
    posture = 'arms_raised';
    label = leftArmRaised && rightArmRaised ? 'Both Hands Raised' : 'Hand Raised';
  }

  const coreJoints = hipsVisible
    ? [nose, lShoulder, rShoulder, lHip, rHip]
    : [nose, lShoulder, rShoulder];
  const visScores = coreJoints.map((p) => p?.visibility ?? 0.8);
  const confidence = Math.round(
    (visScores.reduce((a, b) => a + b, 0) / visScores.length) * 100
  );

  const topY = Math.min(nose.y, lShoulder.y, rShoulder.y);

  return {
    posture,
    label,
    confidence,
    alerts,
    metrics: {
      torsoTiltDeg,
      neckTiltDeg,
      hipAngleDeg,
      kneeAngleDeg,
      shoulderRollDeg,
    },
    anchor: {
      x: Math.max(0.05, Math.min(0.95, nose.x)),
      y: Math.max(0.06, topY - 0.08),
    },
  };
}
