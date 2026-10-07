import { NextResponse } from 'next/server';
import { loadTopic, loadTopicLesson, loadTopics } from '../../../lib/topics';

// GET /api/topics                                  -> danh sách topic + lesson (công khai, nhẹ)
// GET /api/topics?topic=travel-and-airports        -> 1 topic (danh sách lesson)
// GET /api/topics?topic=travel-and-airports&lesson=3 -> 1 lesson đầy đủ (text, segments, audio_url)
export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const topic = params.get('topic');
  const lesson = params.get('lesson');

  try {
    if (topic === null) return NextResponse.json({ topics: await loadTopics() });

    if (lesson !== null) {
      const lessonIndex = Number(lesson);
      const data = Number.isInteger(lessonIndex) ? await loadTopicLesson(topic, lessonIndex) : null;
      if (!data) return NextResponse.json({ message: 'Không tìm thấy bài' }, { status: 404 });
      return NextResponse.json({ lesson: data });
    }

    const data = await loadTopic(topic);
    if (!data) return NextResponse.json({ message: 'Không tìm thấy topic' }, { status: 404 });
    return NextResponse.json({ topic: data });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 502 });
  }
}
