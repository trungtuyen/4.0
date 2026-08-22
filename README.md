<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lớp Học Thông Minh 4.0

Nền tảng trò chơi và công cụ giáo dục tương tác dành cho giáo viên, tích hợp camera và nhận diện cử chỉ ngay trên trình duyệt.

## GestureCore Edu — AGSA

Mô-đun mới cung cấp:

- nhận dạng 1–4 ngón tay để chọn đáp án A–D;
- nắm tay để xác nhận, xòe tay để hủy;
- bộ lọc One Euro giảm rung điểm bàn tay;
- phân loại ngón bằng góc khớp, khoảng cách và ngưỡng kép;
- bỏ phiếu nhiều khung hình có trọng số chất lượng;
- máy trạng thái chống một cử chỉ kích hoạt nhiều lần;
- trắc nghiệm, lật thẻ, chọn học sinh và phòng thử nghiệm AGSA;
- nhập/xuất dữ liệu Excel và lưu cục bộ trên thiết bị.

Video camera được xử lý trong trình duyệt. Ứng dụng không chủ động tải video lên máy chủ.

View your app in AI Studio: https://ai.studio/apps/51fdfd5e-caf8-4640-bdd8-404753ba685e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Kiểm tra

```bash
npm run lint
npm run test:gesture
npm run build
```
