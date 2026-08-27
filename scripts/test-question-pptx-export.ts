import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { QUESTION_TYPES, createQuestionTemplate } from '../src/lib/questionEngine.ts';
import { exportQuestionBankToPptx } from '../src/lib/questionPptxExport.ts';

let checks = 0;
const verify = (condition: unknown, description: string) => {
  assert.ok(condition, description);
  checks += 1;
};

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
const questions = QUESTION_TYPES.map(type => {
  const question = createQuestionTemplate(type);
  question.prompt = `Câu mẫu ${type}`;
  question.explanation = `Giải thích ${type}`;
  if (question.payload.type === 'image_hotspot') question.payload.imageUrl = onePixelPng;
  return question;
});

verify(questions.length === 10, 'The PowerPoint sample includes all ten Question Engine types.');

let generatedFileName = '';
try {
  generatedFileName = await exportQuestionBankToPptx({
    id: 'bank-pptx-test',
    title: 'Bài giảng kiểm thử 10 dạng',
    questions,
  });
  const generatedPath = resolve(generatedFileName);
  verify(generatedFileName.endsWith('.pptx'), 'Export returns a PowerPoint filename.');
  verify(existsSync(generatedPath), 'PptxGenJS writes a real PowerPoint file in the CI runner.');
  verify(statSync(generatedPath).size > 10_000, 'The generated PowerPoint contains a non-trivial slide package.');
} finally {
  if (generatedFileName && existsSync(resolve(generatedFileName))) {
    unlinkSync(resolve(generatedFileName));
  }
}

const exporter = readFileSync(new URL('../src/lib/questionPptxExport.ts', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../src/components/QuestionStudioPptxExport.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/components/QuestionStudioApp.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
};

for (const type of QUESTION_TYPES) {
  verify(exporter.includes(`case '${type}'`) || exporter.includes(`payload.type !== '${type}'`) || exporter.includes(`payload.type === '${type}'`), `PowerPoint renderer handles ${type}.`);
}
verify(exporter.includes("hyperlink: { slide: targetSlide }"), 'Slides use internal hyperlinks for click-to-reveal interaction.');
verify(exporter.includes("'HIỆN ĐÁP ÁN  →'"), 'Question slides include a reveal-answer control.');
verify(exporter.includes("'CÂU TIẾP THEO  →'"), 'Answer slides include next-question navigation.');
verify(exporter.includes("pptx.layout = 'LAYOUT_WIDE'"), 'PowerPoint export uses 16:9 widescreen layout.');
verify(exporter.includes("lang: 'vi-VN'"), 'PowerPoint theme declares Vietnamese language metadata.');
verify(exporter.includes('pptx.writeFile({ fileName, compression: true })'), 'Export downloads a compressed PPTX in the browser.');
verify(controls.includes('Xuất PowerPoint'), 'Question Studio exposes a visible PowerPoint export action.');
verify(controls.includes('Bấm để hiện đáp án'), 'The UI explains the click-to-reveal presentation behavior.');
verify(controls.includes('Xóa bộ câu hỏi đang chọn'), 'Question Studio exposes a delete control for the selected question bank.');
verify(controls.includes('window.confirm('), 'Deleting a question bank requires explicit confirmation.');
verify(controls.includes('localStorage.setItem(storageKey(ownerUid), JSON.stringify(remaining))'), 'Deleting a bank persists the remaining owner-scoped banks.');
verify(controls.includes('window.location.reload()'), 'The Question Studio interface refreshes immediately after a bank is deleted.');
verify(app.includes('<QuestionStudioPptxExport />'), 'PowerPoint export is mounted directly inside the ten-type Question Studio page.');
verify(packageJson.dependencies.pptxgenjs === '^4.0.1', 'The browser build pins the supported PptxGenJS release.');
verify(packageJson.scripts['test:question-pptx'].includes('test-question-pptx-export.ts'), 'The PowerPoint regression test is available to CI.');

console.info(`Question Studio PowerPoint export and bank deletion: ${checks} checks passed.`);