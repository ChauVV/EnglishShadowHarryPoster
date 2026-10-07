import re

# Từ viết tắt có dấu chấm nhưng KHÔNG kết thúc câu (vd: "Mrs. Dursley")
ABBREVIATIONS = {"mr.", "mrs.", "ms.", "dr.", "st.", "jr.", "sr.", "prof.", "vs.", "mt.", "etc."}
SENTENCE_END = re.compile(r"[.!?][\"'”’)\]]*$")


def _is_sentence_end(word):
    token = word.strip().lower()
    return bool(SENTENCE_END.search(token)) and token not in ABBREVIATIONS


def build_sentences(result):
    """Chuyển kết quả Whisper (transcribe(..., word_timestamps=True)) thành danh sách câu
    [{"start", "end", "text"}] với timestamp chính xác theo từng từ.
    Nếu không có word timestamps thì dùng nguyên segment của Whisper."""
    words = [w for seg in result["segments"] for w in seg.get("words", [])]
    if not words:
        return [
            {"start": s["start"], "end": s["end"], "text": s["text"].strip()}
            for s in result["segments"]
            if s["text"].strip()
        ]

    sentences = []
    buf = []
    for w in words:
        buf.append(w)
        if _is_sentence_end(w["word"]):
            sentences.append(_make(buf))
            buf = []
    if buf:
        sentences.append(_make(buf))
    return sentences


def _make(words):
    return {
        "start": words[0]["start"],
        "end": words[-1]["end"],
        "text": "".join(w["word"] for w in words).strip(),
    }
