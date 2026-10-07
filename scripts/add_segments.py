"""Thêm timestamp từng câu vào các chapter đã xử lý bằng bản app cũ (không cần cắt lại audio).

Dùng:  python scripts/add_segments.py Book_1/Chapter_1_Output
Với mỗi lesson_N.mp3 trong thư mục: chạy Whisper, cập nhật "segments" và "text" trong metadata.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "windowApp"))
from sentence_splitter import build_sentences  # noqa: E402

import whisper  # noqa: E402


def main(chapter_dir):
    meta_path = os.path.join(chapter_dir, "metadata.json")
    with open(meta_path, encoding="utf-8-sig") as f:
        metadata = json.load(f)

    model = whisper.load_model("base")
    for lesson in metadata["lessons"]:
        audio_path = os.path.join(chapter_dir, lesson["audio_file_name"])
        print(f"Đang xử lý {lesson['audio_file_name']} ...", flush=True)
        result = model.transcribe(audio_path, word_timestamps=True)
        sentences = build_sentences(result)
        lesson["segments"] = [
            {"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"]} for s in sentences
        ]
        lesson["text"] = " ".join(s["text"] for s in sentences)
        # Ghi sau mỗi lesson để lỡ dừng giữa chừng vẫn giữ được phần đã xong
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"  -> {len(sentences)} câu", flush=True)

    print("Xong!")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Cách dùng: python scripts/add_segments.py <thư mục chapter>")
    main(sys.argv[1])
