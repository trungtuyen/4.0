export function describeExamAccessError(error: unknown, action: 'login' | 'schedule' | 'publish'): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code).replace(/^firestore\//, '') : '';
  if (code === 'permission-denied') {
    return action === 'publish'
      ? 'Chưa thể công bố kỳ thi vì Firebase chưa cho phép lưu lịch thi và đề thi bảo mật. Giáo viên cần báo quản trị viên cập nhật quyền Firebase, sau đó thử mở thi lại.'
      : 'Hệ thống chưa cấp quyền truy cập kỳ thi. Em hãy báo giáo viên để quản trị viên cập nhật quyền Firebase và mở lại kỳ thi.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Chưa kết nối được máy chủ kỳ thi. Hãy kiểm tra mạng và thử lại.';
  }
  if (error instanceof RangeError || (error instanceof Error && error.name === 'OperationError')) {
    return 'Mã kỳ thi không hợp lệ hoặc đề thi cần được giáo viên công bố lại. Hãy kiểm tra mã đã nhập.';
  }
  return action === 'publish'
    ? 'Không thể lưu và công bố kỳ thi. Hãy kiểm tra tài khoản, kết nối mạng và thử lại.'
    : 'Không thể mở bài kiểm tra. Hãy kiểm tra mã kỳ thi và thử lại.';
}
