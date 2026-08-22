import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FlaskConical,
  Hand,
  Maximize2,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import * as XLSX from 'xlsx';
import { AGSAStabilizer, FingerClassifier } from '../gesture-core/agsa';
import { estimateLandmarkQuality } from '../gesture-core/geometry';
import { LandmarkSmoother } from '../gesture-core/oneEuro';
import type {
  EngineState,
  FingerStates,
  GestureAction,
  HandLandmark,
} from '../gesture-core/types';

interface GestureCoreEduProps {
  onBack: () => void;
}

type GameMode = 'quiz' | 'cards' | 'picker' | 'research';

interface QuizQuestion {
  id: string;
  text: string;
  answers: [string, string, string, string];
  correctIndex: number;
}

interface StudyCard {
  id: string;
  front: string;
  back: string;
}

interface Telemetry {
  rawGesture: GestureAction;
  stableGesture: GestureAction;
  pattern: string;
  fingers: FingerStates;
  quality: number;
  score: number;
  margin: number;
  holdProgress: number;
  adaptiveHoldMs: number;
  state: EngineState;
  fps: number;
  inferenceMs: number;
  handedness: string;
  lightScore: number;
}

interface EventLog {
  id: string;
  action: GestureAction;
  source: 'camera' | 'manual';
  score: number;
  quality: number;
  time: string;
}

const DEFAULT_FINGERS: FingerStates = {
  thumb: false,
  index: false,
  middle: false,
  ring: false,
  pinky: false,
};

const DEFAULT_TELEMETRY: Telemetry = {
  rawGesture: 'UNKNOWN',
  stableGesture: 'UNKNOWN',
  pattern: '-----',
  fingers: DEFAULT_FINGERS,
  quality: 0,
  score: 0,
  margin: 0,
  holdProgress: 0,
  adaptiveHoldMs: 300,
  state: 'idle',
  fps: 0,
  inferenceMs: 0,
  handedness: '—',
  lightScore: 0,
};

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    text: '25% của 80 bằng bao nhiêu?',
    answers: ['10', '20', '25', '30'],
    correctIndex: 1,
  },
  {
    id: 'q2',
    text: 'Thiết bị nào dùng để nhập hình ảnh vào máy tính?',
    answers: ['Máy in', 'Camera', 'Loa', 'Máy chiếu'],
    correctIndex: 1,
  },
  {
    id: 'q3',
    text: 'Cử chỉ nào dùng để xác nhận trong GestureCore Edu?',
    answers: ['Xòe tay', 'Vẫy tay', 'Nắm tay', 'Hạ tay'],
    correctIndex: 2,
  },
  {
    id: 'q4',
    text: 'Thuật toán AGSA sử dụng chuỗi khung hình để làm gì?',
    answers: ['Tăng âm lượng', 'Ổn định cử chỉ', 'Đổi màu camera', 'Lưu khuôn mặt'],
    correctIndex: 1,
  },
];

const DEFAULT_CARDS: StudyCard[] = [
  { id: 'c1', front: 'Thuật toán là gì?', back: 'Một dãy hữu hạn các bước để giải quyết một bài toán.' },
  { id: 'c2', front: 'AGSA là viết tắt của gì?', back: 'Adaptive Gesture Stabilization Algorithm.' },
  { id: 'c3', front: 'Cử chỉ 1 ngón', back: 'Chọn đáp án A hoặc thẻ số 1.' },
  { id: 'c4', front: 'Cử chỉ nắm tay', back: 'Xác nhận lựa chọn hoặc kích hoạt hành động.' },
  { id: 'c5', front: 'Cửa sổ bỏ phiếu', back: 'Nhóm khung hình gần nhau dùng để tìm cử chỉ chiếm ưu thế.' },
  { id: 'c6', front: 'Hysteresis', back: 'Cơ chế hai ngưỡng giúp trạng thái không đổi liên tục do nhiễu.' },
  { id: 'c7', front: 'Xử lý cục bộ', back: 'Video được xử lý trên thiết bị, không cần tải lên máy chủ.' },
  { id: 'c8', front: 'One Euro Filter', back: 'Bộ lọc giảm rung khi đứng yên và giảm trễ khi chuyển động.' },
];

const DEFAULT_STUDENTS = [
  'Nguyễn An',
  'Trần Bình',
  'Hoàng Chi',
  'Lê Dũng',
  'Phạm Hà',
  'Vũ Minh',
  'Đỗ Nam',
  'Bùi Phương',
];

const ACTION_LABELS: Record<GestureAction, string> = {
  SELECT_A: '1 ngón · A',
  SELECT_B: '2 ngón · B',
  SELECT_C: '3 ngón · C',
  SELECT_D: '4 ngón · D',
  CONFIRM: 'Nắm tay · Xác nhận',
  CANCEL: 'Xòe tay · Hủy',
  UNKNOWN: 'Chưa xác định',
};

const ACTION_COLORS: Record<GestureAction, string> = {
  SELECT_A: 'bg-cyan-500',
  SELECT_B: 'bg-blue-500',
  SELECT_C: 'bg-violet-500',
  SELECT_D: 'bg-fuchsia-500',
  CONFIRM: 'bg-emerald-500',
  CANCEL: 'bg-amber-500',
  UNKNOWN: 'bg-slate-500',
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function secureRandomIndex(length: number) {
  if (length <= 1) return 0;
  const maximum = Math.floor(0x100000000 / length) * length;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= maximum);
  return buffer[0] % length;
}

function drawHand(canvas: HTMLCanvasElement, points: HandLandmark[]) {
  const context = canvas.getContext('2d');
  if (!context || points.length !== 21) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = 'rgba(34, 211, 238, 0.9)';
  context.lineWidth = Math.max(2, canvas.width / 240);
  for (const [from, to] of HAND_CONNECTIONS) {
    context.beginPath();
    context.moveTo(points[from].x * canvas.width, points[from].y * canvas.height);
    context.lineTo(points[to].x * canvas.width, points[to].y * canvas.height);
    context.stroke();
  }
  points.forEach((point, index) => {
    context.beginPath();
    context.arc(
      point.x * canvas.width,
      point.y * canvas.height,
      index === 0 ? 6 : 4,
      0,
      Math.PI * 2,
    );
    context.fillStyle = [4, 8, 12, 16, 20].includes(index) ? '#fbbf24' : '#ffffff';
    context.fill();
  });
}

export default function GestureCoreEdu({ onBack }: GestureCoreEduProps) {
  const [mode, setMode] = useState<GameMode>('quiz');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [telemetry, setTelemetry] = useState<Telemetry>(DEFAULT_TELEMETRY);
  const [eventLog, setEventLog] = useState<EventLog[]>([]);

  const [questions, setQuestions] = usePersistentState('gesturecore_questions_v1', DEFAULT_QUESTIONS);
  const [cards, setCards] = usePersistentState('gesturecore_cards_v1', DEFAULT_CARDS);
  const [students, setStudents] = usePersistentState('gesturecore_students_v1', DEFAULT_STUDENTS);

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizRunning, setQuizRunning] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const [cardPage, setCardPage] = useState(0);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());

  const [studentsInput, setStudentsInput] = useState(students.join('\n'));
  const [pickerSpinning, setPickerSpinning] = useState(false);
  const [pickerDisplay, setPickerDisplay] = useState('Sẵn sàng');
  const [pickerWinner, setPickerWinner] = useState<string | null>(null);

  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswers, setNewAnswers] = useState<[string, string, string, string]>(['', '', '', '']);
  const [newCorrect, setNewCorrect] = useState(0);
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const frameRequestRef = useRef(0);
  const cameraActiveRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastFrameAtRef = useRef(0);
  const lastUiAtRef = useRef(0);
  const lastHandAtRef = useRef(0);
  const fpsRef = useRef(0);
  const lightScoreRef = useRef(0.8);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pickerTimerRef = useRef<number | null>(null);
  const stabilizerRef = useRef(new AGSAStabilizer());
  const classifierRef = useRef(new FingerClassifier());
  const smootherRef = useRef(new LandmarkSmoother());
  const actionHandlerRef = useRef<(action: GestureAction) => void>(() => undefined);

  const recordEvent = (action: GestureAction, source: 'camera' | 'manual', score = 1, quality = 1) => {
    setEventLog((previous) => [
      {
        id: createId(),
        action,
        source,
        score,
        quality,
        time: new Date().toLocaleTimeString('vi-VN'),
      },
      ...previous,
    ].slice(0, 100));
  };

  const measureLight = (video: HTMLVideoElement) => {
    lightCanvasRef.current ??= document.createElement('canvas');
    const canvas = lightCanvasRef.current;
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return lightScoreRef.current;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    for (let index = 0; index < data.length; index += 4) {
      total += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    }
    const luminance = total / (data.length / 4);
    const darkScore = Math.min(1, luminance / 90);
    const brightScore = Math.min(1, (245 - luminance) / 75);
    lightScoreRef.current = Math.max(0, Math.min(darkScore, brightScore));
    return lightScoreRef.current;
  };

  const processFrame = () => {
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;
    const now = performance.now();

    if (!cameraActiveRef.current || !video || !landmarker) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const inferenceStartedAt = performance.now();
      try {
        const results = landmarker.detectForVideo(video, now);
        const inferenceMs = performance.now() - inferenceStartedAt;
        const delta = lastFrameAtRef.current ? now - lastFrameAtRef.current : 0;
        if (delta > 0) {
          const instantFps = 1000 / delta;
          fpsRef.current = fpsRef.current ? 0.85 * fpsRef.current + 0.15 * instantFps : instantFps;
        }
        lastFrameAtRef.current = now;

        const rawPoints = results.landmarks?.[0] as HandLandmark[] | undefined;
        if (rawPoints?.length === 21) {
          lastHandAtRef.current = now;
          const canvas = overlayRef.current;
          if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          const filteredPoints = smootherRef.current.filter(rawPoints, now);
          if (canvas) drawHand(canvas, filteredPoints);
          if (Math.round(now / 100) % 4 === 0) measureLight(video);
          const aspect = video.videoWidth / Math.max(1, video.videoHeight);
          const quality = estimateLandmarkQuality(rawPoints, lightScoreRef.current, aspect);
          const classification = classifierRef.current.classify(filteredPoints, aspect);
          const decision = stabilizerRef.current.update(classification.gesture, quality, now);
          const handedness =
            results.handednesses?.[0]?.[0]?.categoryName === 'Left' ? 'Tay trái' :
              results.handednesses?.[0]?.[0]?.categoryName === 'Right' ? 'Tay phải' : '—';

          if (now - lastUiAtRef.current >= 55 || decision.event) {
            lastUiAtRef.current = now;
            setTelemetry({
              rawGesture: classification.gesture,
              stableGesture: decision.dominantGesture,
              pattern: classification.pattern,
              fingers: classification.fingers,
              quality,
              score: decision.score,
              margin: decision.margin,
              holdProgress: decision.holdProgress,
              adaptiveHoldMs: decision.adaptiveHoldMs,
              state: decision.state,
              fps: fpsRef.current,
              inferenceMs,
              handedness,
              lightScore: lightScoreRef.current,
            });
          }
          if (decision.event) {
            recordEvent(decision.event, 'camera', decision.score, quality);
            actionHandlerRef.current(decision.event);
          }
        } else {
          const canvas = overlayRef.current;
          canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
          const decision = stabilizerRef.current.update('UNKNOWN', 0, now);
          if (now - lastHandAtRef.current > 450) {
            smootherRef.current.reset();
            classifierRef.current.reset();
          }
          if (now - lastUiAtRef.current >= 100) {
            lastUiAtRef.current = now;
            setTelemetry((previous) => ({
              ...previous,
              rawGesture: 'UNKNOWN',
              stableGesture: decision.dominantGesture,
              pattern: '-----',
              fingers: DEFAULT_FINGERS,
              quality: 0,
              score: decision.score,
              margin: decision.margin,
              holdProgress: 0,
              state: 'idle',
              fps: fpsRef.current,
              inferenceMs,
              handedness: '—',
            }));
          }
        }
      } catch (error) {
        console.error('GestureCore frame error:', error);
      }
    }

    frameRequestRef.current = requestAnimationFrame(processFrame);
  };

  const initialiseModel = async () => {
    if (handLandmarkerRef.current) return handLandmarkerRef.current;
    setModelState('loading');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm',
    );
    const options = {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU' as const,
      },
      runningMode: 'VIDEO' as const,
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };
    try {
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, options);
    } catch {
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'CPU' },
      });
    }
    setModelState('ready');
    return handLandmarkerRef.current;
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ camera hoặc trang chưa chạy qua HTTPS.');
      }
      await initialiseModel();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      cameraActiveRef.current = true;
      setCameraActive(true);
      lastVideoTimeRef.current = -1;
      stabilizerRef.current.reset();
      frameRequestRef.current = requestAnimationFrame(processFrame);
    } catch (error) {
      setModelState('error');
      setCameraError(error instanceof Error ? error.message : 'Không thể khởi động camera.');
    }
  };

  const stopCamera = () => {
    cameraActiveRef.current = false;
    cancelAnimationFrame(frameRequestRef.current);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = overlayRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setCameraActive(false);
    setTelemetry(DEFAULT_TELEMETRY);
    stabilizerRef.current.reset();
    classifierRef.current.reset();
    smootherRef.current.reset();
  };

  useEffect(() => {
    return () => {
      cameraActiveRef.current = false;
      cancelAnimationFrame(frameRequestRef.current);
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      if (pickerTimerRef.current) window.clearInterval(pickerTimerRef.current);
      handLandmarkerRef.current?.close();
    };
  }, []);

  useEffect(() => {
    stabilizerRef.current.reset();
    setSelectedAnswer(null);
    setFeedback(null);
    setSelectedCard(null);
  }, [mode]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const runPicker = () => {
    if (pickerSpinning || students.length === 0) return;
    setPickerSpinning(true);
    setPickerWinner(null);
    let steps = 0;
    pickerTimerRef.current = window.setInterval(() => {
      setPickerDisplay(students[secureRandomIndex(students.length)]);
      steps += 1;
      if (steps >= 22) {
        if (pickerTimerRef.current) window.clearInterval(pickerTimerRef.current);
        const winner = students[secureRandomIndex(students.length)];
        setPickerDisplay(winner);
        setPickerWinner(winner);
        setPickerSpinning(false);
      }
    }, 75);
  };

  actionHandlerRef.current = (action) => {
    if (mode === 'quiz') {
      if (!quizRunning || feedback || questions.length === 0) return;
      const answerIndex = ['SELECT_A', 'SELECT_B', 'SELECT_C', 'SELECT_D'].indexOf(action);
      if (answerIndex >= 0) {
        setSelectedAnswer(answerIndex);
        return;
      }
      if (action === 'CANCEL') {
        setSelectedAnswer(null);
        return;
      }
      if (action === 'CONFIRM' && selectedAnswer !== null) {
        const correct = selectedAnswer === questions[quizIndex].correctIndex;
        setFeedback(correct ? 'correct' : 'incorrect');
        if (correct) setQuizScore((score) => score + 1);
        window.setTimeout(() => {
          setFeedback(null);
          setSelectedAnswer(null);
          if (quizIndex >= questions.length - 1) {
            setQuizRunning(false);
            setQuizFinished(true);
          } else {
            setQuizIndex((index) => index + 1);
          }
        }, 950);
      }
      return;
    }

    if (mode === 'cards') {
      const slot = ['SELECT_A', 'SELECT_B', 'SELECT_C', 'SELECT_D'].indexOf(action);
      if (slot >= 0) {
        const index = cardPage * 4 + slot;
        if (cards[index]) setSelectedCard(index);
        return;
      }
      if (action === 'CONFIRM' && selectedCard !== null) {
        setRevealedCards((previous) => {
          const next = new Set(previous);
          next.has(selectedCard) ? next.delete(selectedCard) : next.add(selectedCard);
          return next;
        });
      }
      if (action === 'CANCEL') setSelectedCard(null);
      return;
    }

    if (mode === 'picker') {
      if (action === 'CONFIRM') runPicker();
      if (action === 'CANCEL' && !pickerSpinning) {
        setPickerWinner(null);
        setPickerDisplay('Sẵn sàng');
      }
    }
  };

  const simulateAction = (action: GestureAction) => {
    recordEvent(action, 'manual');
    actionHandlerRef.current(action);
  };

  const startQuiz = () => {
    setQuizIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);
    setFeedback(null);
    setQuizFinished(false);
    setQuizRunning(true);
  };

  const addQuestion = () => {
    if (!newQuestionText.trim() || newAnswers.some((answer) => !answer.trim())) return;
    setQuestions((previous) => [...previous, {
      id: createId(),
      text: newQuestionText.trim(),
      answers: newAnswers.map((answer) => answer.trim()) as [string, string, string, string],
      correctIndex: newCorrect,
    }]);
    setNewQuestionText('');
    setNewAnswers(['', '', '', '']);
  };

  const addCard = () => {
    if (!newCardFront.trim() || !newCardBack.trim()) return;
    setCards((previous) => [...previous, {
      id: createId(),
      front: newCardFront.trim(),
      back: newCardBack.trim(),
    }]);
    setNewCardFront('');
    setNewCardBack('');
  };

  const updateStudents = () => {
    const names = studentsInput
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    setStudents([...new Set(names)]);
    setPickerDisplay('Sẵn sàng');
    setPickerWinner(null);
  };

  const exportData = () => {
    if (mode === 'research') {
      downloadBlob(JSON.stringify(eventLog, null, 2), 'application/json', 'gesturecore-nhat-ky.json');
      return;
    }
    let rows: Record<string, string | number>[] = [];
    let filename = 'gesturecore.xlsx';
    if (mode === 'quiz') {
      rows = questions.map((question, index) => ({
        STT: index + 1,
        'Câu hỏi': question.text,
        A: question.answers[0],
        B: question.answers[1],
        C: question.answers[2],
        D: question.answers[3],
        'Đáp án đúng': ['A', 'B', 'C', 'D'][question.correctIndex],
      }));
      filename = 'gesturecore-cau-hoi.xlsx';
    } else if (mode === 'cards') {
      rows = cards.map((card, index) => ({ STT: index + 1, 'Mặt trước': card.front, 'Mặt sau': card.back }));
      filename = 'gesturecore-the-hoc.xlsx';
    } else {
      rows = students.map((name, index) => ({ STT: index + 1, 'Họ và tên': name }));
      filename = 'gesturecore-hoc-sinh.xlsx';
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Du lieu');
    XLSX.writeFile(workbook, filename);
  };

  const importExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (mode === 'quiz') {
          const imported = rows.map((row) => {
            const answer = String(row['Đáp án đúng'] || row['Dap an dung'] || 'A').toUpperCase();
            return {
              id: createId(),
              text: String(row['Câu hỏi'] || row['Cau hoi'] || ''),
              answers: [String(row.A || ''), String(row.B || ''), String(row.C || ''), String(row.D || '')] as [string, string, string, string],
              correctIndex: Math.max(0, ['A', 'B', 'C', 'D'].indexOf(answer)),
            };
          }).filter((question) => question.text && question.answers.every(Boolean));
          if (imported.length) setQuestions(imported);
        } else if (mode === 'cards') {
          const imported = rows.map((row) => ({
            id: createId(),
            front: String(row['Mặt trước'] || row['Mat truoc'] || row['Câu hỏi'] || ''),
            back: String(row['Mặt sau'] || row['Mat sau'] || row['Trả lời'] || ''),
          })).filter((card) => card.front && card.back);
          if (imported.length) setCards(imported);
        } else if (mode === 'picker') {
          const imported = rows.map((row) => String(row['Họ và tên'] || row['Ho va ten'] || Object.values(row)[0] || '').trim()).filter(Boolean);
          if (imported.length) {
            setStudents(imported);
            setStudentsInput(imported.join('\n'));
          }
        }
      } catch (error) {
        console.error('Không thể đọc Excel:', error);
        setCameraError('Không thể đọc tệp Excel. Hãy dùng đúng các cột của tệp mẫu.');
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  };

  const renderQuiz = () => {
    if (!quizRunning) {
      return (
        <div className="h-full min-h-[480px] flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/20 mb-6">
            {quizFinished ? <Check className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />}
          </div>
          <h2 className="text-3xl font-black mb-3">{quizFinished ? 'Hoàn thành!' : 'Trắc nghiệm cử chỉ'}</h2>
          <p className="text-slate-400 max-w-xl mb-4">
            {quizFinished
              ? `Kết quả: ${quizScore}/${questions.length} câu đúng.`
              : 'Giơ 1–4 ngón để chọn A–D, sau đó nắm tay để xác nhận đáp án.'}
          </p>
          <p className="text-sm text-slate-500 mb-8">Đã có {questions.length} câu hỏi trong bộ hiện tại.</p>
          <button onClick={startQuiz} disabled={!questions.length} className="px-7 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-black flex items-center gap-2">
            <Play className="w-5 h-5" /> {quizFinished ? 'Chơi lại' : 'Bắt đầu'}
          </button>
        </div>
      );
    }
    const question = questions[quizIndex];
    return (
      <div className="min-h-[480px] p-6 md:p-10 flex flex-col">
        <div className="flex items-center justify-between text-sm text-slate-400 mb-8">
          <span>Câu {quizIndex + 1}/{questions.length}</span>
          <span className="font-bold text-cyan-300">Điểm: {quizScore}</span>
        </div>
        <h2 className="text-2xl md:text-4xl font-black leading-tight mb-8">{question.text}</h2>
        <div className="grid sm:grid-cols-2 gap-4 flex-1">
          {question.answers.map((answer, index) => {
            const selected = selectedAnswer === index;
            const isCorrect = feedback && index === question.correctIndex;
            const isWrong = feedback === 'incorrect' && selected;
            return (
              <button
                key={`${question.id}-${index}`}
                onClick={() => !feedback && setSelectedAnswer(index)}
                className={`min-h-28 p-5 rounded-2xl border text-left transition-all ${
                  isCorrect ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100' :
                    isWrong ? 'bg-rose-500/20 border-rose-400 text-rose-100' :
                      selected ? 'bg-cyan-500/20 border-cyan-300 ring-2 ring-cyan-300/30' :
                        'bg-slate-900/70 border-slate-700 hover:border-slate-500'
                }`}
              >
                <span className="inline-flex w-9 h-9 rounded-xl bg-white/10 items-center justify-center font-black mr-3">{String.fromCharCode(65 + index)}</span>
                <span className="font-bold text-lg">{answer}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 text-center text-sm text-slate-400">
          {selectedAnswer === null ? 'Giơ 1–4 ngón để chọn' : `Đã chọn ${String.fromCharCode(65 + selectedAnswer)} · Nắm tay để xác nhận`}
        </div>
      </div>
    );
  };

  const renderCards = () => {
    const pageCount = Math.max(1, Math.ceil(cards.length / 4));
    const visibleCards = cards.slice(cardPage * 4, cardPage * 4 + 4);
    return (
      <div className="min-h-[480px] p-6 md:p-9 flex flex-col">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-2xl font-black">Thẻ học tập</h2>
            <p className="text-sm text-slate-400 mt-1">Giơ số ngón để chọn thẻ · Nắm tay để lật</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCardPage((page) => Math.max(0, page - 1))} disabled={cardPage === 0} className="p-2 rounded-lg bg-white/5 disabled:opacity-30"><ChevronLeft /></button>
            <span className="text-sm text-slate-400">{cardPage + 1}/{pageCount}</span>
            <button onClick={() => setCardPage((page) => Math.min(pageCount - 1, page + 1))} disabled={cardPage >= pageCount - 1} className="p-2 rounded-lg bg-white/5 disabled:opacity-30"><ChevronRight /></button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 flex-1">
          {visibleCards.map((card, slot) => {
            const index = cardPage * 4 + slot;
            const selected = selectedCard === index;
            const revealed = revealedCards.has(index);
            return (
              <button key={card.id} onClick={() => setSelectedCard(index)} className={`relative min-h-44 rounded-3xl border p-6 text-left overflow-hidden transition-all ${selected ? 'border-violet-300 ring-2 ring-violet-300/30 bg-violet-500/15' : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'}`}>
                <span className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-violet-500 text-white flex items-center justify-center font-black">{slot + 1}</span>
                <span className="text-xs uppercase tracking-widest text-violet-300 font-bold">{revealed ? 'Mặt sau' : 'Mặt trước'}</span>
                <p className="text-xl font-black mt-5 pr-8">{revealed ? card.back : card.front}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPicker = () => (
    <div className="min-h-[480px] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
      <div className={`absolute inset-0 transition-opacity ${pickerSpinning ? 'opacity-100' : 'opacity-40'} bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_60%)]`} />
      <Users className={`w-14 h-14 mb-6 text-emerald-300 relative ${pickerSpinning ? 'animate-bounce' : ''}`} />
      <p className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-4 relative">Chọn học sinh ngẫu nhiên</p>
      <div className={`text-4xl md:text-6xl font-black min-h-20 relative ${pickerWinner ? 'text-emerald-300' : 'text-white'}`}>{pickerDisplay}</div>
      <p className="mt-7 text-slate-400 relative">{pickerSpinning ? 'Đang lựa chọn…' : pickerWinner ? 'Xòe tay để đặt lại' : 'Nắm tay để bắt đầu'}</p>
      <button onClick={runPicker} disabled={pickerSpinning || students.length === 0} className="relative mt-8 px-7 py-3 bg-emerald-500 text-slate-950 rounded-xl font-black disabled:opacity-40">Chọn ngay</button>
      <span className="relative mt-4 text-xs text-slate-500">Danh sách hiện có: {students.length} học sinh</span>
    </div>
  );

  const renderResearch = () => (
    <div className="min-h-[480px] p-6 md:p-9">
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-3"><FlaskConical className="text-amber-300" /> Phòng thử nghiệm AGSA</h2>
          <p className="text-slate-400 mt-2">Quan sát dữ liệu trực tiếp và xuất nhật ký để so sánh các lần thử.</p>
        </div>
        <button onClick={exportData} className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold flex items-center gap-2"><Download className="w-4 h-4" /> JSON</button>
      </div>
      <div className="grid md:grid-cols-4 gap-3 mb-8">
        {[
          ['1. Phát hiện', '21 điểm bàn tay'],
          ['2. Chuẩn hóa', 'Tỷ lệ và góc tay'],
          ['3. Ổn định', 'One Euro + bỏ phiếu'],
          ['4. Phát lệnh', 'Máy trạng thái AGSA'],
        ].map(([title, text]) => <div key={title} className="p-4 bg-slate-900 border border-slate-700 rounded-2xl"><div className="text-cyan-300 font-black text-sm">{title}</div><div className="text-slate-400 text-xs mt-2">{text}</div></div>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400"><tr><th className="p-3 text-left">Thời gian</th><th className="p-3 text-left">Sự kiện</th><th className="p-3 text-left">Nguồn</th><th className="p-3 text-right">Độ tin cậy</th><th className="p-3 text-right">Chất lượng</th></tr></thead>
          <tbody>
            {eventLog.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có sự kiện. Bật camera hoặc dùng nút mô phỏng.</td></tr> : eventLog.slice(0, 20).map((event) => (
              <tr key={event.id} className="border-t border-slate-800"><td className="p-3 text-slate-400">{event.time}</td><td className="p-3 font-bold">{ACTION_LABELS[event.action]}</td><td className="p-3">{event.source === 'camera' ? 'Camera' : 'Mô phỏng'}</td><td className="p-3 text-right">{Math.round(event.score * 100)}%</td><td className="p-3 text-right">{Math.round(event.quality * 100)}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="mt-6 bg-slate-900/90 border border-slate-700 rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 className="text-xl font-black">Quản lý dữ liệu</h3>
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm"><Upload className="w-4 h-4" /> Nhập Excel</button>
          <button onClick={exportData} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> Xuất Excel</button>
          <button onClick={() => setSettingsOpen(false)} className="p-2 rounded-lg bg-white/5"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {mode === 'quiz' && <>
        <div className="grid lg:grid-cols-[1.2fr_2fr_auto] gap-3 items-end mb-6">
          <label className="text-sm text-slate-400">Câu hỏi<input value={newQuestionText} onChange={(event) => setNewQuestionText(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white" placeholder="Nhập nội dung câu hỏi" /></label>
          <div className="grid sm:grid-cols-4 gap-2">{newAnswers.map((answer, index) => <label key={index} className="text-sm text-slate-400">{String.fromCharCode(65 + index)}<input value={answer} onChange={(event) => setNewAnswers((previous) => previous.map((item, itemIndex) => itemIndex === index ? event.target.value : item) as [string, string, string, string])} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label>)}</div>
          <div className="flex gap-2"><select value={newCorrect} onChange={(event) => setNewCorrect(Number(event.target.value))} className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">{['A', 'B', 'C', 'D'].map((letter, index) => <option value={index} key={letter}>Đúng: {letter}</option>)}</select><button onClick={addQuestion} className="p-3 rounded-xl bg-cyan-500 text-slate-950"><Plus /></button></div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">{questions.map((question, index) => <div key={question.id} className="flex items-center gap-3 bg-slate-950/70 p-3 rounded-xl"><span className="w-7 h-7 bg-cyan-500/20 text-cyan-300 rounded-lg flex items-center justify-center text-xs font-black">{index + 1}</span><span className="flex-1 text-sm">{question.text}</span><span className="text-xs text-emerald-300">Đúng {String.fromCharCode(65 + question.correctIndex)}</span><button onClick={() => setQuestions((previous) => previous.filter((item) => item.id !== question.id))} className="p-2 text-rose-300"><Trash2 className="w-4 h-4" /></button></div>)}</div>
      </>}

      {mode === 'cards' && <>
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end mb-6"><label className="text-sm text-slate-400">Mặt trước<input value={newCardFront} onChange={(event) => setNewCardFront(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label><label className="text-sm text-slate-400">Mặt sau<input value={newCardBack} onChange={(event) => setNewCardBack(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label><button onClick={addCard} className="p-3 rounded-xl bg-violet-500"><Plus /></button></div>
        <div className="space-y-2 max-h-64 overflow-y-auto">{cards.map((card, index) => <div key={card.id} className="flex items-center gap-3 bg-slate-950/70 p-3 rounded-xl"><span className="text-violet-300 font-black">#{index + 1}</span><span className="flex-1 text-sm"><b>{card.front}</b> — {card.back}</span><button onClick={() => setCards((previous) => previous.filter((item) => item.id !== card.id))} className="p-2 text-rose-300"><Trash2 className="w-4 h-4" /></button></div>)}</div>
      </>}

      {mode === 'picker' && <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end"><label className="text-sm text-slate-400">Mỗi dòng một học sinh<textarea value={studentsInput} onChange={(event) => setStudentsInput(event.target.value)} className="mt-1 w-full h-48 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white resize-none" /></label><button onClick={updateStudents} className="px-5 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black">Cập nhật</button></div>}
    </div>
  );

  const stateLabel: Record<EngineState, string> = {
    idle: 'Chờ cử chỉ',
    candidate: 'Đang xác nhận',
    locked: 'Đã khóa lệnh',
    'poor-quality': 'Hình ảnh chưa tốt',
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-950 text-white selection:bg-cyan-300/30">
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 md:px-7 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10"><ArrowLeft /></button>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center"><Hand /></div>
            <div><h1 className="font-black text-xl">GestureCore Edu</h1><p className="text-xs text-slate-400">AGSA · Điều khiển học tập bằng cử chỉ</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSettingsOpen((value) => !value)} disabled={mode === 'research'} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center gap-2 text-sm"><Settings2 className="w-4 h-4" /> Dữ liệu</button>
            <button onClick={toggleFullscreen} className="p-2 rounded-xl bg-white/5 hover:bg-white/10" title="Toàn màn hình"><Maximize2 className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-7">
        <nav className="flex gap-2 overflow-x-auto pb-4">
          {([
            ['quiz', 'Trắc nghiệm'],
            ['cards', 'Lật thẻ'],
            ['picker', 'Chọn học sinh'],
            ['research', 'Thử nghiệm AGSA'],
          ] as [GameMode, string][]).map(([value, label]) => <button key={value} onClick={() => { setMode(value); setSettingsOpen(false); }} className={`whitespace-nowrap px-5 py-3 rounded-2xl font-bold transition-all ${mode === value ? 'bg-white text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>{label}</button>)}
        </nav>

        <div className="grid xl:grid-cols-[370px_minmax(0,1fr)] gap-6">
          <aside className="space-y-5">
            <section className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
              <div className="aspect-[4/3] bg-black relative overflow-hidden">
                <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
                <canvas ref={overlayRef} className="absolute inset-0 w-full h-full -scale-x-100" />
                {!cameraActive && <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15),transparent_65%)]"><CameraOff className="w-12 h-12 text-slate-500 mb-4" /><p className="font-bold">Camera đang tắt</p><p className="text-xs text-slate-500 mt-2">Hình ảnh chỉ được xử lý trên trình duyệt</p></div>}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-xs flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-400 animate-pulse' : modelState === 'loading' ? 'bg-amber-400' : 'bg-slate-500'}`} />{modelState === 'loading' ? 'Đang tải mô hình' : cameraActive ? 'Đang nhận dạng' : 'Ngoại tuyến'}</div>
              </div>
              <div className="p-4">
                <button onClick={cameraActive ? stopCamera : startCamera} disabled={modelState === 'loading'} className={`w-full py-3 rounded-xl font-black flex items-center justify-center gap-2 ${cameraActive ? 'bg-rose-500 hover:bg-rose-400' : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'} disabled:opacity-50`}>{cameraActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}{cameraActive ? 'Tắt camera' : modelState === 'loading' ? 'Đang khởi động…' : 'Bật camera'}</button>
                {cameraError && <p className="mt-3 text-xs text-rose-300 bg-rose-500/10 p-3 rounded-xl">{cameraError}</p>}
              </div>
            </section>

            <section className="bg-slate-900 border border-slate-700 rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3"><span className="text-xs uppercase tracking-widest text-slate-500">Cử chỉ ổn định</span><span className="text-xs text-slate-400">{stateLabel[telemetry.state]}</span></div>
              <div className="flex items-center gap-3 mb-4"><span className={`w-12 h-12 rounded-2xl ${ACTION_COLORS[telemetry.stableGesture]} flex items-center justify-center font-black`}>{telemetry.pattern === '-----' ? '?' : telemetry.pattern}</span><div><div className="font-black">{ACTION_LABELS[telemetry.stableGesture]}</div><div className="text-xs text-slate-500">{telemetry.handedness}</div></div></div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4"><div className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${Math.round(telemetry.holdProgress * 100)}%` }} /></div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl"><span className="text-slate-500">Tin cậy</span><b className="block text-lg text-cyan-300">{Math.round(telemetry.score * 100)}%</b></div>
                <div className="bg-slate-950 p-3 rounded-xl"><span className="text-slate-500">Chất lượng</span><b className="block text-lg text-emerald-300">{Math.round(telemetry.quality * 100)}%</b></div>
                <div className="bg-slate-950 p-3 rounded-xl"><span className="text-slate-500">Tốc độ</span><b className="block text-lg">{telemetry.fps.toFixed(1)} FPS</b></div>
                <div className="bg-slate-950 p-3 rounded-xl"><span className="text-slate-500">Suy luận</span><b className="block text-lg">{telemetry.inferenceMs.toFixed(0)} ms</b></div>
              </div>
            </section>

            <section className="bg-slate-900 border border-slate-700 rounded-3xl p-5">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Mô phỏng để kiểm tra</p>
              <div className="grid grid-cols-3 gap-2">
                {(['SELECT_A', 'SELECT_B', 'SELECT_C', 'SELECT_D', 'CONFIRM', 'CANCEL'] as GestureAction[]).map((action) => <button key={action} onClick={() => simulateAction(action)} className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold">{action.startsWith('SELECT_') ? action.at(-1) : action === 'CONFIRM' ? '✊' : '🖐️'}</button>)}
              </div>
            </section>
          </aside>

          <section className="min-w-0">
            <div className="bg-slate-900/70 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
              {mode === 'quiz' && renderQuiz()}
              {mode === 'cards' && renderCards()}
              {mode === 'picker' && renderPicker()}
              {mode === 'research' && renderResearch()}
            </div>
            {settingsOpen && renderEditor()}
          </section>
        </div>
      </main>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
      {isFullscreen && <div className="fixed bottom-4 right-4 z-50 text-xs bg-black/50 px-3 py-2 rounded-lg text-slate-400">Nhấn Esc để thoát toàn màn hình</div>}
    </div>
  );
}

