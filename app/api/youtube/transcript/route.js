import { NextResponse } from 'next/server';
import { rateLimited } from '../../../../lib/rateLimit';
import { extractVideoId, parseTranscript } from '../../../../lib/youtube';

const TRANSCRIPT_API = 'https://youtube-transcript.ai/transcript';
const MAX_SECONDS = 60 * 60; // video dài hơn 1 giờ thì từ chối để tránh tốn lượt/chi phí dịch

const fail = (status, code, message, extra = {}) => NextResponse.json({ code, message, ...extra }, { status });

// Lấy hạn mức từ header của dịch vụ transcript (hạn mức tính theo key của chính người dùng)
function readQuota(headers) {
  const limit = Number(headers.get('x-ratelimit-limit'));
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  return Number.isFinite(limit) && Number.isFinite(remaining) && limit > 0 ? { limit, remaining } : null;
}

async function fetchTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.title === 'string' ? data.title : null;
  } catch {
    return null;
  }
}

// POST /api/youtube/transcript  { url }   header: x-transcript-key = key youtube-transcript.ai CỦA NGƯỜI DÙNG
// Key chỉ đi qua server để gọi dịch vụ, không lưu và không ghi log.
export async function POST(request) {
  if (rateLimited(request, { limit: 20 })) return fail(429, 'TOO_MANY', 'Bạn thao tác quá nhanh, thử lại sau ít phút.');

  const key = request.headers.get('x-transcript-key')?.trim();
  if (!key) return fail(401, 'NO_KEY', 'Chưa có key youtube-transcript.ai.');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'BAD_URL', 'Yêu cầu không hợp lệ.');
  }
  const videoId = extractVideoId(body?.url);
  if (!videoId) return fail(400, 'BAD_URL', 'Link YouTube không hợp lệ.');

  let upstream;
  try {
    upstream = await fetch(`${TRANSCRIPT_API}/${videoId}.txt`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return fail(502, 'UPSTREAM', 'Không kết nối được dịch vụ lấy phụ đề. Thử lại sau.');
  }

  const quota = readQuota(upstream.headers);
  if (upstream.status === 401) return fail(401, 'BAD_KEY', 'Key không đúng hoặc đã bị thay bằng key mới hơn.');
  if (upstream.status === 429) {
    return fail(429, 'QUOTA', 'Bạn đã hết lượt dịch hôm nay. Hãy quay lại vào ngày mai.', {
      quota: { limit: quota?.limit ?? null, remaining: 0 },
    });
  }
  if (upstream.status === 404) return fail(404, 'NO_TRANSCRIPT', 'Video này không có phụ đề để lấy.');
  if (!upstream.ok) {
    console.error(`Dịch vụ youtube-transcript.ai trả về lỗi ${upstream.status}`);
    return fail(502, 'UPSTREAM', 'Dịch vụ lấy phụ đề đang gặp sự cố. Vui lòng thử lại sau.');
  }

  const text = await upstream.text();
  const segments = parseTranscript(text);
  if (segments.length === 0) {
    return fail(422, 'UNPARSEABLE', 'Không đọc được phụ đề của video này. Hãy thử video khác.', {
      ...(process.env.NODE_ENV !== 'production' ? { sample: text.slice(0, 400) } : {}),
    });
  }
  if (segments[segments.length - 1].end > MAX_SECONDS) {
    return fail(413, 'TOO_LONG', 'Video dài hơn 60 phút, hiện chưa hỗ trợ.', { quota });
  }

  return NextResponse.json({ videoId, title: await fetchTitle(videoId), segments, quota });
}
