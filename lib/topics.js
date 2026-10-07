import { driveConfigured, driveList, driveReadJson, driveRootId } from './drive';

// Topic miễn phí trên Drive:
//   <gốc>/catalog.json                                   mục lục nhẹ (script upload tự cập nhật)
//   <gốc>/Topic_NN_<Tên>/Lesson_MM_<Tên>/{audio.mp3, metadata.json}
// catalog.json: { topics: [{ number, slug, title, title_vi, lessons: [{ lesson_index, title, duration_seconds, audio_id, metadata_id }] }] }
// Trang chủ chỉ đọc catalog.json (một file nhỏ); metadata.json (text + timestamp) chỉ tải khi mở đúng bài.
const CATALOG_FILE = 'catalog.json';
const CATALOG_TTL_MS = 60_000;

async function loadCatalog() {
  if (!driveConfigured()) return [];
  const file = (await driveList(driveRootId())).find((f) => !f.isFolder && f.name === CATALOG_FILE);
  if (!file) return [];
  const catalog = await driveReadJson(file.id, CATALOG_TTL_MS);
  return [...(catalog.topics ?? [])].sort((a, b) => a.number - b.number);
}

const publicLesson = ({ lesson_index, title, duration_seconds }) => ({ lesson_index, title, duration_seconds });
const publicTopic = (topic) => ({
  topic: topic.slug,
  number: topic.number,
  title: topic.title,
  title_vi: topic.title_vi,
  lessons: [...topic.lessons].sort((a, b) => a.lesson_index - b.lesson_index).map(publicLesson),
});

export async function loadTopics() {
  return (await loadCatalog()).map(publicTopic);
}

export async function loadTopic(slug) {
  const topic = (await loadCatalog()).find((t) => t.slug === slug);
  return topic ? publicTopic(topic) : null;
}

// Cần ID file (audio/metadata) để phát; không trả ra ngoài API
export async function findLessonEntry(slug, lessonIndex) {
  const topic = (await loadCatalog()).find((t) => t.slug === slug);
  const lesson = topic?.lessons.find((l) => l.lesson_index === lessonIndex);
  return lesson ? { topic, lesson } : null;
}

// 1 bài đầy đủ: text, segments (từng câu có start/end/vi/speaker) + audio_url
export async function loadTopicLesson(slug, lessonIndex) {
  const entry = await findLessonEntry(slug, lessonIndex);
  if (!entry) return null;
  const metadata = await driveReadJson(entry.lesson.metadata_id);
  return {
    lesson_index: entry.lesson.lesson_index,
    title: entry.lesson.title,
    duration_seconds: metadata.duration_seconds ?? entry.lesson.duration_seconds,
    text: metadata.text,
    segments: metadata.segments,
    audio_url: `/api/topic-audio/${encodeURIComponent(slug)}/${entry.lesson.lesson_index}`,
  };
}
