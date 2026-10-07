// Đọc nội dung bài học trực tiếp từ Google Drive (Drive API v3, dùng API key).
// Cấu hình trong .env.local:
//   GOOGLE_API_KEY=...            API key có bật "Google Drive API"
//   DRIVE_ROOT_FOLDER_ID=...      ID thư mục gốc chứa Book_1, Book_2, ...
// Thư mục trên Drive phải chia sẻ "Anyone with the link can view".
const API = 'https://www.googleapis.com/drive/v3';
const LIST_TTL_MS = 60_000;
const JSON_TTL_MS = 5 * 60_000;
const FOLDER_MIME = 'application/vnd.google-apps.folder';

// Chấp nhận cả ID thuần lẫn giá trị dán nhầm (có "folders/", URL, dấu nháy, khoảng trắng, xuống dòng)
const cleanEnv = (value) => (value ?? '').trim().replace(/^["']|["']$/g, '').trim();
const apiKey = () => cleanEnv(process.env.GOOGLE_API_KEY);
export const driveRootId = () => {
  const raw = cleanEnv(process.env.DRIVE_ROOT_FOLDER_ID);
  return raw.match(/[\w-]{15,}(?=[/?#]|$)/)?.[0] ?? raw;
};

export const driveConfigured = () => Boolean(apiKey() && driveRootId());

function buildUrl(path, params) {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey());
  return url;
}

async function driveFetch(path, params, init) {
  const res = await fetch(buildUrl(path, params), { cache: 'no-store', ...init });
  if (!res.ok && res.status !== 206) {
    // Không log URL vì có chứa API key
    let reason = '';
    try {
      reason = (await res.json())?.error?.message ?? '';
    } catch {}
    console.error(`[drive] ${path} -> ${res.status} ${reason}`);
    throw new Error(`Google Drive API lỗi ${res.status}${reason ? `: ${reason}` : ''}`);
  }
  return res;
}

// Cache nhỏ trong bộ nhớ để không gọi Drive lại cho mỗi request
const cache = new Map();
async function cached(key, ttl, load) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = load();
  cache.set(key, { value, expires: Date.now() + ttl });
  try {
    return await value;
  } catch (err) {
    cache.delete(key); // không cache lỗi
    throw err;
  }
}

// Liệt kê con trực tiếp của một thư mục: [{ id, name, isFolder, size }]
export function driveList(folderId) {
  return cached(`list:${folderId}`, LIST_TTL_MS, async () => {
    const files = [];
    let pageToken;
    do {
      const res = await driveFetch('/files', {
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size)',
        pageSize: '1000',
        ...(pageToken ? { pageToken } : {}),
      }).catch((err) => {
        // Google chỉ báo "File not found: ." mà không nói ID nào sai -> kèm gợi ý (không lộ cả ID)
        throw new Error(`${err.message} [folder ${folderId.slice(0, 4)}…, ${folderId.length} ký tự]`);
      });
      const data = await res.json();
      for (const f of data.files ?? []) {
        files.push({ id: f.id, name: f.name, isFolder: f.mimeType === FOLDER_MIME, size: Number(f.size ?? 0) });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    return files;
  });
}

// Đi theo đường dẫn tên thư mục từ gốc, ví dụ ['Book_1', 'Chapter_1_Output'] -> id thư mục
export async function driveResolveFolder(segments) {
  let id = driveRootId();
  for (const name of segments) {
    const child = (await driveList(id)).find((f) => f.isFolder && f.name === name);
    if (!child) return null;
    id = child.id;
  }
  return id;
}

export function driveReadJson(fileId) {
  return cached(`json:${fileId}`, JSON_TTL_MS, async () => {
    const res = await driveFetch(`/files/${fileId}`, { alt: 'media' });
    return JSON.parse((await res.text()).replace(/^﻿/, ''));
  });
}

// Trả về Response gốc từ Drive (stream) để chuyển tiếp cho trình duyệt, hỗ trợ Range
export function driveMedia(fileId, range) {
  return driveFetch(`/files/${fileId}`, { alt: 'media' }, range ? { headers: { Range: range } } : undefined);
}
