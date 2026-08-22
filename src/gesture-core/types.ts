export interface HandLandmark {
  x: number;
  y: number;
  z?: number;
}

export type GestureAction =
  | 'SELECT_A'
  | 'SELECT_B'
  | 'SELECT_C'
  | 'SELECT_D'
  | 'CONFIRM'
  | 'CANCEL'
  | 'UNKNOWN';

export type EngineState = 'idle' | 'candidate' | 'locked' | 'poor-quality';

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export interface GestureClassification {
  gesture: GestureAction;
  pattern: string;
  fingers: FingerStates;
}

export interface GestureDecision {
  event: GestureAction | null;
  dominantGesture: GestureAction;
  score: number;
  margin: number;
  holdProgress: number;
  adaptiveHoldMs: number;
  state: EngineState;
}

export interface AGSAConfig {
  windowMs: number;
  minimumScore: number;
  minimumMargin: number;
  baseHoldMs: number;
  adaptiveHoldRangeMs: number;
  releaseMs: number;
  minimumIntervalMs: number;
  minimumQuality: number;
}

