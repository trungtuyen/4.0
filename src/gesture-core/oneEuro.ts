import type { HandLandmark } from './types';

const smoothingFactor = (cutoff: number, deltaSeconds: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / Math.max(deltaSeconds, 1 / 120));
};

class OneEuroScalar {
  private previousRaw: number | null = null;
  private previousFiltered: number | null = null;
  private previousDerivative = 0;
  private previousTime: number | null = null;

  constructor(
    private readonly minimumCutoff = 1.2,
    private readonly beta = 0.8,
    private readonly derivativeCutoff = 1,
  ) {}

  filter(value: number, nowMs: number) {
    if (this.previousRaw === null || this.previousFiltered === null || this.previousTime === null) {
      this.previousRaw = value;
      this.previousFiltered = value;
      this.previousTime = nowMs;
      return value;
    }

    const deltaSeconds = Math.min(0.1, Math.max(1 / 120, (nowMs - this.previousTime) / 1000));
    const rawDerivative = (value - this.previousRaw) / deltaSeconds;
    const derivativeAlpha = smoothingFactor(this.derivativeCutoff, deltaSeconds);
    const derivative =
      derivativeAlpha * rawDerivative + (1 - derivativeAlpha) * this.previousDerivative;
    const cutoff = this.minimumCutoff + this.beta * Math.abs(derivative);
    const alpha = smoothingFactor(cutoff, deltaSeconds);
    const filtered = alpha * value + (1 - alpha) * this.previousFiltered;

    this.previousRaw = value;
    this.previousFiltered = filtered;
    this.previousDerivative = derivative;
    this.previousTime = nowMs;
    return filtered;
  }

  reset() {
    this.previousRaw = null;
    this.previousFiltered = null;
    this.previousDerivative = 0;
    this.previousTime = null;
  }
}

export class LandmarkSmoother {
  private filters = Array.from({ length: 21 }, () => ({
    x: new OneEuroScalar(),
    y: new OneEuroScalar(),
    z: new OneEuroScalar(),
  }));

  filter(points: HandLandmark[], nowMs: number): HandLandmark[] {
    if (points.length !== 21) return points;
    return points.map((point, index) => ({
      x: this.filters[index].x.filter(point.x, nowMs),
      y: this.filters[index].y.filter(point.y, nowMs),
      z: this.filters[index].z.filter(point.z ?? 0, nowMs),
    }));
  }

  reset() {
    for (const axis of this.filters) {
      axis.x.reset();
      axis.y.reset();
      axis.z.reset();
    }
  }
}

