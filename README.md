<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lớp Học Thông Minh 4.0

Nền tảng trò chơi và công cụ giáo dục tương tác dành cho giáo viên, tích hợp camera và nhận diện cử chỉ ngay trên trình duyệt.

Website: <https://trungtuyen.github.io/4.0/>

## Danh mục 13 ứng dụng

| Ứng dụng | Mục đích | Điều kiện hoạt động |
| --- | --- | --- |
| GestureCore Edu | Trắc nghiệm, lật thẻ và chọn học sinh bằng cử chỉ tay | Trình duyệt, camera |
| GestureClass | Quản lý lớp, ngân hàng câu hỏi, trắc nghiệm cử chỉ, lật thẻ và gọi tên | Trình duyệt, camera |
| Vòng quay may mắn | Chọn học sinh hoặc phần thưởng ngẫu nhiên | Trình duyệt |
| Bốc thẻ tương tác | Bốc và lật thẻ trong hoạt động trên lớp | Trình duyệt |
| Tương tác thẻ Plicker | Quản lý câu hỏi, lớp học và nhận diện thẻ đáp án | Firebase; nhận diện camera trực tiếp trên thiết bị |
| Tường học tập | Chia sẻ bài làm, nhận xét và học liệu | Firebase Authentication và Firestore |
| Lắc đầu chọn đáp án | Trả lời câu hỏi bằng chuyển động đầu | Trình duyệt, camera; tự tạo câu hỏi ngay trên GitHub Pages |
| Tư vấn học đường AI | Hỗ trợ phân tích và trao đổi về tình huống học đường | Google Gemini qua Firebase AI Logic; có dự phòng trên thiết bị |
| Quản lý kỳ thi | Tạo đề, tổ chức thi và tổng hợp kết quả | Firebase; chấm phiếu OMR cần máy chủ AI |
| Mở ô bí mật | Tổ chức trò chơi câu hỏi hoặc phần thưởng | Trình duyệt |
| Kéo thả đúng chỗ | Tạo bài tập kéo thả đáp án | Trình duyệt |
| Gộp tệp Excel | Ghép dữ liệu từ nhiều bảng tính | Trình duyệt |
| Gộp tệp PDF | Ghép nhiều tài liệu PDF | Trình duyệt |

## Cổng thi học sinh

Trang đăng nhập học sinh sử dụng bố cục quyển sách hai trang, tối ưu cho cả máy tính và điện thoại. Trang trái là biểu mẫu đăng nhập; trang phải tự động truy xuất các kỳ thi có trạng thái **Đang mở** từ Firestore, hiển thị lịch bắt đầu, thời lượng, số câu hỏi và trạng thái **Đang mở/Sắp diễn ra**. Kỳ thi bản nháp hoặc đã đóng không xuất hiện trong thông báo; mã đăng nhập vẫn được giáo viên cung cấp riêng cho học sinh.

## Thống kê cộng đồng tại chân trang

Chân trang hiển thị tám chỉ số: **lượt truy cập, trường đăng ký, giáo viên tham gia, người đang trực tuyến, lớp học, học sinh, kỳ thi và số ứng dụng giáo dục**. Số liệu lớp, học sinh và kỳ thi sử dụng truy vấn đếm của Firestore, không tải danh sách hoặc công khai hồ sơ cá nhân.

- Khi quản trị viên đăng nhập, ứng dụng tổng hợp số lượng giáo viên, giáo viên đang hoạt động và số trường khác nhau. Bộ nhớ trên thiết bị và tài liệu `platform_stats/overview`, nếu Firebase đã cấp quyền phù hợp, chỉ chứa số lượng; không chứa tên, email hay danh sách trường.
- Bộ đếm `platform_stats/traffic`, nếu được quản trị viên Firebase cấu hình riêng, sử dụng giao dịch nguyên tử; trình duyệt ghi nhận tối đa một lượt cho mỗi phiên.
- `platform_presence/{visitorId}` lưu mã trình duyệt ngẫu nhiên và thời điểm hoạt động gần nhất; không lưu IP, email, vị trí hay thông tin thiết bị. Một phiên quá 90 giây không cập nhật sẽ không được tính đang trực tuyến.
- Nếu Firebase chưa cấp quyền thống kê riêng hoặc mất kết nối, số lượt truy cập và trạng thái trực tuyến tự chuyển sang dữ liệu trên thiết bị; các số chưa xác minh hiển thị `—`, không tạo số liệu giả.
- Tính năng không thay đổi quy tắc Firestore hiện có và không mở thêm quyền công khai đối với dữ liệu giáo viên, học sinh hoặc bài thi. Sau khi đăng nhập quản trị, số giáo viên và trường đã xác minh vẫn hiển thị trên chính thiết bị đó.

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

## GestureClass — lớp học tương tác

GestureClass là ứng dụng độc lập trong danh mục chung và thư viện quản trị. Mô-đun sử dụng cùng phiên truy cập của hệ sinh thái, xử lý camera trực tiếp trên thiết bị và không yêu cầu máy chủ riêng.

- Quản lý ngân hàng câu hỏi và danh sách lớp học.
- Nhập câu hỏi Excel/CSV và xuất CSV.
- Trắc nghiệm bằng 1–4 ngón tay, chuột hoặc bàn phím.
- Lật thẻ ôn tập và gọi học sinh ngẫu nhiên.
- Đường dẫn trực tiếp: <https://trungtuyen.github.io/4.0/gestureclass/>.

## Chạy tại máy tính

Yêu cầu Node.js 20 trở lên.

```bash
npm install --legacy-peer-deps
npm run dev
```

Máy chủ phát triển chạy tại `http://localhost:3000`. Tư vấn học đường sử dụng mặc định **Google Gemini 3.1 Flash-Lite** qua Firebase AI Logic; không cần vận hành máy chủ Node.js riêng. Nếu tự triển khai máy chủ tùy chọn, đặt biến môi trường `GEMINI_API_KEY` **chỉ trên máy chủ**. Không đưa khóa API Gemini vào mã frontend, GitHub Pages hoặc biến có tiền tố `VITE_`.

## Google Gemini, Firebase AI Logic và GitHub Pages

GitHub Pages chỉ triển khai giao diện tĩnh. Để dùng AI đám mây an toàn, ứng dụng gọi **Google Gemini 3.1 Flash-Lite** thông qua Firebase AI Logic; dịch vụ trung gian của Firebase giữ khóa Gemini phía máy chủ thay vì nhúng khóa vào trình duyệt.

- **Tương tác thẻ Plicker:** thuật toán nhận diện thẻ xử lý khung hình ngay trên thiết bị; chỉ sử dụng Firebase để lưu lớp, câu hỏi và đồng bộ buổi học. Không cần máy chủ AI để quét thẻ.
- **Tư vấn học đường AI:** ưu tiên máy chủ riêng nếu quản trị viên chủ động cấu hình; mặc định sử dụng Google Gemini qua Firebase AI Logic; khi chưa kích hoạt Firebase AI, mất mạng hoặc hết hạn mức, tự động dùng AI trong trình duyệt nếu khả dụng rồi chuyển sang bộ tư vấn học đường tích hợp.
- Tình huống có nguy cơ tự gây hại, bạo lực hoặc xâm hại được ưu tiên hướng dẫn an toàn ngay trên thiết bị, kèm số **111**, **113** và **115** phù hợp.

Để kích hoạt **Google Gemini** trên dự án Firebase hiện có:

1. Mở Firebase Console → **AI Services → AI Logic → Get started**.
2. Chọn **Gemini Developer API** để có thể sử dụng hạn mức miễn phí phù hợp.
3. Đăng ký website `https://trungtuyen.github.io` trong **App Check** bằng **reCAPTCHA Enterprise**.
4. Đặt repository variable `VITE_FIREBASE_APP_CHECK_SITE_KEY` bằng site key công khai của reCAPTCHA Enterprise. Không đặt secret key tại đây.
5. Nếu cần đổi model, đặt repository variable `VITE_GOOGLE_AI_MODEL`; mặc định là `gemini-3.1-flash-lite`.
6. Chạy lại workflow GitHub Pages. Khi Firebase AI Logic chưa được kích hoạt, tư vấn tích hợp trên thiết bị vẫn tiếp tục hoạt động.

Riêng ứng dụng **Lắc đầu chọn đáp án** tạo câu hỏi theo ba lớp dự phòng: ưu tiên máy chủ AI đã cấu hình, sau đó sử dụng AI có sẵn trong trình duyệt nếu thiết bị hỗ trợ, cuối cùng dùng bộ tạo câu hỏi theo môn học chạy trực tiếp trên thiết bị. Vì vậy nút **Tạo bằng AI** vẫn hoạt động ngay trên GitHub Pages, không yêu cầu đưa khóa API vào mã frontend. Chế độ trên thiết bị hỗ trợ Toán theo dạng bài và khối lớp, Tin học, AI, Tiếng Việt, Tiếng Anh, Khoa học, Lịch sử, Địa lý, Giáo dục thể chất, môi trường, an toàn giao thông và tài chính cá nhân.

Máy chủ Node.js riêng vẫn là lựa chọn bổ sung cho OMR hoặc hệ thống có yêu cầu riêng: triển khai `server.ts` lên dịch vụ HTTPS, khai báo `GEMINI_API_KEY`, tùy chọn `GEMINI_MODEL=gemini-3.1-flash-lite`, giới hạn `ALLOWED_ORIGINS` và cấu hình `VITE_API_BASE_URL`. Endpoint `/api/health` chỉ công khai tình trạng cấu hình và tên model, không tiết lộ khóa.

## Tài khoản giáo viên và quản trị

- Đăng nhập sử dụng Firebase Authentication; ứng dụng không lưu mật khẩu dưới dạng văn bản trong Firestore.
- Quản trị viên có thể đăng nhập bằng Google hoặc bằng email đã xác minh.
- Repository variable `VITE_ADMIN_EMAIL` là tùy chọn. Nếu chưa cấu hình, khi nhập tên `admin` hãy điền email Firebase của quản trị viên; hoặc đăng nhập bằng Google. Sau khi quyền quản trị được Firebase/Firestore xác minh, trình duyệt ghi nhớ email cho phiên hiện tại.
- Giáo viên mới được tạo ở trạng thái chờ duyệt; quản trị viên phải kích hoạt trước khi sử dụng thư viện.
- Chức năng khôi phục mật khẩu gửi liên kết bảo mật qua Firebase, không hiển thị hoặc đặt trực tiếp mật khẩu.
- `firestore.rules` trong kho chỉ có hiệu lực sau khi được quản trị viên Firebase kiểm tra và triển khai.
- Luồng thi của học sinh hiện chưa có tài khoản Firebase riêng; cần hoàn thiện xác thực học sinh trước khi khóa toàn bộ quyền đọc và ghi công khai còn lại.

## Lộ trình tiếp theo

1. Kích hoạt Firebase AI Logic, đăng ký App Check/reCAPTCHA Enterprise và kiểm thử Google Gemini trên website thật.
2. Hoàn thiện xác thực học sinh, phân quyền theo trường/lớp và bảo vệ dữ liệu cá nhân.
3. Nâng cấp Plicker, chấm phiếu OMR, ngân hàng câu hỏi và báo cáo kết quả theo lớp.
4. Bổ sung quản lý trường học, gói sử dụng, thanh toán và thống kê thực tế.
5. Đo độ trễ, độ chính xác và mức ổn định AGSA để phục vụ hồ sơ nghiên cứu khoa học.

## Kiểm tra

```bash
npm run lint
npm run test:gesture
npm run test:gestureclass
npm run test:platform
npm run test:ai-services
npm run test:platform-metrics
npm run build
```
