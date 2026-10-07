import { BOOK_DIR_PATTERN } from './chapters';
import { driveConfigured, driveList, driveReadJson, driveResolveFolder, driveRootId } from './drive';

// Topic = thư mục ở gốc Drive (không phải Book_N), chứa trực tiếp metadata.json + lesson_X.mp3.
// Tên thư mục chính là tên hiển thị. Topic là nội dung miễn phí, ai cũng xem được.
export const TOPIC_AUDIO_PATTERN = /^lesson_\d+\.mp3$/;
export const isTopicName = (name) => typeof name === 'string' && name.length > 0 && !BOOK_DIR_PATTERN.test(name);

async function readTopic(name) {
  try {
    const folderId = await driveResolveFolder([name]);
    const meta = folderId && (await driveList(folderId)).find((f) => !f.isFolder && f.name === 'metadata.json');
    if (!meta) return null;
    const metadata = await driveReadJson(meta.id);
    return {
      topic: name,
      title: metadata.topic_title || name,
      lessons: metadata.lessons
        .map((lesson) => ({
          ...lesson,
          audio_url: `/api/topic-audio/${encodeURIComponent(name)}/${lesson.audio_file_name}`,
        }))
        .sort((a, b) => a.lesson_index - b.lesson_index),
    };
  } catch {
    return null; // Folder chưa có metadata.json hợp lệ -> bỏ qua
  }
}

export const loadTopic = (name) => (driveConfigured() && isTopicName(name) ? readTopic(name) : null);

// Mục lục topic (không kèm text/audio để nhẹ)
export async function loadTopics() {
  if (!driveConfigured()) return [];
  const rootId = driveRootId();
  const names = (await driveList(rootId)).filter((f) => f.isFolder && isTopicName(f.name)).map((f) => f.name);
  const loaded = await Promise.all(names.map(readTopic));
  return loaded
    .filter(Boolean)
    .map(({ topic, title, lessons }) => ({
      topic,
      title,
      lessons: lessons.map(({ lesson_index, title: lessonTitle, duration_seconds }) => ({
        lesson_index,
        title: lessonTitle,
        duration_seconds,
      })),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
