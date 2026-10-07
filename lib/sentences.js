// Trả về danh sách câu { start, end, text } (giây, tính từ đầu file audio của part).
// - Dữ liệu mới: dùng lesson.segments do Whisper trả về.
// - Dữ liệu cũ (chưa có segments): tách câu theo dấu chấm và ước lượng thời gian theo độ dài chữ.
export function getSentences(lesson) {
  if (Array.isArray(lesson.segments) && lesson.segments.length > 0) {
    return lesson.segments.map((s) => ({ start: s.start, end: s.end, text: s.text, vi: s.vi }));
  }

  const parts = lesson.text
    .split(/(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const totalChars = parts.reduce((sum, t) => sum + t.length, 0) || 1;

  let cursor = 0;
  return parts.map((text) => {
    const start = cursor;
    cursor += (text.length / totalChars) * lesson.duration_seconds;
    return { start, end: cursor, text };
  });
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
