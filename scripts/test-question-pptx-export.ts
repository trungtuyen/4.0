import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import '../src/lib/questionPptxSequentialPatch.ts';
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

  const guideSlideXml = execFileSync('unzip', ['-p', generatedPath, 'ppt/slides/slide2.xml'], { encoding: 'utf8' });
  const coverSlideXml = execFileSync('unzip', ['-p', generatedPath, 'ppt/slides/slide1.xml'], { encoding: 'utf8' });
  verify(guideSlideXml.includes('show="0"'), 'The instruction slide is hidden from normal slideshow advance.');
  verify(coverSlideXml.includes('BẮT ĐẦU CÂU 1'), 'The cover contains a direct start control for Question 1.');
  verify(coverSlideXml.includes('TRÌNH CHIẾU TUẦN TỰ'), 'The cover explains the sequential classroom flow.');
} finally {
  if (generatedFileName && existsSync(resolve(generatedFileName))) {
    unlinkSync(resolve(generatedFileName));
  }
}

const exporter = readFileSync(new URL('../src/lib/questionPptxExport.ts', import.meta.url), 'utf8');
const sequentialPatch = readFileSync(new URL('../src/lib/questionPptxSequentialPatch.ts', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../src/components/QuestionStudioPptxExport.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/components/QuestionStudioApp.tsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
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
verify(sequentialPatch.includes('guide.hidden = true'), 'Sequential playback hides the guide from normal advance.');
verify(sequentialPatch.includes("hyperlink: { slide: 3"), 'The cover starts directly at Question 1.');
verify(main.includes("import './lib/questionPptxSequentialPatch';"), 'The sequential PowerPoint patch is enabled in the production app.');
verify(controls.includes('Xuất PowerPoint'), 'Question Studio exposes a visible PowerPoint export action.');
verify(controls.includes('Bấm để hiện đáp án'), 'The UI explains the click-to-reveal presentation behavior.');
verify(controls.includes('Xóa bộ câu hỏi đang chọn'), 'Question Studio exposes a delete control for the selected question bank.');
verify(controls.includes('window.confirm('), 'Deleting a question bank requires explicit confirmation.');
verify(controls.includes('localStorage.setItem(storageKey(ownerUid), JSON.stringify(remaining))'), 'Deleting a bank persists the remaining owner-scoped banks.');
verify(controls.includes('window.location.reload()'), 'The Question Studio interface refreshes immediately after a bank is deleted.');
verify(app.includes('<QuestionStudioPptxExport />'), 'PowerPoint export is mounted directly inside the ten-type Question Studio page.');
verify(packageJson.dependencies.pptxgenjs === '^4.0.1', 'The browser build pins the supported PptxGenJS release.');
verify(packageJson.scripts['test:question-pptx'].includes('test-question-pptx-export.ts'), 'The PowerPoint regression test is available to CI.');

console.info(`Question Studio PowerPoint sequential export and bank deletion: ${checks} checks passed.`);
