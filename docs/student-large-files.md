# Kích hoạt bài nộp tệp lớn

Mã nguồn chuyển tệp tài liệu của học sinh sang Cloud Storage, tải từng phần 8 MB,
hiển thị tiến độ, tiếp tục phiên tải sau lỗi mạng và gửi bài qua máy chủ.
Không đặt giới hạn 320 KB trong ứng dụng khi tính năng được bật.
Cloud Storage vẫn có giới hạn kỹ thuật 5 TiB/tệp; dung lượng và băng thông có tính phí.
Ảnh hiển thị trên bảng tiếp tục được nén. Giữ tối đa 2 tài liệu/bài.

## Trạng thái hiện tại

Dự án `gen-lang-client-0870957273` đang dùng Spark, chưa có Storage hoạt động.
Không bật biến `VITE_WALL_LARGE_UPLOADS` trước khi hoàn tất các bước dưới đây.
Bài và tệp nhỏ đang có vẫn sử dụng được; không cần sửa quyền Firestore đã xuất bản.

## Các bước triển khai

1. Chủ dự án tự bật Blaze và liên kết tài khoản thanh toán trong Firebase Console.
   Thiết lập cảnh báo ngân sách theo nhu cầu; cảnh báo không tự ngăn phát sinh phí.
2. Tạo bucket `gen-lang-client-0870957273.firebasestorage.app`.
   Chọn vị trí phù hợp cho Việt Nam (ví dụ `asia-southeast1`). Bucket không công khai.
3. Đăng nhập Firebase CLI và Google Cloud CLI bằng tài khoản có quyền triển khai.
   Cài phụ thuộc: `npm --prefix functions/wall-uploads install`.
4. Xuất bản: `npx firebase-tools deploy --config firebase.wall-uploads.json --only functions,storage --project gen-lang-client-0870957273`.
   Cấu hình IAM cho tài khoản chạy functions: đọc/ghi đúng cơ sở dữ liệu có tên,
   tạo/đọc/xóa object trong bucket này. Trình triển khai còn cần các quyền Eventarc,
   Scheduler và build theo yêu cầu Firebase CLI.
5. Cấu hình CORS: `gcloud storage buckets update gs://gen-lang-client-0870957273.firebasestorage.app --cors-file=storage.wall-uploads.cors.json`.
6. Thử đầy đủ trên bản xem trước: nộp Word/Excel >1 MB, tải đúng byte trong Chờ duyệt,
   duyệt và tải từ trang chia sẻ; đóng nhận bài và kiểm tra gửi bị từ chối;
   mô phỏng mất mạng rồi gửi lại, xác nhận chỉ có 1 bài.
7. Bật GitHub Actions repository variable `VITE_WALL_LARGE_UPLOADS=true`, rồi triển khai
   website. Biến mặc định tắt để tránh làm gián đoạn bài nộp khi Storage chưa sẵn sàng.

## Quyền và lưu trữ

Học sinh không cần đăng nhập. Máy chủ chỉ mở phiên tải khi bảng được chia sẻ và
cho phép nộp. Phiếu tải là bí mật 256 bit, gắn với lớp và giáo viên; tệp không bị
ghi đè. Khi gửi bài, máy chủ kiểm tra lại quyền nhận bài và kích thước tệp thực tế.
Quyền đọc Chờ duyệt giữ nguyên: chỉ giáo viên quản lý bảng được đọc.
URL tải tệp là liên kết có mã bí mật; người có URL có thể tải tệp. Giáo viên duyệt
thì liên kết mới xuất hiện trên bảng công khai. Không gửi nội dung nhạy cảm.

Phiên chưa gửi hết hạn sau 48 giờ. Tác vụ hàng ngày dọn tệp bỏ dở; tệp hoàn tất muộn
được dọn qua sự kiện Storage. Bài bị giáo viên từ chối được xóa tệp tự động.
Tệp đã được duyệt được giữ lại, kể cả khi xóa bài đăng, để tránh làm hỏng liên kết
tệp được dùng lại. Cần quản lý thời gian giữ tệp và dung lượng bucket khi vận hành.

Khả năng phòng lạm dụng: mã lớp ngẫu nhiên, tạo mới từng object, giới hạn 60 phiên
tải/lớp/phút, tối đa 5 instances cho endpoint. Không có hạn mức chi phí cứng.
Không đặt log chứa học sinh, bài làm, URL phiên tải hoặc mã tải tệp.
