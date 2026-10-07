import { streamDriveFile } from '../../../../../lib/drive';
import { findLessonEntry } from '../../../../../lib/topics';

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// GET /api/topic-audio/<slug>/<lesson number> -> audio của bài (Harry Potter không đi qua route công khai này)
export async function GET(request, { params }) {
  const { topic, lesson } = await params;
  const lessonIndex = Number(lesson);
  if (!Number.isInteger(lessonIndex)) return new Response('Not found', { status: 404 });
  try {
    const entry = await findLessonEntry(safeDecode(topic), lessonIndex);
    if (!entry) return new Response('Not found', { status: 404 });
    return streamDriveFile(request, entry.lesson.audio_id);
  } catch (err) {
    return new Response(err.message, { status: 502 });
  }
}
