import os
import re
import json
import fitz  # PyMuPDF
import whisper
from pydub import AudioSegment

def extract_chapter_text(pdf_path, chapter_num):
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    pattern = rf"(CHAPTER\s+{chapter_num}\b[\s\S]*?)(?=CHAPTER\s+{chapter_num + 1}\b|$)"
    match = re.search(pattern, full_text, re.IGNORECASE)
    return match.group(1).strip() if match else full_text

def process_audio_and_pdf(audio_path, pdf_path, book_num, chapter_num, chapter_title, output_dir):
    print("1. Đang trích xuất text từ PDF...")
    chapter_text = extract_chapter_text(pdf_path, chapter_num)
    
    print("2. Đang phân tích timestamp bằng Whisper AI...")
    model = whisper.load_model("base")
    result = model.transcribe(audio_path, word_timestamps=True)
    
    audio = AudioSegment.from_mp3(audio_path)
    segments = result['segments']
    
    lessons = []
    current_start = 0.0
    target_duration = 300.0
    lesson_idx = 1
    current_text = []
    
    os.makedirs(output_dir, exist_ok=True)
    
    for seg in segments:
        current_text.append(seg['text'])
        duration = seg['end'] - current_start
        
        if duration >= target_duration or seg == segments[-1]:
            start_ms = int(current_start * 1000)
            end_ms = int(seg['end'] * 1000)
            file_name = f"lesson_{lesson_idx}.mp3"
            chunk = audio[start_ms:end_ms]
            chunk.export(os.path.join(output_dir, file_name), format="mp3")
            
            lessons.append({
                "lesson_index": lesson_idx,
                "title": f"Lesson {lesson_idx}",
                "audio_file_name": file_name,
                "duration_seconds": int(seg['end'] - current_start),
                "text": " ".join(current_text).strip()
            })
            lesson_idx += 1
            current_start = seg['end']
            current_text = []

    metadata = {
        "book_number": book_num,
        "chapter_number": chapter_num,
        "chapter_title": chapter_title,
        "total_lessons": len(lessons),
        "lessons": lessons
    }
    
    with open(os.path.join(output_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"Thành công! Đã lưu bài học tại: {output_dir}")
