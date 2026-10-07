import os
import re
import sys
import json
import threading

# Khi chạy không có console (pythonw / exe windowed), stdout/stderr là None
# -> tqdm của Whisper (tải model, tiến trình) sẽ lỗi "'NoneType' has no attribute 'write'"
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk  # pip install customtkinter
import fitz  # PyMuPDF: pip install PyMuPDF
import whisper  # pip install openai-whisper
from pydub import AudioSegment  # pip install pydub
from sentence_splitter import build_sentences

# Cấu hình giao diện CustomTkinter
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class ShadowingApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Harry Potter Shadowing - Auto Splitter & Processor")
        self.geometry("650 x 600")
        self.resizable(False, False)

        # Title Header
        self.label_title = ctk.CTkLabel(
            self, text="⚡ Harry Potter Audio & PDF Splitter", font=ctk.CTkFont(size=20, weight="bold")
        )
        self.label_title.pack(pady=(20, 10))

        # Form Inputs
        self.frame_form = ctk.CTkFrame(self)
        self.frame_form.pack(padx=20, pady=10, fill="x")

        # Book & Chapter Selection
        self.lbl_book = ctk.CTkLabel(self.frame_form, text="Chọn Tập (Book):")
        self.lbl_book.grid(row=0, column=0, padx=10, pady=10, sticky="w")
        
        self.combo_book = ctk.CTkComboBox(self.frame_form, values=[f"Tập {i}" for i in range(1, 8)])
        self.combo_book.grid(row=0, column=1, padx=10, pady=10, sticky="ew")

        self.lbl_chap_num = ctk.CTkLabel(self.frame_form, text="Số Chapter:")
        self.lbl_chap_num.grid(row=1, column=0, padx=10, pady=10, sticky="w")
        
        self.entry_chap_num = ctk.CTkEntry(self.frame_form, placeholder_text="Ví dụ: 1")
        self.entry_chap_num.grid(row=1, column=1, padx=10, pady=10, sticky="ew")

        self.lbl_chap_title = ctk.CTkLabel(self.frame_form, text="Tên Chapter:")
        self.lbl_chap_title.grid(row=2, column=0, padx=10, pady=10, sticky="w")
        
        self.entry_chap_title = ctk.CTkEntry(self.frame_form, placeholder_text="Ví dụ: The Boy Who Lived")
        self.entry_chap_title.grid(row=2, column=1, padx=10, pady=10, sticky="ew")

        # File Pickers
        self.btn_audio = ctk.CTkButton(self.frame_form, text="Chọn file Audio MP3", command=self.select_audio)
        self.btn_audio.grid(row=3, column=0, padx=10, pady=10)
        self.lbl_audio_path = ctk.CTkLabel(self.frame_form, text="Chưa chọn file", text_color="gray")
        self.lbl_audio_path.grid(row=3, column=1, padx=10, pady=10, sticky="w")

        self.btn_pdf = ctk.CTkButton(self.frame_form, text="Chọn file PDF Tập", command=self.select_pdf)
        self.btn_pdf.grid(row=4, column=0, padx=10, pady=10)
        self.lbl_pdf_path = ctk.CTkLabel(self.frame_form, text="Chưa chọn file", text_color="gray")
        self.lbl_pdf_path.grid(row=4, column=1, padx=10, pady=10, sticky="w")

        # Action Button
        self.btn_process = ctk.CTkButton(
            self, text="🚀 BẮT ĐẦU XỬ LÝ & CẮT BÀI", font=ctk.CTkFont(size=14, weight="bold"),
            fg_color="#10B981", hover_color="#059669", height=45, command=self.start_processing_thread
        )
        self.btn_process.pack(padx=20, pady=15, fill="x")

        # Log & Status Box
        self.textbox_log = ctk.CTkTextbox(self, height=180, font=ctk.CTkFont(size=12))
        self.textbox_log.pack(padx=20, pady=(0, 20), fill="both")
        self.log("Sẵn sàng xử lý file...")

        self.audio_path = ""
        self.pdf_path = ""

    def select_audio(self):
        path = filedialog.askopenfilename(filetypes=[("Audio Files", "*.mp3 *.wav")])
        if path:
            self.audio_path = path
            self.lbl_audio_path.configure(text=os.path.basename(path), text_color="white")
            self.autofill_chapter_info(path)

    def autofill_chapter_info(self, audio_path):
        # "01 Chapter 1_ The Boy Who Lived.mp3" -> số chapter = 1, tên = "The Boy Who Lived"
        stem = os.path.splitext(os.path.basename(audio_path))[0]
        match = re.search(r"chapter\s*(\d+)[\s_:.\-–]*(.*)$", stem, re.IGNORECASE)
        if not match:
            return
        chap_num, chap_title = match.group(1), match.group(2).strip()
        self.entry_chap_num.delete(0, tk.END)
        self.entry_chap_num.insert(0, str(int(chap_num)))
        self.entry_chap_title.delete(0, tk.END)
        if chap_title:
            self.entry_chap_title.insert(0, chap_title)

    def select_pdf(self):
        path = filedialog.askopenfilename(filetypes=[("PDF Files", "*.pdf")])
        if path:
            self.pdf_path = path
            self.lbl_pdf_path.configure(text=os.path.basename(path), text_color="white")

    def log(self, message):
        self.textbox_log.insert(tk.END, f"> {message}\n")
        self.textbox_log.see(tk.END)

    def start_processing_thread(self):
        if not self.audio_path or not self.pdf_path or not self.entry_chap_num.get():
            messagebox.showwarning("Cảnh báo", "Vui lòng điền đầy đủ thông tin và chọn đủ 2 file!")
            return

        self.btn_process.configure(state="disabled", text="⏳ ĐANG XỬ LÝ (XIN CHỜ)...")
        # Chạy trong Thread riêng để giao diện UI không bị đóng băng
        threading.Thread(target=self.process_files, daemon=True).start()

    def extract_chapter_text(self, pdf_path, chapter_num):
        doc = fitz.open(pdf_path)
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        pattern = rf"(CHAPTER\s+{chapter_num}\b[\s\S]*?)(?=CHAPTER\s+{int(chapter_num) + 1}\b|$)"
        match = re.search(pattern, full_text, re.IGNORECASE)
        return match.group(1).strip() if match else full_text

    def process_files(self):
        try:
            book_str = self.combo_book.get()
            book_num = int(book_str.split(" ")[1])
            chap_num = int(self.entry_chap_num.get())
            chap_title = self.entry_chap_title.get() or f"Chapter {chap_num}"

            out_dir = os.path.join(f"Book_{book_num}", f"Chapter_{chap_num}_Output")

            self.log(f"Bắt đầu trích xuất Text Chapter {chap_num} từ PDF...")
            chapter_text = self.extract_chapter_text(self.pdf_path, chap_num)

            self.log("Đang chạy Whisper AI nhận diện timestamp audio (Có thể mất 1-2 phút)...")
            model = whisper.load_model("base")
            result = model.transcribe(self.audio_path, word_timestamps=True)

            self.log("Đang tiến hành cắt nhỏ Audio MP3 thành các phần ~5 phút...")
            audio = AudioSegment.from_file(self.audio_path)
            # Cắt theo ranh giới CÂU (timestamp theo từng từ), không cắt giữa câu
            segments = build_sentences(result)

            lessons = []
            current_start = 0.0
            target_duration = 300.0
            lesson_idx = 1
            current_text = []
            current_segments = []

            os.makedirs(out_dir, exist_ok=True)

            for seg in segments:
                current_text.append(seg['text'])
                # Timestamp tính theo đầu file lesson (không phải đầu file gốc) để web seek từng câu
                current_segments.append({
                    "start": round(seg['start'] - current_start, 2),
                    "end": round(seg['end'] - current_start, 2),
                    "text": seg['text'].strip()
                })
                duration = seg['end'] - current_start

                if duration >= target_duration or seg == segments[-1]:
                    start_ms = int(current_start * 1000)
                    end_ms = int(seg['end'] * 1000)

                    file_name = f"lesson_{lesson_idx}.mp3"
                    chunk = audio[start_ms:end_ms]
                    chunk.export(os.path.join(out_dir, file_name), format="mp3")

                    lessons.append({
                        "lesson_index": lesson_idx,
                        "title": f"Lesson {lesson_idx}",
                        "audio_file_name": file_name,
                        "duration_seconds": int(seg['end'] - current_start),
                        "text": " ".join(current_text).strip(),
                        "segments": current_segments
                    })

                    self.log(f"✔ Đã tạo Lesson {lesson_idx} ({int(seg['end'] - current_start)} giây)")
                    lesson_idx += 1
                    current_start = seg['end']
                    current_text = []
                    current_segments = []

            # Tạo Metadata JSON
            metadata = {
                "book_number": book_num,
                "chapter_number": chap_num,
                "chapter_title": chap_title,
                "total_lessons": len(lessons),
                "lessons": lessons
            }

            with open(os.path.join(out_dir, "metadata.json"), "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            self.log(f"🎉 HOÀN THÀNH! Thư mục kết quả: {os.path.abspath(out_dir)}")
            self.log("Bây giờ bạn chỉ cần kéo thư mục này lên Google Drive!")
            messagebox.showinfo("Thành công", f"Đã cắt xong {len(lessons)} bài học!")

        except Exception as e:
            self.log(f"❌ LỖI: {str(e)}")
            messagebox.showerror("Lỗi", str(e))
        finally:
            self.btn_process.configure(state="normal", text="🚀 BẮT ĐẦU XỬ LÝ & CẮT BÀI")

if __name__ == "__main__":
    app = ShadowingApp()
    app.mainloop()