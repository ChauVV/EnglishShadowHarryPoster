"""Tạo bài shadowing từ kịch bản hội thoại bằng Kokoro TTS (offline, Apache 2.0).

Dùng:  python scripts/make_dialogue.py scripts/dialogues/travel_japan.json [thư_mục_ra]
Mỗi dòng kịch bản = 1 segment (có start/end chính xác vì ta biết độ dài từng câu), không cần Whisper.
Kết quả: <thư_mục_ra>/Topic_NN_<Tên_topic>/Lesson_MM_<Tên_lesson>/{audio.mp3, metadata.json} - kéo cả thư mục lên Drive.
"""
import io
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline
from pydub import AudioSegment

sys.stdout.reconfigure(encoding="utf-8")

SAMPLE_RATE = 24000
SPEED = 0.9            # chậm hơn một chút cho người học
PAUSE_SAME = 0.35      # giây nghỉ giữa các câu cùng người
PAUSE_SWITCH = 0.6     # giây nghỉ khi đổi người nói


def slug(title):
    return re.sub(r"[^A-Za-z0-9]+", "_", title.replace("&", "and").replace("'", "")).strip("_")


def synth(pipeline, text, voice):
    chunks = [audio.numpy() if hasattr(audio, "numpy") else audio for _, _, audio in pipeline(text, voice=voice, speed=SPEED)]
    return np.concatenate(chunks)


def main():
    script_path = sys.argv[1]
    out_root = sys.argv[2] if len(sys.argv) > 2 else "generated"
    with open(script_path, encoding="utf-8") as f:
        data = json.load(f)

    pipeline = KPipeline(lang_code="a")
    wave, segments, cursor, prev = [], [], 0.0, None
    for speaker, text, vi in data["lines"]:
        if prev is not None:
            pause = PAUSE_SWITCH if speaker != prev else PAUSE_SAME
            wave.append(np.zeros(int(pause * SAMPLE_RATE), dtype=np.float32))
            cursor += pause
        audio = synth(pipeline, text, data["speakers"][speaker])
        dur = len(audio) / SAMPLE_RATE
        segments.append({"start": round(cursor, 2), "end": round(cursor + dur, 2), "text": text, "vi": vi, "speaker": speaker})
        wave.append(audio.astype(np.float32))
        cursor += dur
        prev = speaker

    topic_dir = f"Topic_{data['topic_number']:02d}_{slug(data['topic_title'])}"
    lesson_dir = f"Lesson_{data['lesson_number']:02d}_{slug(data['lesson_title'])}"
    out_dir = os.path.join(out_root, topic_dir, lesson_dir)
    os.makedirs(out_dir, exist_ok=True)
    buf = io.BytesIO()
    sf.write(buf, np.concatenate(wave), SAMPLE_RATE, format="WAV")
    buf.seek(0)
    AudioSegment.from_wav(buf).export(os.path.join(out_dir, "audio.mp3"), format="mp3", bitrate="128k")

    metadata = {
        "topic_number": data["topic_number"],
        "topic_title": data["topic_title"],
        "topic_title_vi": data.get("topic_title_vi", ""),
        "lesson_number": data["lesson_number"],
        "lesson_title": data["lesson_title"],
        "audio_file_name": "audio.mp3",
        "duration_seconds": int(cursor),
        "text": " ".join(s["text"] for s in segments),
        "segments": segments,
    }
    with open(os.path.join(out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    words = sum(len(s["text"].split()) for s in segments)
    print(f"OK: {out_dir} - {int(cursor) // 60}:{int(cursor) % 60:02d} ({cursor:.0f}s), {len(segments)} segments, {words} words")


if __name__ == "__main__":
    main()
