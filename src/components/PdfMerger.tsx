import React, { useState } from 'react';
import { Upload, ArrowLeft, FileText, X, Download, AlertCircle, CheckCircle2, File } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'motion/react';

interface PdfMergerProps {
  onBack: () => void;
}

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

export default function PdfMerger({ onBack }: PdfMergerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        status: 'pending' as const
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setMergedPdfUrl(null);
  };

  const mergePdfs = async () => {
    if (files.length < 2) {
      alert('Vui lòng chọn ít nhất 2 tệp PDF để gộp.');
      return;
    }
    
    setIsMerging(true);
    setMergedPdfUrl(null);
    
    try {
      const mergedPdf = await PDFDocument.create();
      const updatedFiles = [...files];

      for (let i = 0; i < updatedFiles.length; i++) {
        const item = updatedFiles[i];
        item.status = 'processing';
        setFiles([...updatedFiles]);

        try {
          const pdfBytes = await item.file.arrayBuffer();
          const pdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          
          item.status = 'done';
        } catch (err) {
          console.error(`Error processing ${item.name}:`, err);
          item.status = 'error';
          item.errorMessage = 'Không thể đọc hoặc xử lý file';
        }
        setFiles([...updatedFiles]);
      }

      if (updatedFiles.some(f => f.status === 'error')) {
        throw new Error('Một số tệp gặp lỗi trong quá trình xử lý.');
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setMergedPdfUrl(url);
    } catch (error) {
      console.error("Merge error:", error);
      alert(error instanceof Error ? error.message : 'Có lỗi xảy ra khi gộp PDF.');
    } finally {
      setIsMerging(false);
    }
  };

  const downloadMerged = () => {
    if (!mergedPdfUrl) return;
    const link = document.createElement('a');
    link.href = mergedPdfUrl;
    link.download = "merged_documents.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-red-600" />
            Gộp nhiều file PDF
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-12 flex justify-center bg-slate-200/50">
        <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl rounded-sm border border-slate-300 p-8 md:p-16 flex flex-col">
          <div className="flex-1 space-y-8">
            <div className="text-center">
              <div className="inline-flex p-3 bg-red-50 rounded-full mb-4">
                <FileText className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Tải lên các tệp PDF cần gộp</h2>
              <p className="text-slate-500 max-w-md mx-auto">Các tệp sẽ được gộp theo thứ tự từ trên xuống dưới trong danh sách bạn đã chọn.</p>
            </div>

            <div 
              className="border-2 border-dashed border-slate-300 rounded-2xl p-10 md:p-16 flex flex-col items-center justify-center bg-slate-50 hover:bg-red-50/30 hover:border-red-200 transition-all cursor-pointer relative group"
              onClick={() => document.getElementById('pdf-upload')?.click()}
            >
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Upload className="w-10 h-10" />
              </div>
              <p className="text-slate-800 font-bold text-lg mb-2">Kéo và thả tệp PDF vào đây</p>
              <p className="text-slate-500 text-sm mb-4">Hoặc nhấn để chọn tệp từ máy tính</p>
              <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600 transition-colors shadow-sm">
                Chọn tệp PDF
              </div>
              <input 
                id="pdf-upload"
                type="file" 
                multiple
                accept=".pdf"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {files.length > 0 && (
              <div className="pt-4">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-lg">Danh sách tệp ({files.length})</h3>
                  <button 
                    onClick={() => {
                        setFiles([]);
                        setMergedPdfUrl(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Xóa tất cả
                  </button>
                </div>
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {files.map((file, idx) => (
                      <motion.div 
                        key={file.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-red-200 transition-colors group"
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className="w-12 h-12 bg-white border border-slate-200 text-red-600 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs shadow-sm">
                            {idx + 1}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-slate-800 text-sm truncate">{file.name}</p>
                            <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {file.status === 'processing' && (
                            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          )}
                          {file.status === 'done' && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          )}
                          {file.status === 'error' && (
                            <div title={file.errorMessage}>
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            </div>
                          )}
                          <button 
                            onClick={() => removeFile(file.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="mt-12 flex flex-col gap-4">
                  <button 
                    disabled={isMerging || files.length < 2}
                    onClick={mergePdfs}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98]"
                  >
                    {isMerging ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Đang gộp tài liệu...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Gộp thành môt file PDF duy nhất
                      </>
                    )}
                  </button>
                  
                  {mergedPdfUrl && (
                    <motion.button 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={downloadMerged}
                      className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-[0.98]"
                    >
                      <Download className="w-5 h-5" />
                      Tải file PDF kết quả
                    </motion.button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-16">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Hướng dẫn & Lưu ý
              </h4>
              <ul className="text-slate-600 text-sm space-y-2 list-disc pl-5">
                <li>Vui lòng kiểm tra kỹ thứ tự các tệp trước khi nhấn gộp.</li>
                <li>Hệ thống hỗ trợ gộp nhiều tệp cùng lúc với tốc độ xử lý nhanh.</li>
                <li>Dữ liệu được xử lý tại chỗ, đảm bảo không rò rỉ thông tin cá nhân.</li>
                <li>Nếu các tệp có kích thước trang khác nhau, chúng vẫn sẽ được giữ nguyên trong file đích.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
