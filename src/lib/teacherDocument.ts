import JSZip from 'jszip';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type TeacherIntegrationMode =
  | 'digital-competency'
  | 'ai-competency'
  | 'digital-ai'
  | 'inclusive-education'
  | 'integrated'
  | 'ai-lesson-plan';

export interface TeacherDocumentRow {
  rowIndex: number;
  cells: string[];
  text: string;
}

export interface TeacherDocumentAnalysis {
  fileName: string;
  rows: TeacherDocumentRow[];
}

export interface TeacherIntegrationSuggestion {
  id: string;
  rowIndex: number;
  lesson: string;
  code: string;
  content: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  approved: boolean;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getWordText(element: Element): string {
  return normalizeText(
    Array.from(element.getElementsByTagNameNS(WORD_NS, 't'))
      .map(node => node.textContent || '')
      .join(' '),
  );
}

async function loadDocumentXml(file: File): Promise<{ zip: JSZip; xml: XMLDocument }> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('Vui lòng chọn đúng tệp Microsoft Word định dạng .docx.');
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) {
    throw new Error('Không đọc được cấu trúc Word. Tệp có thể bị hỏng hoặc không phải DOCX chuẩn.');
  }

  const xmlText = await documentEntry.async('string');
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Không thể phân tích cấu trúc XML bên trong tệp Word.');
  }

  return { zip, xml };
}

export async function parseTeacherDocx(file: File): Promise<TeacherDocumentAnalysis> {
  const { xml } = await loadDocumentXml(file);
  const tableRows = Array.from(xml.getElementsByTagNameNS(WORD_NS, 'tr'));

  const rows = tableRows
    .map((row, rowIndex): TeacherDocumentRow => {
      const cells = Array.from(row.getElementsByTagNameNS(WORD_NS, 'tc'))
        .map(getWordText)
        .map(normalizeText);
      return {
        rowIndex,
        cells,
        text: normalizeText(cells.join(' | ')),
      };
    })
    .filter(row => row.cells.length >= 2 && row.text.length >= 8);

  if (rows.length === 0) {
    throw new Error('Chưa tìm thấy bảng nội dung để phân tích. Bản đầu tiên hỗ trợ tốt nhất KHGD/PPCT/Phụ lục được trình bày bằng bảng.');
  }

  return { fileName: file.name, rows };
}

function createWordElement(xml: XMLDocument, localName: string): Element {
  return xml.createElementNS(WORD_NS, `w:${localName}`);
}

function buildIntegrationParagraph(
  xml: XMLDocument,
  targetCell: Element,
  suggestion: TeacherIntegrationSuggestion,
): Element {
  const paragraph = createWordElement(xml, 'p');
  const existingParagraphs = Array.from(targetCell.getElementsByTagNameNS(WORD_NS, 'p'));
  const lastParagraph = existingParagraphs.at(-1);
  const paragraphProperties = lastParagraph?.getElementsByTagNameNS(WORD_NS, 'pPr')[0];
  if (paragraphProperties) {
    paragraph.appendChild(paragraphProperties.cloneNode(true));
  }

  const run = createWordElement(xml, 'r');
  const text = createWordElement(xml, 't');
  text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  const codePrefix = suggestion.code.trim() ? `${suggestion.code.trim()}: ` : '';
  text.textContent = `${codePrefix}${suggestion.content.trim()}`;
  run.appendChild(text);
  paragraph.appendChild(run);
  return paragraph;
}

export async function createIntegratedTeacherDocx(
  originalFile: File,
  suggestions: readonly TeacherIntegrationSuggestion[],
): Promise<Blob> {
  const { zip, xml } = await loadDocumentXml(originalFile);
  const rows = Array.from(xml.getElementsByTagNameNS(WORD_NS, 'tr'));
  const approved = suggestions.filter(item => item.approved && item.content.trim());

  if (approved.length === 0) {
    throw new Error('Hãy chọn ít nhất một đề xuất trước khi tạo file Word.');
  }

  for (const suggestion of approved) {
    const row = rows[suggestion.rowIndex];
    if (!row) continue;
    const cells = Array.from(row.getElementsByTagNameNS(WORD_NS, 'tc'));
    const targetCell = cells.at(-1);
    if (!targetCell) continue;
    targetCell.appendChild(buildIntegrationParagraph(xml, targetCell, suggestion));
  }

  const documentXml = new XMLSerializer().serializeToString(xml);
  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: DOCX_MIME,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export function buildIntegratedFileName(originalName: string): string {
  const stem = originalName.replace(/\.docx$/i, '');
  return `${stem}_AI_tich_hop.docx`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
