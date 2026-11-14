// Tạo ảnh bìa riêng cho từng bài bằng AI (Gemini tạo ảnh) -> public/topic-covers/<slug>/lesson-NN.webp (640x360)
//
// Dùng:
//   node scripts/make_lesson_covers.mjs --topic daily-routines            # cả 20 bài của topic, bài nào có ảnh rồi thì bỏ qua
//   node scripts/make_lesson_covers.mjs --topic daily-routines --only 1,2 # chỉ vài bài (để thử trước)
//   node scripts/make_lesson_covers.mjs --topic daily-routines --force    # tạo lại, đè ảnh cũ
//   node scripts/make_lesson_covers.mjs --topic daily-routines --dry-run  # chỉ in prompt, không gọi API
//   mặc định tạo kiểu ảnh chụp thật (--style photo); thêm --style illustration nếu muốn tranh minh họa; --model <tên> để chọn model tạo ảnh
//
// Cần GEMINI_API_KEY trong .env.local (key có quyền tạo ảnh; model tạo ảnh có thể yêu cầu bật thanh toán trên dự án Google).
// Tiêu đề bài lấy từ docs/CONTENT_PLAN.md. Xong thì cập nhật lib/aiCovers.js để web biết bài nào đã có ảnh riêng
// (bài chưa có ảnh vẫn dùng ảnh SVG chung của topic).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COVERS = path.join(ROOT, 'public', 'topic-covers');
const API = 'https://generativelanguage.googleapis.com/v1beta';
const CONCURRENCY = 2;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// ---- đọc biến môi trường từ .env.local (không in giá trị ra màn hình) ----
export function loadEnv() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

export const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// docs/CONTENT_PLAN.md -> { slug: { title, lessons: [{ index, title }] } }
export function readPlan() {
  const text = fs.readFileSync(path.join(ROOT, 'docs', 'CONTENT_PLAN.md'), 'utf8').replace(/\r\n/g, '\n');
  const topics = {};
  let current = null;
  for (const line of text.split('\n')) {
    const head = line.match(/^## Topic \d+ - (.+?) \(/);
    if (head) {
      current = { title: head[1], lessons: [] };
      topics[slugify(head[1])] = current;
      continue;
    }
    const lesson = line.match(/^- T\d+-L(\d+) · .*? · [A-Z] · (.+)$/);
    if (lesson && current) current.lessons.push({ index: Number(lesson[1]), title: lesson[2].trim() });
  }
  return topics;
}

const STYLES = {
  illustration:
    'A polished modern digital illustration in a warm, friendly style with rich saturated colors, soft lighting and gentle depth, like a high-quality app or video thumbnail.',
  photo:
    'A photorealistic, natural candid photograph, as if taken by a professional photographer with a full-frame camera and a 35mm lens: real people with authentic expressions, true-to-life skin and fabric textures, soft natural light, shallow depth of field, in a real everyday location. Looks like a high-quality stock photo or video thumbnail, not a drawing, not 3D, not a cartoon.',
};

function promptFor(topicTitle, lessonTitle, style) {
  return [
    STYLES[style] ?? STYLES.illustration,
    `Scene: "${lessonTitle}" (theme: ${topicTitle}). Show one clear, easy-to-recognize everyday moment that matches this title, with one or two people if it fits.`,
    'Wide 16:9 composition with the subject centered and some empty margin around it.',
    'No text, no letters, no numbers, no logos, no watermark, no brand names.',
  ].join(' ');
}

async function api(pathname, key, body) {
  const res = await fetch(`${API}/${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-goog-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message ?? `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

// Chọn model tạo ảnh (ưu tiên bản "flash image")
async function pickModel(key) {
  const forced = option('model');
  if (forced) return forced;
  const data = await api('models?pageSize=200', key);
  const names = (data.models ?? [])
    .filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  if (!names.length) throw new Error('Key này không thấy model tạo ảnh nào (kiểm tra quyền/thanh toán của dự án Google).');
  return names.find((n) => /flash.*image/i.test(n)) ?? names[0];
}

async function generate(key, model, prompt) {
  const data = await api(`models/${model}:generateContent`, key, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
  });
  const part = (data.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!part) throw new Error(`Không có ảnh trong phản hồi (${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? 'không rõ lý do'})`);
  return Buffer.from(part.inlineData.data, 'base64');
}

// Ảnh gốc (thường ~1MB) -> 640x360 webp (~30KB) để repo và trang không nặng
const toWebp = (buffer) => sharp(buffer).resize(640, 360, { fit: 'cover', position: 'attention' }).webp({ quality: 78 }).toBuffer();

async function withRetry(fn, label) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = !e.status || e.status === 429 || e.status >= 500;
      if (!retryable || attempt >= 3) throw e;
      const wait = 4000 * attempt;
      console.log(`  ${label}: ${e.message.slice(0, 90)} -> thử lại sau ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// lib/aiCovers.js liệt kê bài nào của topic nào đã có ảnh riêng, tạo từ các file đang có trong public/topic-covers
export function writeManifest() {
  const map = {};
  for (const slug of fs.readdirSync(COVERS).sort()) {
    const dir = path.join(COVERS, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const nums = fs
      .readdirSync(dir)
      .map((f) => f.match(/^lesson-(\d+)\.webp$/)?.[1])
      .filter(Boolean)
      .map(Number)
      .sort((a, b) => a - b);
    if (nums.length) map[slug] = nums;
  }
  const body = Object.entries(map)
    .map(([slug, nums]) => `  '${slug}': [${nums.join(', ')}],`)
    .join('\n');
  fs.writeFileSync(
    path.join(ROOT, 'lib', 'aiCovers.js'),
    `// Tự tạo bởi scripts/make_lesson_covers.mjs, đừng sửa tay: bài nào của topic nào đã có ảnh riêng public/topic-covers/<slug>/lesson-NN.webp\nexport const AI_COVERS = {\n${body}${body ? '\n' : ''}};\n`,
  );
  console.log(`Đã cập nhật lib/aiCovers.js (${Object.keys(map).length} topic có ảnh riêng).`);
}

async function main() {
  loadEnv();
  const plan = readPlan();
  const slug = option('topic');
  const topic = plan[slug];
  if (!topic) {
    console.error(`Thiếu hoặc sai --topic. Các topic có trong kế hoạch:\n  ${Object.keys(plan).join('\n  ')}`);
    process.exit(1);
  }
  const only = option('only')
    ?.split(',')
    .map(Number);
  const style = option('style') ?? 'photo';
  const lessons = topic.lessons.filter((l) => !only || only.includes(l.index));
  const dir = path.join(COVERS, slug);
  const fileOf = (l) => path.join(dir, `lesson-${String(l.index).padStart(2, '0')}.webp`);
  const todo = lessons.filter((l) => flag('force') || !fs.existsSync(fileOf(l)));

  if (flag('dry-run')) {
    for (const l of todo) console.log(`L${String(l.index).padStart(2, '0')} ${l.title}\n  ${promptFor(topic.title, l.title, style)}\n`);
    console.log(`${todo.length} bài sẽ được tạo (dry-run, chưa gọi API).`);
    return;
  }
  if (!todo.length) {
    console.log('Không có bài nào cần tạo (dùng --force để tạo lại).');
    writeManifest();
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('Thiếu GEMINI_API_KEY trong .env.local.');
    process.exit(1);
  }
  const model = await pickModel(key);
  console.log(`Model: ${model} · kiểu: ${style} · ${todo.length} bài của "${topic.title}"`);
  fs.mkdirSync(dir, { recursive: true });

  let done = 0;
  let failed = 0;
  const queue = [...todo];
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      try {
        const raw = await withRetry(() => generate(key, model, promptFor(topic.title, l.title, style)), `L${l.index}`);
        fs.writeFileSync(fileOf(l), await toWebp(raw));
        done++;
        console.log(`  ✓ L${String(l.index).padStart(2, '0')} ${l.title}`);
      } catch (e) {
        failed++;
        console.log(`  ✗ L${String(l.index).padStart(2, '0')} ${l.title}: ${e.message.slice(0, 160)}`);
        if (e.status === 403 || e.status === 400) queue.length = 0; // lỗi quyền/yêu cầu: dừng, thử tiếp cũng vô ích
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Xong: ${done} ảnh mới, ${failed} lỗi.`);
  writeManifest();
}

// Chỉ chạy khi gọi trực tiếp (scripts/make_lesson_photos.mjs import các hàm ở trên)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
