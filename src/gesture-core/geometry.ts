import type { HandLandmark } from './types';

export const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

export function metricLandmarks(points: HandLandmark[], aspect = 1): HandLandmark[] {
  return points.map((point) => ({
    x: point.x * aspect,
    y: point.y,
    z: (point.z ?? 0) * aspect,
  }));
}

export function distance(a: HandLandmark, b: HandLandmark) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function angleDegrees(a: HandLandmark, center: HandLandmark, b: HandLandmark) {
  const v1 = {
    x: a.x - center.x,
    y: a.y - center.y,
    z: (a.z ?? 0) - (center.z ?? 0),
  };
  const v2 = {
    x: b.x - center.x,
    y: b.y - center.y,
    z: (b.z ?? 0) - (center.z ?? 0),
  };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const length1 = Math.hypot(v1.x, v1.y, v1.z);
  const length2 = Math.hypot(v2.x, v2.y, v2.z);
  if (length1 < 1e-8 || length2 < 1e-8) return 0;
  const cosine = clamp(dot / (length1 * length2), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function palmSize(points: HandLandmark[]) {
  return Math.max(1e-5, (distance(points[0], points[9]) + distance(points[5], points[17])) / 2);
}

export function estimateLandmarkQuality(
  points: HandLandmark[],
  lightScore: number,
  aspect = 1,
) {
  if (points.length !== 21) return 0;
  const metric = metricLandmarks(points, aspect);
  const size = palmSize(metric);

  // Full score for a palm occupying roughly 12%–45% of the image height.
  const tooSmallPenalty = clamp((size - 0.045) / 0.09);
  const tooLargePenalty = clamp((0.68 - size) / 0.18);
  const sizeScore = tooSmallPenalty * tooLargePenalty;

  const edgeDistance = Math.min(
    ...points.map((point) => Math.min(point.x, 1 - point.x, point.y, 1 - point.y)),
  );
  const edgeScore = clamp((edgeDistance + 0.015) / 0.1);
  const completeScore = points.filter(
    (point) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z ?? 0) &&
      point.x >= -0.08 &&
      point.x <= 1.08 &&
      point.y >= -0.08 &&
      point.y <= 1.08,
  ).length / 21;

  return clamp(0.42 * sizeScore + 0.28 * clamp(lightScore) + 0.2 * edgeScore + 0.1 * completeScore);
}

