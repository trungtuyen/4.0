const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

// Runs the shipped finger-counting and gesture-tracking code on landmarks that the real
// MediaPipe hand model produced for photos of 1, 2, fist, thumb-up and open-hand poses.
function checkHandGestures() {
  const source = readFileSync(resolve(__dirname, "../public/gestureclass/app.js"), "utf8");
  const extract = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `app.js contains ${startMarker.trim()}`);
    return source.slice(start, end);
  };
  const labels = [];
  const answers = [];
  let clock = 0;
  let frame = null;
  const vision = {
    Math,
    console,
    state: null,
    document: { querySelector: (selector) => selector === "#camera-video" ? { readyState: 4, videoWidth: 640, videoHeight: 480 } : null },
    performance: { now: () => clock },
    requestAnimationFrame: () => 0,
    updateGestureLabel: (value) => labels.push(value),
    chooseAnswer: (index) => { answers.push(index); vision.state.game.revealed = true; }
  };
  vm.runInNewContext(`${[
    extract("  function idleCamera() {", "  const state = {"),
    extract("  const FINGER_JOINTS", '  document.addEventListener("click"'),
    extract("  function requireFreshGesture() {", "  function nextQuestion() {")
  ].join("\n")}\nthis.api = { idleCamera, countExtendedFingers, scanHands, requireFreshGesture };`, vision);
  const { idleCamera, countExtendedFingers, scanHands, requireFreshGesture } = vision.api;

  const fixture = JSON.parse(readFileSync(resolve(__dirname, "fixtures/gestureclass-hand-landmarks.json"), "utf8"));
  const expectedCount = { one: 1, two: 2, fist: 0, thumbUp: 0, openHand: 5 };
  const asPoints = (landmarks) => landmarks.map(([x, y]) => ({ x, y }));
  // The square sample photos centred in a 640×480 webcam frame, as the play room sees them.
  const inWebcamFrame = (landmarks) => landmarks.map(([x, y]) => ({ x: x * 0.75 + 0.125, y }));
  const poses = {};
  for (const sample of fixture.samples) {
    const label = `${sample.pose} (${sample.photo}, ${sample.angle}°, mirrored ${sample.mirrored}, scale ${sample.scale})`;
    assert.equal(countExtendedFingers(asPoints(sample.landmarks), sample.aspectRatio), expectedCount[sample.pose], label);
    assert.equal(countExtendedFingers(inWebcamFrame(sample.landmarks), 640 / 480), expectedCount[sample.pose], `${label} in a 4:3 webcam frame`);
    poses[sample.pose] ||= inWebcamFrame(sample.landmarks);
  }

  vision.state = { view: "play", game: { revealed: false, finished: false }, camera: { ...idleCamera(), active: true, detector: { detectForVideo: () => ({ landmarks: frame ? [frame] : [] }) } } };
  const play = (...sequence) => {
    for (const landmarks of sequence) { clock += 33; frame = landmarks; scanHands(); }
  };
  const hold = (landmarks, frames) => play(...Array(frames).fill(landmarks));
  const nextQuestion = () => { vision.state.game.revealed = false; requireFreshGesture(); };

  // A raised index finger answers 1 only after it stays steady for about half a second.
  hold(poses.two, 2);
  hold(poses.one, 10);
  assert.deepEqual(answers, []);
  hold(poses.one, 15);
  assert.deepEqual(answers, [0]);
  assert.equal(labels.at(-1), "1 ngón tay → đáp án 1");

  // A hand still raised from the previous question does not answer the next one.
  nextQuestion();
  hold(poses.one, 40);
  assert.deepEqual(answers, [0]);
  assert.match(labels.at(-1), /hạ tay rồi giơ lại/);

  // After lowering the hand, single-frame flickers to 2 neither answer 2 nor block answer 1.
  hold(null, 4);
  for (let index = 0; index < 5; index += 1) play(...Array(7).fill(poses.one), poses.two);
  assert.deepEqual(answers, [0, 0]);

  // An open hand (thumb spread) is not answer 4; two fingers answer 2.
  nextQuestion();
  hold(null, 4);
  hold(poses.openHand, 40);
  assert.equal(labels.at(-1), "Bàn tay đang xòe — gập ngón cái để chọn 4");
  hold(poses.fist, 10);
  assert.deepEqual(answers, [0, 0]);
  hold(poses.two, 30);
  assert.deepEqual(answers, [0, 0, 1]);

  // A gesture changed while the answer is shown still has to be re-made for the next question.
  hold(poses.one, 30);
  nextQuestion();
  hold(poses.one, 30);
  assert.deepEqual(answers, [0, 0, 1]);
  hold(null, 4);
  hold(poses.one, 30);
  assert.deepEqual(answers, [0, 0, 1, 0]);
}

async function main() {
  for (const filename of ["index.html", "styles.css", "app.js"]) {
    const contents = readFileSync(resolve(__dirname, "../public/gestureclass", filename), "utf8");
    assert.ok(contents.length > 100, `${filename} contains meaningful content`);
  }

  const index = readFileSync(resolve(__dirname, "../public/gestureclass/index.html"), "utf8");
  assert.match(index, /href="\.\/styles\.css\?v=projector-readable-v1"/);
  assert.match(index, /src="\.\/app\.js\?v=projector-readable-v1"/);

  const styles = readFileSync(resolve(__dirname, "../public/gestureclass/styles.css"), "utf8");
  assert.match(styles, /\.app-shell\.play-mode \.question-block h2 \{ font-size: clamp\(30px, 1\.9vw, 40px\)/);
  assert.match(styles, /\.app-shell\.play-mode \.answer-copy \{ font-size: clamp\(18px, 1\.25vw, 24px\)/);
  assert.match(styles, /\.app-shell\.play-mode \.play-layout:fullscreen \.question-block h2 \{ font-size: clamp\(42px, 3\.15vw, 62px\)/);
  assert.match(styles, /\.app-shell\.play-mode \.play-layout:fullscreen \.answer-copy \{ font-size: clamp\(26px, 2vw, 38px\)/);
  assert.match(styles, /\.app-shell\.play-mode \.play-layout:fullscreen \.play-sidebar \{ display: none; \}/);

  const serviceWorker = readFileSync(resolve(__dirname, "../public/service-worker.js"), "utf8");
  assert.match(serviceWorker, /pathname\.startsWith\(`\$\{APP_ROOT\}gestureclass\/`\)/);
  assert.match(serviceWorker, /const fresh = await fetch\(request, \{ cache: 'no-store' \}\)/);
  assert.match(serviceWorker, /\$\{CACHE_PREFIX\}v23/);
  assert.match(serviceWorker, /projector-readable-v1/);

  checkHandGestures();

  let markup = "";
  let elements = new Map();
  const handlers = {};
  const storage = new Map();
  const teacherStorageKey = "gestureclass.v1.private::teacher-test";
  let confirmationAccepted = true;
  let confirmationMessage = "";
  const app = {};
  Object.defineProperty(app, "innerHTML", {
    get: () => markup,
    set: (value) => { markup = value; elements = new Map(); }
  });

  function createElement(selector) {
    if (elements.has(selector)) return elements.get(selector);
    const element = {
      selector,
      listeners: {},
      style: {},
      addEventListener(type, listener) { this.listeners[type] = listener; },
      appendChild() {},
      remove() {},
      focus() {},
      setSelectionRange() {},
      setAttribute() {},
      play() { return Promise.resolve(); },
      click() {},
      getContext() { return { clearRect() {} }; }
    };
    elements.set(selector, element);
    return element;
  }

  const document = {
    body: { appendChild() {} },
    head: { appendChild() {} },
    activeElement: { tagName: "DIV" },
    querySelector(selector) {
      if (selector === "#app") return app;
      if (selector === ".toast-stack") return null;
      if (selector.startsWith("#") && !markup.includes(`id="${selector.slice(1)}"`)) return null;
      return createElement(selector);
    },
    createElement() { return createElement(`created-${Math.random()}`); },
    addEventListener(type, listener) { handlers[type] = listener; }
  };

  class MockFormData {
    constructor(form) { this.values = form.values; }
    get(key) { return this.values[key]; }
  }

  const context = {
    document,
    window: { addEventListener() {}, location: { search: "?owner=teacher-test" } },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    FormData: MockFormData,
    crypto: { randomUUID: () => `test-${Math.random().toString(36).slice(2)}` },
    navigator: {},
    Intl,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Set,
    Map,
    Error,
    RegExp,
    console,
    setTimeout: () => 1,
    cancelAnimationFrame() {},
    confirm: (message) => { confirmationMessage = message; return confirmationAccepted; },
    performance: { now: () => 2000 },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    URLSearchParams,
    Blob
  };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(resolve(__dirname, "../public/gestureclass/app.js"), "utf8"), context, { filename: "app.js" });

  async function click(action, dataset = {}) {
    const target = { dataset: { action, ...dataset }, closest: () => target };
    await handlers.click({ target });
  }

  function submit(selector, values) {
    const listener = createElement(selector).listeners.submit;
    assert.equal(typeof listener, "function", `${selector} has a submit listener`);
    listener({ preventDefault() {}, currentTarget: { values } });
  }

  assert.match(markup, /Lớp học của thầy đã sẵn sàng/);
  assert.match(markup, /Hệ sinh thái 4\.0/);
  assert.equal((markup.match(/class="stat-card"/g) || []).length, 4);

  await click("navigate", { view: "questions" });
  assert.match(markup, /Quản lý câu hỏi/);
  assert.match(markup, /Hiển thị 12\/12 câu hỏi/);

  await click("new-question");
  submit("#question-form", {
    text: "Câu hỏi kiểm thử: 1 + 1 bằng bao nhiêu?",
    subject: "Toán 8",
    level: "Nhận biết",
    option0: "1",
    option1: "2",
    option2: "3",
    option3: "4",
    correct: "1"
  });
  assert.match(markup, /Câu hỏi kiểm thử: 1 \+ 1 bằng bao nhiêu\?/);
  assert.match(markup, /Hiển thị 13\/13 câu hỏi/);

  const search = createElement("#question-search");
  search.listeners.input({ target: { value: "kiểm thử", selectionStart: 8 } });
  assert.match(markup, /Hiển thị 1\/13 câu hỏi/);
  createElement("#question-search").listeners.input({ target: { value: "", selectionStart: 0 } });

  const questionId = JSON.parse(storage.get(teacherStorageKey)).questions[0].id;
  await click("duplicate-question", { id: questionId });
  assert.match(markup, /Hiển thị 14\/14 câu hỏi/);
  const duplicateId = JSON.parse(storage.get(teacherStorageKey)).questions[0].id;
  await click("delete-question", { id: duplicateId });
  assert.match(markup, /Hiển thị 13\/13 câu hỏi/);

  await click("navigate", { view: "classes" });
  assert.equal((markup.match(/data-action="delete-class"/g) || []).length, 3);
  await click("new-class");
  submit("#class-form", { name: "Lớp 8C", subject: "Toán 8", students: "Học sinh A\nHọc sinh B" });
  assert.match(markup, /Lớp 8C/);

  const createdClass = JSON.parse(storage.get(teacherStorageKey)).classes.find((item) => item.name === "Lớp 8C");
  assert.ok(createdClass);
  assert.equal((markup.match(/data-action="delete-class"/g) || []).length, 4);

  confirmationAccepted = false;
  await click("delete-class", { id: createdClass.id });
  assert.match(confirmationMessage, /Xóa Lớp 8C/);
  assert.match(confirmationMessage, /2 học sinh/);
  assert.match(markup, /Lớp 8C/);
  assert.equal(JSON.parse(storage.get(teacherStorageKey)).classes.length, 4);

  confirmationAccepted = true;
  await click("delete-class", { id: createdClass.id });
  assert.doesNotMatch(markup, /<h3>Lớp 8C<\/h3>/);
  assert.equal((markup.match(/data-action="delete-class"/g) || []).length, 3);
  assert.equal(JSON.parse(storage.get(teacherStorageKey)).classes.length, 3);
  assert.equal(JSON.parse(storage.get(teacherStorageKey)).activities[0].title, "Xóa lớp học");

  await click("navigate", { view: "play" });
  assert.match(markup, /Phòng chơi cử chỉ/);
  assert.match(markup, /class="app-shell play-mode"/);
  assert.match(markup, /aria-label="Mở chế độ trình chiếu toàn màn hình"/);
  assert.match(markup, /class="button ghost small fullscreen-exit"/);
  assert.equal((markup.match(/class="answer-card/g) || []).length, 4);
  await click("simulate-gesture", { index: "1" });
  assert.match(markup, /answer-card correct/);
  await click("next-question");
  handlers.keydown({ key: "1" });
  assert.match(markup, /answer-card correct/);

  await click("flashcards");
  assert.match(markup, /Lật thẻ ôn tập/);
  await click("flip-card");
  assert.match(markup, /Đáp án:/);
  await click("close-modal");

  await click("random-picker");
  assert.match(markup, /Ai sẽ là người tiếp theo\?/);
  await click("pick-student");
  assert.match(markup, /Đã chọn ngẫu nhiên từ danh sách lớp/);
  await click("close-modal");

  await click("navigate", { view: "classes" });
  for (const item of JSON.parse(storage.get(teacherStorageKey)).classes) {
    await click("delete-class", { id: item.id });
  }
  assert.equal(JSON.parse(storage.get(teacherStorageKey)).classes.length, 0);
  assert.equal(storage.has("gestureclass.v1.private::another-teacher"), false);
  assert.equal(storage.has("gestureclass.v1.private"), false);
  assert.match(markup, /Chưa có lớp học nào/);
  assert.match(markup, /data-action="new-class"/);

  await click("navigate", { view: "dashboard" });
  assert.match(markup, /Lớp đang quản lý[\s\S]*?<div class="stat-value">0<\/div>/);
  assert.match(markup, /Học sinh mẫu[\s\S]*?<div class="stat-value">0<\/div>/);

  await click("toggle-menu");
  assert.match(markup, /sidebar open/);

  process.stdout.write(JSON.stringify({
    status: "passed",
    checked: ["static assets", "projector-scale classroom play mode", "fullscreen presentation controls", "dashboard", "question create/duplicate/delete", "question search", "class create/delete confirmation and persistence", "empty class list and synchronized counts", "camera finger counting on real hand landmarks", "steady-gesture answers and re-arming", "gesture simulation", "keyboard answers", "flashcards", "random student picker", "responsive navigation", "local persistence"]
  }) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
