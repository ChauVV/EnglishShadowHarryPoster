import { NextResponse } from 'next/server';
import { isTopicName, loadTopic, loadTopics } from '../../../lib/topics';

// GET /api/topics               -> danh sách topic (công khai)
// GET /api/topics?topic=market  -> 1 topic đầy đủ (text, segments, audio_url)
export async function GET(request) {
  const topic = request.nextUrl.searchParams.get('topic');

  if (topic === null) {
    try {
      return NextResponse.json({ topics: await loadTopics() });
    } catch (err) {
      return NextResponse.json({ message: err.message }, { status: 502 });
    }
  }

  if (!isTopicName(topic)) return NextResponse.json({ message: 'Không tìm thấy topic' }, { status: 404 });
  const data = await loadTopic(topic);
  if (!data) return NextResponse.json({ message: 'Không tìm thấy topic' }, { status: 404 });
  return NextResponse.json({ topic: data });
}
