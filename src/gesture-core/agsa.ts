import { angleDegrees, distance, metricLandmarks, palmSize, clamp } from './geometry';
import type {
  AGSAConfig,
  FingerStates,
  GestureAction,
  GestureClassification,
  GestureDecision,
  HandLandmark,
} from './types';

const DEFAULT_CONFIG: AGSAConfig = {
  windowMs: 360,
  minimumScore: 0.7,
  minimumMargin: 0.14,
  baseHoldMs: 300,
  adaptiveHoldRangeMs: 230,
  releaseMs: 160,
  minimumIntervalMs: 260,
  minimumQuality: 0.42,
};

export class FingerClassifier {
  private previous: FingerStates = {
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  };

  private isFingerExtended(
    points: HandLandmark[],
    name: Exclude<keyof FingerStates, 'thumb'>,
    baseIndex: number,
    middleIndex: number,
    tipIndex: number,
    scale: number,
  ) {
    const angle = angleDegrees(points[baseIndex], points[middleIndex], points[tipIndex]);
    const extension =
      (distance(points[tipIndex], points[0]) - distance(points[middleIndex], points[0])) /
      scale;
    const wasExtended = this.previous[name];
    const extended = angle >= (wasExtended ? 145 : 158) && extension >= (wasExtended ? 0.035 : 0.09);
    this.previous[name] = extended;
    return extended;
  }

  private isThumbExtended(points: HandLandmark[], scale: number) {
    const angle = angleDegrees(points[2], points[3], points[4]);
    const separation = distance(points[4], points[5]) / scale;
    const wasExtended = this.previous.thumb;
    const extended = angle >= (wasExtended ? 135 : 148) && separation >= (wasExtended ? 0.42 : 0.56);
    this.previous.thumb = extended;
    return extended;
  }

  classify(points: HandLandmark[], aspect = 1): GestureClassification {
    if (points.length !== 21) {
      return { gesture: 'UNKNOWN', pattern: '-----', fingers: { ...this.previous } };
    }
    const metric = metricLandmarks(points, aspect);
    const scale = palmSize(metric);
    const fingers: FingerStates = {
      thumb: this.isThumbExtended(metric, scale),
      index: this.isFingerExtended(metric, 'index', 5, 6, 8, scale),
      middle: this.isFingerExtended(metric, 'middle', 9, 10, 12, scale),
      ring: this.isFingerExtended(metric, 'ring', 13, 14, 16, scale),
      pinky: this.isFingerExtended(metric, 'pinky', 17, 18, 20, scale),
    };
    const pattern = [fingers.thumb, fingers.index, fingers.middle, fingers.ring, fingers.pinky]
      .map((value) => (value ? '1' : '0'))
      .join('');
    const mapping: Record<string, GestureAction> = {
      '00000': 'CONFIRM',
      '01000': 'SELECT_A',
      '01100': 'SELECT_B',
      '01110': 'SELECT_C',
      '11100': 'SELECT_C',
      '01111': 'SELECT_D',
      '11110': 'SELECT_D',
      '11111': 'CANCEL',
    };
    return { gesture: mapping[pattern] ?? 'UNKNOWN', pattern, fingers };
  }

  reset() {
    this.previous = { thumb: false, index: false, middle: false, ring: false, pinky: false };
  }
}

interface VoteSample {
  gesture: GestureAction;
  quality: number;
  time: number;
}

export class AGSAStabilizer {
  private readonly config: AGSAConfig;
  private history: VoteSample[] = [];
  private candidate: GestureAction | null = null;
  private candidateStartedAt = 0;
  private lockedGesture: GestureAction | null = null;
  private releaseStartedAt: number | null = null;
  private lastEventAt = Number.NEGATIVE_INFINITY;

  constructor(config: Partial<AGSAConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private vote(now: number) {
    const totals = new Map<GestureAction, number>();
    let totalWeight = 0;
    for (const sample of this.history) {
      const age = now - sample.time;
      const weight = Math.max(0.02, sample.quality) * Math.exp(-age / this.config.windowMs);
      totals.set(sample.gesture, (totals.get(sample.gesture) ?? 0) + weight);
      totalWeight += weight;
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const first = ranked[0] ?? ['UNKNOWN', 0];
    const second = ranked[1] ?? ['UNKNOWN', 0];
    return {
      gesture: first[0] as GestureAction,
      score: totalWeight ? first[1] / totalWeight : 0,
      margin: totalWeight ? (first[1] - second[1]) / totalWeight : 0,
    };
  }

  update(rawGesture: GestureAction, quality: number, now: number): GestureDecision {
    const safeQuality = clamp(quality);
    const storedGesture = safeQuality >= this.config.minimumQuality ? rawGesture : 'UNKNOWN';
    this.history.push({ gesture: storedGesture, quality: safeQuality, time: now });
    this.history = this.history.filter((sample) => now - sample.time <= this.config.windowMs);
    const winner = this.vote(now);
    const valid =
      winner.gesture !== 'UNKNOWN' &&
      winner.score >= this.config.minimumScore &&
      winner.margin >= this.config.minimumMargin &&
      safeQuality >= this.config.minimumQuality;
    const adaptiveHoldMs =
      this.config.baseHoldMs + this.config.adaptiveHoldRangeMs * (1 - safeQuality);

    if (!valid) {
      this.candidate = null;
      this.candidateStartedAt = 0;
      if (this.lockedGesture) {
        this.releaseStartedAt ??= now;
        if (now - this.releaseStartedAt >= this.config.releaseMs) {
          this.lockedGesture = null;
          this.releaseStartedAt = null;
        }
      }
      return {
        event: null,
        dominantGesture: winner.gesture,
        score: winner.score,
        margin: winner.margin,
        holdProgress: 0,
        adaptiveHoldMs,
        state: safeQuality < this.config.minimumQuality ? 'poor-quality' : 'idle',
      };
    }

    if (this.lockedGesture === winner.gesture) {
      this.releaseStartedAt = null;
      return {
        event: null,
        dominantGesture: winner.gesture,
        score: winner.score,
        margin: winner.margin,
        holdProgress: 1,
        adaptiveHoldMs,
        state: 'locked',
      };
    }

    if (this.lockedGesture) {
      this.releaseStartedAt ??= now;
      if (now - this.releaseStartedAt < this.config.releaseMs) {
        return {
          event: null,
          dominantGesture: winner.gesture,
          score: winner.score,
          margin: winner.margin,
          holdProgress: 0,
          adaptiveHoldMs,
          state: 'locked',
        };
      }
      this.lockedGesture = null;
      this.releaseStartedAt = null;
      this.candidate = null;
    }

    if (this.candidate !== winner.gesture) {
      this.candidate = winner.gesture;
      this.candidateStartedAt = now;
      return {
        event: null,
        dominantGesture: winner.gesture,
        score: winner.score,
        margin: winner.margin,
        holdProgress: 0,
        adaptiveHoldMs,
        state: 'candidate',
      };
    }

    const holdProgress = clamp((now - this.candidateStartedAt) / adaptiveHoldMs);
    const canEmit =
      holdProgress >= 1 && now - this.lastEventAt >= this.config.minimumIntervalMs;
    if (!canEmit) {
      return {
        event: null,
        dominantGesture: winner.gesture,
        score: winner.score,
        margin: winner.margin,
        holdProgress,
        adaptiveHoldMs,
        state: 'candidate',
      };
    }

    this.lockedGesture = winner.gesture;
    this.lastEventAt = now;
    this.candidate = null;
    this.candidateStartedAt = 0;
    return {
      event: winner.gesture,
      dominantGesture: winner.gesture,
      score: winner.score,
      margin: winner.margin,
      holdProgress: 1,
      adaptiveHoldMs,
      state: 'locked',
    };
  }

  reset() {
    this.history = [];
    this.candidate = null;
    this.candidateStartedAt = 0;
    this.lockedGesture = null;
    this.releaseStartedAt = null;
    this.lastEventAt = Number.NEGATIVE_INFINITY;
  }
}

