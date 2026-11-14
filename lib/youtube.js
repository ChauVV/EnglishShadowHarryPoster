// Tiện ích dùng chung (client + server) cho tính năng học từ link YouTube.

const ID_RE = /^[\w-]{11}$/;

// Dịch vụ phụ đề chỉ trả mốc thời gian theo giây NGUYÊN (làm tròn xuống), nên giọng nói thật trung bình muộn hơn nửa giây.
export const TIMING_SHIFT = 0.5;
export const shiftLines = (lines, by = TIMING_SHIFT) => lines.map((l) => ({ ...l, start: l.start + by, end: l.end + by }));

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
const TS_LINE = /^\s*(?:[-*>]\s*)?[[(*_`]*\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*[\])*_`]*\s*[-–—:]?\s*(.*)$/;

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
  // Mốc chỉ là số nguyên: thời điểm thật nằm trong giây đó nên cộng bù; nếu có phần thập phân thì giữ nguyên
  const shift = raw.length > 0 && raw.every((r) => Number.isInteger(r.start)) ? TIMING_SHIFT : 0;
  return raw.map((s, i) => ({
    start: s.start + shift,
    end: i + 1 < raw.length ? Math.max(raw[i + 1].start, s.start + 0.5) + shift : s.start + shift + 5,
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

const CLAUSE_END = /,["'”’)\]]*$/;

// Ghép các dòng phụ đề thành câu ngắn để luyện shadowing, giữ mốc thời gian đầu/cuối.
// Ngắt khi: hết câu (. ? !), hoặc gặp dấu phẩy khi đã đủ dài, hoặc thêm dòng nữa sẽ quá dài / quá lâu.
// Luôn ngắt ở ranh giới giữa hai dòng phụ đề nên mốc thời gian vẫn chính xác.
export function mergeSentences(segments, { maxChars = 80, maxSeconds = 6, commaBreakChars = 35 } = {}) {
  const out = [];
  let cur = null;
  const flush = () => {
    if (cur) out.push(cur);
    cur = null;
  };
  for (const s of segments) {
    if (cur && (cur.text.length + 1 + s.text.length > maxChars || s.end - cur.start > maxSeconds)) flush();
    if (!cur) cur = { start: s.start, end: s.end, text: s.text };
    else {
      cur.text += ` ${s.text}`;
      cur.end = s.end;
    }
    if (SENTENCE_END.test(cur.text) || (cur.text.length >= commaBreakChars && CLAUSE_END.test(cur.text))) flush();
  }
  flush();
  return out.map((s) => ({ ...s, vi: '' }));
}

// Phiên bản cách chia câu. Bài đã lưu bằng phiên bản cũ hơn sẽ được tự chia lại khi mở.
export const SEG_VERSION = 4;

const PUNCT_WORD = /[.?!,;:]["'”’)\]]*$/;

// Chia một câu dài thành các đoạn <= maxChars, ưu tiên ngắt sau dấu câu khi đoạn đã đủ dài
function splitText(text, maxChars, minChunk) {
  const chunks = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (cur && cur.length + 1 + word.length > maxChars) {
      chunks.push(cur);
      cur = '';
    }
    cur = cur ? `${cur} ${word}` : word;
    if (cur.length >= minChunk && PUNCT_WORD.test(word)) {
      chunks.push(cur);
      cur = '';
    }
  }
  if (cur) {
    const last = chunks.length - 1;
    // Phần dư quá ngắn thì gộp vào đoạn trước
    if (last >= 0 && cur.length < 15 && chunks[last].length + 1 + cur.length <= maxChars * 1.3) chunks[last] += ` ${cur}`;
    else chunks.push(cur);
  }
  return chunks;
}

// Chia lại các câu đã ghép quá dài (bài tạo bằng cách chia cũ). Không còn dòng phụ đề gốc nên thời gian
// của từng đoạn mới được ước lượng theo số ký tự; câu ngắn giữ nguyên cả bản dịch.
export function resplitSentences(sentences, { maxChars = 80, minChunk = 35 } = {}) {
  const out = [];
  for (const s of sentences) {
    const chunks = s.text.length > maxChars ? splitText(s.text, maxChars, minChunk) : [s.text];
    if (chunks.length < 2) {
      out.push(s);
      continue;
    }
    const total = chunks.reduce((n, c) => n + c.length, 0) || 1;
    const span = s.end - s.start;
    let done = 0;
    chunks.forEach((text, i) => {
      const start = s.start + (span * done) / total;
      done += text.length;
      const end = i === chunks.length - 1 ? s.end : s.start + (span * done) / total;
      out.push({ start, end, text, vi: '' });
    });
  }
  return out;
}

// Chuẩn hóa một từ để so khớp: chữ thường, bỏ dấu câu
const norm = (word) => word.toLowerCase().replace(/[^a-z0-9À-ỹ]/g, '');

// Dựng danh sách câu từ kết quả AI: pieces = [{ from, en, vi }], lines = [{ start, end, text }] (dòng phụ đề gốc).
// Thời điểm bắt đầu của mỗi câu được tính bằng cách canh khớp TỪNG TỪ của câu với từng từ của các dòng gốc
// (thời điểm của từ = nội suy trong dòng chứa nó), nên câu bắt đầu giữa dòng vẫn đúng chứ không bị sớm cả dòng.
// `from` (dòng AI báo câu bắt đầu) chỉ dùng làm gợi ý khi bị lệch đồng bộ nặng.
export function buildSentences(lines, pieces) {
  if (!lines.length || !pieces.length) return [];

  const words = []; // { norm, time }
  const lineFirstWord = [];
  lines.forEach((line, li) => {
    const tokens = line.text.split(/\s+/).filter(Boolean);
    const span = Math.max(0.5, (lines[li + 1] ? lines[li + 1].start : line.end) - line.start);
    lineFirstWord[li] = words.length;
    tokens.forEach((token, i) => words.push({ norm: norm(token), time: line.start + (span * i) / tokens.length }));
  });
  if (!words.length) return [];

  const matches = (pos, probe, need) => probe.reduce((n, w, i) => n + (words[pos + i]?.norm === w ? 1 : 0), 0) >= need;
  const list = pieces.map((p) => ({ from: Math.trunc(Number(p.from)) || 0, en: String(p.en ?? '').trim(), vi: String(p.vi ?? '').trim() }));

  let pointer = 0;
  const starts = [];
  for (const piece of list) {
    const tokens = piece.en.split(/\s+/).map(norm).filter(Boolean);
    const probe = tokens.slice(0, 3);
    if (probe.length > 0) {
      // Tìm vị trí câu bắt đầu gần chỗ dự kiến (ngay sau câu trước): ưu tiên khớp đủ 3 từ đầu, rồi mới nới còn 2 từ
      let found = null;
      for (const need of [probe.length, Math.min(2, probe.length)]) {
        for (let d = 0; d <= 8 && found === null; d++) {
          for (const pos of d === 0 ? [pointer] : [pointer + d, pointer - d]) {
            if (pos >= 0 && pos < words.length && matches(pos, probe, need)) {
              found = pos;
              break;
            }
          }
        }
        if (found !== null) break;
      }
      const hint = lineFirstWord[Math.min(Math.max(piece.from, 0), lines.length - 1)] ?? pointer;
      if (found !== null) pointer = found;
      else if (Math.abs(hint - pointer) > 12) pointer = hint; // mất đồng bộ nặng (AI viết lại nhiều chữ): dùng gợi ý của AI
    }
    const time = words[Math.min(pointer, words.length - 1)].time;
    starts.push(starts.length ? Math.max(time, starts[starts.length - 1]) : time);
    pointer += tokens.length;
  }

  const lastEnd = lines[lines.length - 1].end;
  return list.map((piece, k) => {
    const start = starts[k];
    const end = k + 1 < list.length ? starts[k + 1] : lastEnd;
    return { start, end: Math.max(end, start + 0.3), text: piece.en, vi: piece.vi || '—' };
  });
}
