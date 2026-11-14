// Tìm ảnh thật miễn phí trên Pexels cho từng bài -> public/topic-covers/<slug>/lesson-NN.webp (640x360, cho thẻ bài)
// và lesson-NN-full.webp (1280x720, cho khung lớn ở trang bài học)
//
// Dùng:
//   node scripts/make_lesson_photos.mjs --topic daily-routines                  # cả 20 bài, bài nào có ảnh rồi thì bỏ qua
//   node scripts/make_lesson_photos.mjs --topic daily-routines --only 3,7       # chỉ vài bài (đổi ảnh bài nào lệch: thêm --force)
//   node scripts/make_lesson_photos.mjs --topic daily-routines --force          # tìm lại, đè ảnh cũ
//   node scripts/make_lesson_photos.mjs --topic daily-routines --dry-run        # chỉ in từ khóa tìm ảnh, không tải gì
//   thêm --sheet <đường dẫn .png> để xuất bảng xem nhanh các ảnh (đánh số theo bài) cho dễ duyệt
//   thêm --query "3=man sleeping in bed,7=family dinner table" để tự đặt từ khóa cho một số bài (đổi ảnh lệch)
//   --resize: tạo lại cả hai cỡ ảnh từ đúng các ảnh đã chọn (theo credits.json), không tìm ảnh mới
//
// Cần PEXELS_API_KEY (miễn phí, https://www.pexels.com/api/) và GEMINI_API_KEY (chỉ dùng model chữ, gói miễn phí đủ) trong .env.local.
// Quy trình: Gemini viết từ khóa tìm ảnh cho từng tiêu đề bài -> Pexels trả ảnh ngang -> chọn ảnh đầu tiên chưa dùng ở bài khác
// trong cùng topic -> cắt 640x360, nén webp. Người chụp lưu trong public/topic-covers/<slug>/credits.json (Pexels yêu cầu ghi nguồn).
// Xong thì cập nhật lib/aiCovers.js (danh sách bài đã có ảnh riêng); bài chưa có ảnh vẫn dùng ảnh SVG chung của topic.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { COVERS, loadEnv, readPlan, writeManifest } from './make_lesson_covers.mjs';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const PEXELS = 'https://api.pexels.com/v1/search';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gemini(pathname, key, body) {
  const res = await fetch(`${GEMINI}/${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-goog-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `Gemini HTTP ${res.status}`);
  return data;
}

// Model chữ (không phải model ảnh/âm thanh), ưu tiên bản flash-lite
async function pickTextModel(key) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  const data = await gemini('models?pageSize=200', key);
  const names = (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent') && !/image|tts|audio|embed|live|robotics|computer|imagen|veo/i.test(m.name))
    .map((m) => m.name.replace(/^models\//, ''));
  return names.find((n) => /flash-lite/i.test(n) && !/preview/i.test(n)) ?? names.find((n) => /flash-lite/i.test(n)) ?? names.find((n) => /flash/i.test(n)) ?? names[0];
}

// { [lessonIndex]: "từ khóa tìm ảnh" }
async function makeQueries(key, topicTitle, lessons) {
  const model = await pickTextModel(key);
  const list = lessons.map((l) => `${l.index}. ${l.title}`).join('\n');
  const prompt =
    `These are lesson titles of an English-learning topic called "${topicTitle}". For each lesson write a stock-photo search query of 3 to 5 English words ` +
    `that describes ONE concrete, photogenic, easy-to-recognize everyday scene matching the title (people doing the action in a real place). ` +
    `Use plain visual words only: no names, no brands, no abstract words, no words like "concept" or "lesson". ` +
    `Make the queries clearly different from each other.\n\n${list}`;
  const data = await gemini(`models/${model}:generateContent`, key, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { index: { type: 'INTEGER' }, query: { type: 'STRING' } }, required: ['index', 'query'] },
      },
    },
  });
  const rows = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]');
  console.log(`Từ khóa do ${model} viết.`);
  return Object.fromEntries(rows.filter((r) => Number.isInteger(r.index) && r.query?.trim()).map((r) => [r.index, r.query.trim()]));
}

async function searchPexels(key, query) {
  const url = new URL(PEXELS);
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('size', 'large');
  url.searchParams.set('per_page', '30');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: key } });
    if (res.status === 429 && attempt < 3) {
      await sleep(5000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Pexels HTTP ${res.status}${res.status === 401 ? ' (key sai?)' : res.status === 429 ? ' (hết lượt gọi, thử lại sau)' : ''}`);
    const remaining = res.headers.get('x-ratelimit-remaining');
    return { photos: (await res.json()).photos ?? [], remaining };
  }
}

// Ảnh ngang đủ lớn, chưa dùng ở bài khác trong cùng topic. Pexels đã xếp theo độ liên quan nên lấy cái đầu tiên đạt.
const pick = (photos, used) =>
  photos.find((p) => !used.has(p.id) && p.width >= 1280 && p.width / p.height >= 1.4 && p.width / p.height <= 2.2) ?? photos.find((p) => !used.has(p.id));

// Tải ảnh một lần, ra hai cỡ: thẻ bài 640x360 và khung lớn ở trang bài học 1280x720
async function renderBoth(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải ảnh lỗi HTTP ${res.status}`);
  const source = Buffer.from(await res.arrayBuffer());
  const make = (w, h, quality) => sharp(source).resize(w, h, { fit: 'cover', position: 'attention' }).webp({ quality }).toBuffer();
  return { thumb: await make(640, 360, 78), full: await make(1280, 720, 76) };
}

async function getPhoto(key, id) {
  const res = await fetch(`https://api.pexels.com/v1/photos/${id}`, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status} khi lấy ảnh ${id}`);
  return res.json();
}

// Bảng xem nhanh: 4 cột, mỗi ảnh kèm số bài và tiêu đề
async function contactSheet(files, outPath) {
  const cols = 4;
  const w = 320;
  const h = 180;
  const cap = 34;
  const rows = Math.ceil(files.length / cols);
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const tiles = await Promise.all(
    files.map(async (f, i) => ({
      input: await sharp(f.file).resize(w, h, { fit: 'cover' }).png().toBuffer(),
      left: (i % cols) * (w + 8) + 8,
      top: Math.floor(i / cols) * (h + cap + 8) + 8,
    })),
  );
  const labels = files.map((f, i) => ({
    input: Buffer.from(`<svg width="${w}" height="${cap}" xmlns="http://www.w3.org/2000/svg"><text x="2" y="14" font-size="13" font-weight="bold" font-family="Arial, sans-serif" fill="#111">L${String(f.index).padStart(2, '0')} ${esc(f.title.slice(0, 34))}</text><text x="2" y="29" font-size="11" font-family="Arial, sans-serif" fill="#666">${esc(f.query.slice(0, 48))}</text></svg>`),
    left: (i % cols) * (w + 8) + 8,
    top: Math.floor(i / cols) * (h + cap + 8) + 8 + h,
  }));
  await sharp({ create: { width: cols * (w + 8) + 8, height: rows * (h + cap + 8) + 8, channels: 3, background: '#ffffff' } })
    .composite([...tiles, ...labels])
    .png()
    .toFile(outPath);
  console.log(`Đã xuất bảng xem nhanh: ${outPath}`);
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
  const only = option('only')?.split(',').map(Number);
  const dir = path.join(COVERS, slug);
  const fileOf = (l) => path.join(dir, `lesson-${String(l.index).padStart(2, '0')}.webp`);
  const fullOf = (l) => path.join(dir, `lesson-${String(l.index).padStart(2, '0')}-full.webp`);
  const creditsFile = path.join(dir, 'credits.json');
  const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {};
  const manual = Object.fromEntries(
    (option('query') ?? '')
      .split(',')
      .map((p) => p.split('='))
      .filter((p) => p.length === 2 && Number(p[0]))
      .map(([i, q]) => [Number(i), q.trim()]),
  );
  const lessons = topic.lessons.filter((l) => !only || only.includes(l.index));
  const todo = lessons.filter((l) => flag('force') || !fs.existsSync(fileOf(l)));

  // Tạo lại hai cỡ ảnh từ đúng các ảnh đã chọn trước đó (credits.json lưu id ảnh Pexels), không tìm ảnh mới
  if (flag('resize')) {
    loadEnv();
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (!pexelsKey) {
      console.error('Thiếu PEXELS_API_KEY trong .env.local.');
      process.exit(1);
    }
    for (const l of lessons.filter((x) => credits[x.index])) {
      try {
        const photo = await getPhoto(pexelsKey, credits[l.index].id);
        const { thumb, full } = await renderBoth(photo.src.large2x ?? photo.src.large);
        fs.writeFileSync(fileOf(l), thumb);
        fs.writeFileSync(fullOf(l), full);
        console.log(`  ✓ L${String(l.index).padStart(2, '0')} ${l.title}`);
      } catch (e) {
        console.log(`  ✗ L${String(l.index).padStart(2, '0')} ${l.title}: ${e.message}`);
      }
      await sleep(300);
    }
    writeManifest();
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!todo.length) {
    console.log('Không có bài nào cần tìm ảnh (dùng --force để tìm lại).');
  }
  if (todo.length && (!geminiKey || !pexelsKey)) {
    console.error('Thiếu GEMINI_API_KEY hoặc PEXELS_API_KEY trong .env.local.');
    process.exit(1);
  }

  // Ảnh đã dùng ở các bài khác của topic (không tính các bài sắp tìm lại) để không trùng
  const redo = new Set(todo.map((l) => String(l.index)));
  const used = new Set(Object.entries(credits).filter(([i]) => !redo.has(i)).map(([, c]) => c.id));

  let queries = {};
  if (todo.length) {
    // Gemini thỉnh thoảng báo quá tải: thử lại vài lần trước khi chịu dùng tiêu đề bài làm từ khóa (kém hơn từ khóa mô tả cảnh)
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        queries = await makeQueries(geminiKey, topic.title, todo);
        break;
      } catch (e) {
        console.log(`Gemini chưa viết được từ khóa (lần ${attempt}/5): ${e.message.slice(0, 90)}`);
        if (attempt < 5) await sleep(4000 * attempt);
      }
    }
    if (!Object.keys(queries).length) console.log('Dùng tiêu đề bài làm từ khóa.');
  }
  const queryOf = (l) => manual[l.index] ?? queries[l.index] ?? l.title;

  if (flag('dry-run')) {
    for (const l of todo) console.log(`L${String(l.index).padStart(2, '0')} ${l.title}  ->  ${queryOf(l)}`);
    return;
  }

  fs.mkdirSync(dir, { recursive: true });
  let done = 0;
  for (const l of todo) {
    const label = `L${String(l.index).padStart(2, '0')} ${l.title}`;
    try {
      let query = queryOf(l);
      let { photos, remaining } = await searchPexels(pexelsKey, query);
      let photo = pick(photos, used);
      if (!photo) {
        query = l.title; // từ khóa quá hẹp: thử lại bằng chính tiêu đề bài
        ({ photos, remaining } = await searchPexels(pexelsKey, query));
        photo = pick(photos, used);
      }
      if (!photo) throw new Error(`không có ảnh cho "${query}"`);
      const { thumb, full } = await renderBoth(photo.src.large2x ?? photo.src.large);
      fs.writeFileSync(fileOf(l), thumb);
      fs.writeFileSync(fullOf(l), full);
      used.add(photo.id);
      credits[l.index] = { id: photo.id, photographer: photo.photographer, photographerUrl: photo.photographer_url, url: photo.url, query };
      done++;
      console.log(`  ✓ ${label}  <-  "${query}"  (${photo.photographer}, còn ${remaining ?? '?'} lượt gọi)`);
    } catch (e) {
      console.log(`  ✗ ${label}: ${e.message}`);
    }
    await sleep(400);
  }
  if (todo.length) {
    fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 1) + '\n');
    console.log(`Xong: ${done}/${todo.length} ảnh.`);
    writeManifest();
  }

  const sheet = option('sheet');
  if (sheet) {
    const files = topic.lessons
      .filter((l) => fs.existsSync(fileOf(l)))
      .map((l) => ({ file: fileOf(l), index: l.index, title: l.title, query: credits[l.index]?.query ?? '' }));
    await contactSheet(files, sheet);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
