// Tiện ích dùng chung (client + server) cho tính năng học từ link YouTube.

const ID_RE = /^[\w-]{11}$/;

// Lấy video id từ link watch / youtu.be / shorts / embed / live, hoặc chính id 11 ký tự.
export function extractVideoId(input) {
  const s = String(input ?? '').trim();
  if (ID_RE.test(s)) return s;
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    const host = u.hostname.replace(/^(www|m)\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else id = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1];
    }
    return id && ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

const toSeconds = (ts) => {
  const p = ts.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

// Dòng có mốc thời gian ở đầu: "[0:05] text", "**0:05** text", "0:05 - text", "(1:02:03) text"...
const TS_LINE = /^\s*(?:[-*>]\s*)?[[(*_`]*\s*(\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*[\])*_`]*\s*[-–—:]?\s*(.*)$/;

// Chuyển transcript dạng Markdown thành [{ start, end, text }] (giây).
// Dòng không có mốc thời gian (tiêu đề, ghi chú) bị bỏ qua.
export function parseTranscript(markdown) {
  const raw = [];
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const m = line.match(TS_LINE);
    if (!m) continue;
    const text = m[2].replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    raw.push({ start: toSeconds(m[1]), text });
  }
  return raw.map((s, i) => ({
    start: s.start,
    end: i + 1 < raw.length ? Math.max(raw[i + 1].start, s.start + 0.5) : s.start + 5,
    text: s.text,
  }));
}

const SENTENCE_END = /[.?!…]["'”’)\]]*$/;

// Phụ đề tự động hầu như không có dấu câu -> cần AI thêm dấu trước khi ghép câu.
export function needsCleaning(segments) {
  if (!segments.length) return false;
  const punctuated = segments.filter((s) => SENTENCE_END.test(s.text)).length;
  return punctuated / segments.length < 0.25;
}

// Ghép các dòng phụ đề thành câu hoàn chỉnh (kết thúc bằng . ? !), giữ mốc thời gian đầu/cuối.
export function mergeSentences(segments, { maxChars = 220 } = {}) {
  const out = [];
  let cur = null;
  for (const s of segments) {
    if (!cur) cur = { start: s.start, end: s.end, text: s.text };
    else {
      cur.text += ` ${s.text}`;
      cur.end = s.end;
    }
    if (SENTENCE_END.test(cur.text) || cur.text.length >= maxChars) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.map((s) => ({ ...s, vi: '' }));
}
