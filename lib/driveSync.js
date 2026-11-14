// Đồng bộ bài đã tạo vào thư mục riêng của app trong Google Drive của người dùng (appDataFolder).
// Mỗi bài là một file "yt-<videoId>.json"; tiêu đề và số câu nằm trong appProperties để liệt kê mà không phải tải file.
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const NAME_RE = /^yt-([\w-]{11})\.json$/;

async function call(token, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (!res.ok) throw new Error(`Drive ${res.status}`);
  return res;
}

// appProperties giới hạn 124 byte cho mỗi cặp khóa+giá trị -> cắt theo byte để không lỗi với tiếng Việt
function fitBytes(text, max) {
  const encoder = new TextEncoder();
  let out = text;
  while (out && encoder.encode(out).length > max) out = out.slice(0, -1);
  return out;
}

const toEntry = (f) => ({
  videoId: f.name.match(NAME_RE)[1],
  fileId: f.id,
  title: f.appProperties?.title || f.name.match(NAME_RE)[1],
  count: Number(f.appProperties?.count ?? 0),
  savedAt: Date.parse(f.modifiedTime) || 0,
});

async function list(token, q) {
  const entries = [];
  let pageToken;
  do {
    const url = new URL(`${API}/files`);
    url.search = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `${q} and trashed = false`,
      fields: 'nextPageToken,files(id,name,modifiedTime,appProperties)',
      pageSize: '200',
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await (await call(token, url)).json();
    for (const f of data.files ?? []) if (NAME_RE.test(f.name)) entries.push(toEntry(f));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return entries;
}

export const listLessons = (token) => list(token, "name contains 'yt-'");

export async function findLesson(token, videoId) {
  return (await list(token, `name = 'yt-${videoId}.json'`))[0] ?? null;
}

export async function downloadLesson(token, fileId) {
  return (await call(token, `${API}/files/${fileId}?alt=media`)).json();
}

// Tạo mới hoặc ghi đè bài của video này
export async function uploadLesson(token, videoId, { title, sentences, ...extra }) {
  const existing = await findLesson(token, videoId);
  const metadata = {
    name: `yt-${videoId}.json`,
    appProperties: { title: fitBytes(title ?? videoId, 100), count: String(sentences.length) },
    ...(existing ? {} : { parents: ['appDataFolder'] }),
  };
  const boundary = `yt${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ title, sentences, ...extra })}\r\n` +
    `--${boundary}--`;
  const url = existing ? `${UPLOAD}/files/${existing.fileId}?uploadType=multipart` : `${UPLOAD}/files?uploadType=multipart`;
  await call(token, url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

// Xóa mọi file của bài này trong thư mục ứng dụng trên Drive của người dùng
export async function deleteLessonFiles(token, videoId) {
  const entries = await list(token, `name = 'yt-${videoId}.json'`);
  await Promise.all(entries.map((e) => call(token, `${API}/files/${e.fileId}`, { method: 'DELETE' })));
}
