<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lớp Học Thông Minh 4.0

Nền tảng trò chơi và công cụ giáo dục tương tác dành cho giáo viên, tích hợp camera và nhận diện cử chỉ ngay trên trình duyệt.

Website: <https://trungtuyen.github.io/4.0/>

## Danh mục 12 ứng dụng

| Ứng dụng | Mục đích | Điều kiện hoạt động |
| --- | --- | --- |
| GestureCore Edu | Trắc nghiệm, lật thẻ và chọn học sinh bằng cử chỉ tay | Trình duyệt, camera |
| Vòng quay may mắn | Chọn học sinh hoặc phần thưởng ngẫu nhiên | Trình duyệt |
| Bốc thẻ tương tác | Bốc và lật thẻ trong hoạt động trên lớp | Trình duyệt |
| Tương tác thẻ Plicker | Quản lý câu hỏi, lớp học và nhận diện thẻ đáp án | Firebase; quét AI cần máy chủ riêng |
| Tường học tập | Chia sẻ bài làm, nhận xét và học liệu | Firebase Authentication và Firestore |
| Lắc đầu chọn đáp án | Trả lời câu hỏi bằng chuyển động đầu | Trình duyệt, camera; tạo câu hỏi AI cần máy chủ |
| Tư vấn học đường AI | Hỗ trợ phân tích và trao đổi về tình huống học đường | Máy chủ AI riêng |
| Quản lý kỳ thi | Tạo đề, tổ chức thi và tổng hợp kết quả | Firebase; chấm phiếu OMR cần máy chủ AI |
| Mở ô bí mật | Tổ chức trò chơi câu hỏi hoặc phần thưởng | Trình duyệt |
| Kéo thả đúng chỗ | Tạo bài tập kéo thả đáp án | Trình duyệt |
| Gộp tệp Excel | Ghép dữ liệu từ nhiều bảng tính | Trình duyệt |
| Gộp tệp PDF | Ghép nhiều tài liệu PDF | Trình duyệt |

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

## Chạy tại máy tính

Yêu cầu Node.js 20 trở lên.

```bash
npm install --legacy-peer-deps
npm run dev
```

Máy chủ phát triển chạy tại `http://localhost:3000`. Để sử dụng các chức năng AI, đặt biến môi trường `GEMINI_API_KEY` **chỉ trên máy chủ**. Không đưa khóa API vào mã frontend, GitHub Pages hoặc biến có tiền tố `VITE_`.

## GitHub Pages và máy chủ AI

GitHub Pages chỉ triển khai giao diện tĩnh; các địa chỉ `/api/chat`, `/api/scan`, `/api/generate-questions` và `/api/scan-plicker` không tự hoạt động tại đây.

1. Triển khai `server.ts` lên dịch vụ có khả năng chạy Node.js và HTTPS.
2. Khai báo `GEMINI_API_KEY` trong biến môi trường riêng của máy chủ.
3. Nếu cần, đặt `ALLOWED_ORIGINS=https://trungtuyen.github.io` trên máy chủ.
4. Khai báo GitHub repository variable `VITE_API_BASE_URL` bằng địa chỉ máy chủ HTTPS; hoặc mở **Tư vấn học đường AI → Cấu hình máy chủ AI** để lưu địa chỉ riêng cho trình duyệt.
5. Kiểm tra endpoint `/api/health`; trường `aiConfigured` cho biết máy chủ đã nhận khóa API hay chưa, nhưng không tiết lộ khóa.

## Tài khoản giáo viên và quản trị

- Đăng nhập sử dụng Firebase Authentication; ứng dụng không lưu mật khẩu dưới dạng văn bản trong Firestore.
- Quản trị viên có thể đăng nhập bằng Google hoặc bằng email đã xác minh.
- Khai báo repository variable `VITE_ADMIN_EMAIL` để ánh xạ tên đăng nhập `admin` đến email quản trị đã xác minh; không ghi cứng địa chỉ quản trị trong mã nguồn frontend.
- Giáo viên mới được tạo ở trạng thái chờ duyệt; quản trị viên phải kích hoạt trước khi sử dụng thư viện.
- Chức năng khôi phục mật khẩu gửi liên kết bảo mật qua Firebase, không hiển thị hoặc đặt trực tiếp mật khẩu.
- `firestore.rules` trong kho chỉ có hiệu lực sau khi được quản trị viên Firebase kiểm tra và triển khai.
- Luồng thi của học sinh hiện chưa có tài khoản Firebase riêng; cần hoàn thiện xác thực học sinh trước khi khóa toàn bộ quyền đọc và ghi công khai còn lại.

## Lộ trình tiếp theo

1. Triển khai máy chủ AI, cấu hình tên miền Firebase và kiểm thử đăng nhập quản trị trên website thật.
2. Hoàn thiện xác thực học sinh, phân quyền theo trường/lớp và bảo vệ dữ liệu cá nhân.
3. Nâng cấp Plicker, chấm phiếu OMR, ngân hàng câu hỏi và báo cáo kết quả theo lớp.
4. Bổ sung quản lý trường học, gói sử dụng, thanh toán và thống kê thực tế.
5. Đo độ trễ, độ chính xác và mức ổn định AGSA để phục vụ hồ sơ nghiên cứu khoa học.

## Kiểm tra

```bash
npm run lint
npm run test:gesture
npm run test:platform
npm run build
```
