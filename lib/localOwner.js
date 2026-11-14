// Dữ liệu lưu trên trình duyệt (bài đã tạo, ảnh đại diện, key lấy phụ đề, số lượt) thuộc về MỘT tài khoản Google.
// Đăng nhập bằng tài khoản khác trên cùng trình duyệt thì xóa dữ liệu của tài khoản trước, không để người sau thấy hoặc dùng nhầm.
// Bài và ảnh đại diện vẫn còn trong Drive của từng người, đăng nhập lại là tải về lại. Key thì mỗi người nhập lại key của mình.
// Không có owner đã ghi (dữ liệu từ bản cũ): coi như không rõ chủ, cũng xóa rồi tải lại từ Drive.
const OWNER = 'yt-owner';
const NAMES = ['yt-lessons-index', 'yt-quota', 'yt-transcript-key', 'yt-avatar'];
const PREFIXES = ['yt-lesson:', 'yt-raw:'];
// Các sự kiện mà hook trong lib/ytClient.js và lib/avatar.js đang lắng nghe để vẽ lại khi dữ liệu đổi
const EVENTS = ['yt-storage', 'yt-avatar-change'];

export function clearLocalData(storage = window.localStorage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) keys.push(storage.key(i));
  for (const key of keys) {
    if (NAMES.includes(key) || PREFIXES.some((p) => key.startsWith(p))) storage.removeItem(key);
  }
}

// Gọi mỗi khi biết email của tài khoản đang đăng nhập. Trả về true nếu vừa xóa dữ liệu của người khác.
export function claimLocalData(email) {
  const owner = String(email ?? '').trim().toLowerCase();
  if (!owner) return false; // không biết tài khoản nào thì không đụng vào dữ liệu
  try {
    if (window.localStorage.getItem(OWNER) === owner) return false;
    clearLocalData();
    window.localStorage.setItem(OWNER, owner);
  } catch {
    return false; // storage bị chặn: không có dữ liệu nào để lẫn
  }
  for (const name of EVENTS) window.dispatchEvent(new Event(name));
  return true;
}
