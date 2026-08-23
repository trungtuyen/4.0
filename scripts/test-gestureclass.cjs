const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

async function main() {
  for (const filename of ["index.html", "styles.css", "app.js"]) {
    const contents = readFileSync(resolve(__dirname, "../public/gestureclass", filename), "utf8");
    assert.ok(contents.length > 100, `${filename} contains meaningful content`);
  }

  const index = readFileSync(resolve(__dirname, "../public/gestureclass/index.html"), "utf8");
  assert.match(index, /href="\.\/styles\.css"/);
  assert.match(index, /src="\.\/app\.js"/);

  let markup = "";
  let elements = new Map();
  const handlers = {};
  const storage = new Map();
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
    window: { addEventListener() {} },
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
    confirm: () => true,
    performance: { now: () => 2000 },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
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

  const questionId = JSON.parse(storage.get("gestureclass.v1.private")).questions[0].id;
  await click("duplicate-question", { id: questionId });
  assert.match(markup, /Hiển thị 14\/14 câu hỏi/);
  const duplicateId = JSON.parse(storage.get("gestureclass.v1.private")).questions[0].id;
  await click("delete-question", { id: duplicateId });
  assert.match(markup, /Hiển thị 13\/13 câu hỏi/);

  await click("navigate", { view: "classes" });
  await click("new-class");
  submit("#class-form", { name: "Lớp 8C", subject: "Toán 8", students: "Học sinh A\nHọc sinh B" });
  assert.match(markup, /Lớp 8C/);

  await click("navigate", { view: "play" });
  assert.match(markup, /Phòng chơi cử chỉ/);
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

  await click("toggle-menu");
  assert.match(markup, /sidebar open/);

  process.stdout.write(JSON.stringify({
    status: "passed",
    checked: ["static assets", "dashboard", "question create/duplicate/delete", "question search", "class management", "gesture simulation", "keyboard answers", "flashcards", "random student picker", "responsive navigation", "local persistence"]
  }) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
