export type EcosystemDependency = 'browser' | 'firebase' | 'ai-cloud' | 'ai-server';

export type EcosystemApplicationId =
  | 'gesture-core'
  | 'gesture-class'
  | 'lucky-draw'
  | 'lucky-draw-cards'
  | 'plicker'
  | 'learning-wall'
  | 'head-shake-game'
  | 'chatbot'
  | 'exam-manager'
  | 'secret-box'
  | 'drag-drop-game'
  | 'excel-merger'
  | 'pdf-merger';

export interface EcosystemApplication {
  id: EcosystemApplicationId;
  name: string;
  description: string;
  dependency: EcosystemDependency;
  category: 'Cử chỉ' | 'Trò chơi' | 'Đánh giá' | 'Quản lý' | 'Công cụ';
}

export const ECOSYSTEM_APPLICATIONS: EcosystemApplication[] = [
  {
    id: 'gesture-core',
    name: 'GestureCore Edu',
    description: 'Trắc nghiệm, lật thẻ và chọn học sinh bằng cử chỉ bàn tay được ổn định bằng AGSA.',
    dependency: 'browser',
    category: 'Cử chỉ',
  },
  {
    id: 'gesture-class',
    name: 'GestureClass',
    description: 'Quản lý lớp, ngân hàng câu hỏi và tổ chức trắc nghiệm, lật thẻ, gọi tên bằng cử chỉ bàn tay.',
    dependency: 'browser',
    category: 'Cử chỉ',
  },
  {
    id: 'lucky-draw',
    name: 'Vòng quay may mắn',
    description: 'Chọn học sinh ngẫu nhiên bằng vòng quay, hỗ trợ nhập danh sách và điều khiển bằng camera.',
    dependency: 'browser',
    category: 'Trò chơi',
  },
  {
    id: 'lucky-draw-cards',
    name: 'Bốc thẻ tương tác',
    description: 'Bốc thẻ ngẫu nhiên với hiệu ứng lật thẻ và danh sách học sinh tùy chỉnh.',
    dependency: 'browser',
    category: 'Trò chơi',
  },
  {
    id: 'plicker',
    name: 'Tương tác thẻ Plicker',
    description: 'Soạn câu hỏi, quản lý lớp và nhận diện thẻ qua camera ngay trên thiết bị.',
    dependency: 'firebase',
    category: 'Đánh giá',
  },
  {
    id: 'learning-wall',
    name: 'Tường học tập',
    description: 'Chia sẻ sản phẩm học tập, nhận xét và tổ chức nội dung theo lớp học.',
    dependency: 'firebase',
    category: 'Quản lý',
  },
  {
    id: 'head-shake-game',
    name: 'Lắc đầu chọn đáp án',
    description: 'Trả lời bằng chuyển động đầu; hỗ trợ nhập câu hỏi thủ công và từ Excel.',
    dependency: 'browser',
    category: 'Cử chỉ',
  },
  {
    id: 'chatbot',
    name: 'Tư vấn học đường AI',
    description: 'Tư vấn tình huống học đường bằng Google Gemini, tự động dự phòng khi mất kết nối.',
    dependency: 'ai-cloud',
    category: 'Công cụ',
  },
  {
    id: 'exam-manager',
    name: 'Quản lý kỳ thi',
    description: 'Tạo đề, quản lý lớp, tổ chức thi, theo dõi bài làm và tổng hợp kết quả.',
    dependency: 'firebase',
    category: 'Đánh giá',
  },
  {
    id: 'secret-box',
    name: 'Mở ô bí mật',
    description: 'Tổ chức trò chơi theo đội, mở câu hỏi ẩn và theo dõi điểm số trên lớp.',
    dependency: 'browser',
    category: 'Trò chơi',
  },
  {
    id: 'drag-drop-game',
    name: 'Kéo thả đúng chỗ',
    description: 'Tạo bài tập kéo thả nhãn lên bản đồ, hình ảnh hoặc sơ đồ kiến thức.',
    dependency: 'browser',
    category: 'Trò chơi',
  },
  {
    id: 'excel-merger',
    name: 'Gộp tệp Excel',
    description: 'Gộp dữ liệu từ nhiều bảng tính ngay trên thiết bị mà không tải tệp lên máy chủ.',
    dependency: 'browser',
    category: 'Công cụ',
  },
  {
    id: 'pdf-merger',
    name: 'Tách, gộp file PDF',
    description: 'Tách từng trang, trích khoảng trang hoặc gộp nhiều PDF an toàn ngay trên thiết bị.',
    dependency: 'browser',
    category: 'Công cụ',
  },
];

export const ECOSYSTEM_DEPENDENCY_LABELS: Record<EcosystemDependency, string> = {
  browser: 'Chạy trên trình duyệt',
  firebase: 'Cần dữ liệu Firebase',
  'ai-cloud': 'AI Google Gemini',
  'ai-server': 'Cần máy chủ AI',
};
