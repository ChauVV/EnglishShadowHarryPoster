import { driveConfigured, streamDriveAudio } from '../../../../../lib/drive';
import { TOPIC_AUDIO_PATTERN, isTopicName } from '../../../../../lib/topics';

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export async function GET(request, { params }) {
  const { topic: rawTopic, file } = await params;
  const topic = safeDecode(rawTopic);
  // Book_N (Harry Potter) không đi qua route công khai này
  if (!isTopicName(topic) || !TOPIC_AUDIO_PATTERN.test(file) || !driveConfigured()) {
    return new Response('Not found', { status: 404 });
  }
  return streamDriveAudio(request, [topic], file);
}
