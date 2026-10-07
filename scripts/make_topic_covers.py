"""Tạo 5 ảnh bìa SVG đơn giản (16:9) cho mỗi topic -> public/topic-covers/<slug>/1.svg .. 5.svg

Dùng:  python scripts/make_topic_covers.py            # tạo lại ảnh của mọi topic có trong SCENES
Thêm topic mới: thêm một mục vào SCENES (slug = slug URL của topic, ví dụ "travel-and-airports"),
mỗi mục gồm đúng 5 cảnh (bg1, bg2, phần thân SVG trong khung 640x360).
Web: lib/topicCovers.js chọn ảnh theo bài (L01-L05 = ảnh 1-5, các bài sau lấy ngẫu nhiên trong 5 ảnh).
"""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "topic-covers")

CLOUD = '<g fill="#fff" opacity=".85"><ellipse cx="{x}" cy="{y}" rx="{w}" ry="{h}"/><ellipse cx="{x2}" cy="{y2}" rx="{w2}" ry="{h2}"/></g>'


def cloud(x, y, s=1.0):
    return CLOUD.format(x=x, y=y, w=60 * s, h=18 * s, x2=x + 25 * s, y2=y - 10 * s, w2=36 * s, h2=16 * s)


def svg(bg1, bg2, body):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">'
        f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient></defs>'
        f'<rect width="640" height="360" fill="url(#bg)"/>{body}</svg>\n'
    )


# ---------- Travel & Airports ----------
T01 = [
    # 1 máy bay trên mây
    ("#7dd3fc", "#0369a1", cloud(110, 90, 1.1) + cloud(520, 260, 1.3) + cloud(480, 70, .8) + cloud(130, 290, .9) + """
<g transform="rotate(-16 320 180)">
  <polygon points="300,162 370,162 318,84 288,84" fill="#e2e8f0"/>
  <polygon points="300,198 370,198 318,276 288,276" fill="#cbd5e1"/>
  <polygon points="190,168 232,168 196,118 176,118" fill="#e2e8f0"/>
  <rect x="150" y="160" width="330" height="42" rx="21" fill="#fff"/>
  <path d="M440 160 q40 0 40 21 q0 21 -40 21z" fill="#f8fafc"/>
  <g fill="#38bdf8"><circle cx="250" cy="181" r="6"/><circle cx="280" cy="181" r="6"/><circle cx="310" cy="181" r="6"/><circle cx="340" cy="181" r="6"/><circle cx="370" cy="181" r="6"/><circle cx="405" cy="181" r="7"/></g>
</g>"""),
    # 2 hộ chiếu + thẻ lên máy bay
    ("#5eead4", "#4338ca", """
<g transform="rotate(8 360 190)">
  <rect x="300" y="80" width="250" height="200" rx="14" fill="#fff"/>
  <rect x="300" y="80" width="70" height="200" rx="14" fill="#fb923c"/>
  <line x1="370" y1="90" x2="370" y2="270" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="7 6"/>
  <rect x="392" y="108" width="130" height="14" rx="7" fill="#94a3b8"/>
  <rect x="392" y="136" width="90" height="14" rx="7" fill="#cbd5e1"/>
  <g fill="#334155"><rect x="392" y="214" width="6" height="46"/><rect x="404" y="214" width="3" height="46"/><rect x="412" y="214" width="8" height="46"/><rect x="426" y="214" width="4" height="46"/><rect x="436" y="214" width="6" height="46"/><rect x="448" y="214" width="3" height="46"/><rect x="458" y="214" width="9" height="46"/><rect x="474" y="214" width="4" height="46"/><rect x="484" y="214" width="6" height="46"/></g>
</g>
<g transform="rotate(-8 230 190)">
  <rect x="120" y="60" width="200" height="260" rx="16" fill="#1e3a8a"/>
  <rect x="132" y="72" width="176" height="236" rx="10" fill="none" stroke="#fbbf24" stroke-width="3"/>
  <circle cx="220" cy="160" r="46" fill="none" stroke="#fbbf24" stroke-width="5"/>
  <ellipse cx="220" cy="160" rx="20" ry="46" fill="none" stroke="#fbbf24" stroke-width="4"/>
  <line x1="174" y1="160" x2="266" y2="160" stroke="#fbbf24" stroke-width="4"/>
  <rect x="170" y="240" width="100" height="12" rx="6" fill="#fbbf24"/>
</g>"""),
    # 3 vali
    ("#c4b5fd", "#6366f1", """
<ellipse cx="320" cy="318" rx="170" ry="14" fill="#000" opacity=".15"/>
<path d="M260 100 v-30 a16 16 0 0 1 16 -16 h88 a16 16 0 0 1 16 16 v30" fill="none" stroke="#1e293b" stroke-width="14" stroke-linecap="round"/>
<rect x="150" y="96" width="340" height="212" rx="26" fill="#fb923c"/>
<rect x="150" y="96" width="340" height="212" rx="26" fill="none" stroke="#c2410c" stroke-width="4"/>
<rect x="212" y="96" width="26" height="212" fill="#fdba74"/>
<rect x="402" y="96" width="26" height="212" fill="#fdba74"/>
<rect x="296" y="190" width="48" height="34" rx="8" fill="#fde68a" stroke="#b45309" stroke-width="3"/>
<circle cx="188" cy="150" r="14" fill="#fff" opacity=".9"/><circle cx="452" cy="256" r="12" fill="#38bdf8"/>
<circle cx="200" cy="318" r="14" fill="#1e293b"/><circle cx="440" cy="318" r="14" fill="#1e293b"/>"""),
    # 4 tàu hỏa
    ("#99f6e4", "#0f766e", """
<rect y="270" width="640" height="90" fill="#134e4a" opacity=".55"/>
<g stroke="#99f6e4" stroke-width="5" opacity=".8"><line x1="0" y1="305" x2="640" y2="305"/><line x1="0" y1="338" x2="640" y2="338"/></g>
<rect x="190" y="52" width="260" height="228" rx="40" fill="#fff"/>
<rect x="190" y="52" width="260" height="70" rx="40" fill="#0ea5e9"/>
<rect x="190" y="90" width="260" height="32" fill="#0ea5e9"/>
<rect x="214" y="104" width="212" height="86" rx="14" fill="#0f172a"/>
<rect x="224" y="112" width="92" height="70" rx="8" fill="#38bdf8" opacity=".55"/>
<rect x="324" y="112" width="92" height="70" rx="8" fill="#38bdf8" opacity=".35"/>
<circle cx="238" cy="224" r="13" fill="#fde047"/><circle cx="402" cy="224" r="13" fill="#fde047"/>
<rect x="290" y="214" width="60" height="14" rx="7" fill="#94a3b8"/>
<rect x="200" y="258" width="240" height="22" rx="6" fill="#0f766e"/>"""),
    # 5 quả địa cầu + ghim bản đồ
    ("#6ee7b7", "#0369a1", """
<circle cx="290" cy="190" r="125" fill="#1d4ed8"/>
<g fill="#4ade80"><path d="M210 140 q30 -34 66 -20 q20 24 -4 46 q-34 18 -50 6z"/><path d="M300 210 q40 -10 60 20 q4 40 -30 54 q-30 -20 -30 -74z"/><path d="M330 120 q30 -8 44 14 q-10 22 -40 18z"/></g>
<ellipse cx="290" cy="190" rx="52" ry="125" fill="none" stroke="#bfdbfe" stroke-width="3" opacity=".7"/>
<line x1="165" y1="190" x2="415" y2="190" stroke="#bfdbfe" stroke-width="3" opacity=".7"/>
<circle cx="290" cy="190" r="125" fill="none" stroke="#bfdbfe" stroke-width="3" opacity=".7"/>
<rect x="268" y="318" width="44" height="12" rx="6" fill="#1e3a8a"/>
<path d="M440 70 c-34 0 -58 24 -58 56 c0 40 58 100 58 100 s58 -60 58 -100 c0 -32 -24 -56 -58 -56z" fill="#ef4444" stroke="#fff" stroke-width="6"/>
<circle cx="440" cy="126" r="20" fill="#fff"/>"""),
]

# ---------- Money & Banking ----------
T15 = [
    # 1 ngân hàng
    ("#34d399", "#047857", """
<polygon points="320,52 520,128 120,128" fill="#fff"/>
<circle cx="320" cy="104" r="16" fill="#fbbf24"/>
<rect x="132" y="138" width="376" height="16" rx="4" fill="#f1f5f9"/>
<g fill="#fff"><rect x="150" y="160" width="40" height="110" rx="5"/><rect x="230" y="160" width="40" height="110" rx="5"/><rect x="370" y="160" width="40" height="110" rx="5"/><rect x="450" y="160" width="40" height="110" rx="5"/></g>
<rect x="296" y="168" width="48" height="102" rx="6" fill="#064e3b"/>
<rect x="124" y="274" width="392" height="18" rx="4" fill="#f1f5f9"/>
<rect x="104" y="294" width="432" height="22" rx="4" fill="#e2e8f0"/>"""),
    # 2 thẻ ngân hàng
    ("#6ee7b7", "#0f766e", """
<g transform="rotate(-10 300 180)"><rect x="130" y="80" width="360" height="220" rx="24" fill="#fbbf24"/></g>
<g transform="rotate(7 330 190)">
  <rect x="150" y="70" width="360" height="220" rx="24" fill="#1e293b"/>
  <rect x="150" y="112" width="360" height="42" fill="#0f172a"/>
  <rect x="186" y="176" width="64" height="48" rx="9" fill="#fcd34d"/>
  <line x1="186" y1="200" x2="250" y2="200" stroke="#b45309" stroke-width="3"/><line x1="218" y1="176" x2="218" y2="224" stroke="#b45309" stroke-width="3"/>
  <rect x="186" y="248" width="130" height="12" rx="6" fill="#64748b"/>
  <circle cx="440" cy="248" r="22" fill="#ef4444" opacity=".9"/><circle cx="466" cy="248" r="22" fill="#fbbf24" opacity=".9"/>
</g>"""),
    # 3 xếp tiền xu
    ("#fde68a", "#d97706", """
<ellipse cx="320" cy="320" rx="230" ry="16" fill="#000" opacity=".15"/>
<g>
  <g fill="#fbbf24" stroke="#b45309" stroke-width="4">
    <rect x="130" y="270" width="110" height="26" rx="13"/><rect x="130" y="244" width="110" height="26" rx="13"/><rect x="130" y="218" width="110" height="26" rx="13"/>
  </g>
  <g fill="#fbbf24" stroke="#b45309" stroke-width="4">
    <rect x="262" y="270" width="110" height="26" rx="13"/><rect x="262" y="244" width="110" height="26" rx="13"/><rect x="262" y="218" width="110" height="26" rx="13"/><rect x="262" y="192" width="110" height="26" rx="13"/><rect x="262" y="166" width="110" height="26" rx="13"/><rect x="262" y="140" width="110" height="26" rx="13"/>
  </g>
  <g fill="#fbbf24" stroke="#b45309" stroke-width="4"><rect x="394" y="270" width="110" height="26" rx="13"/><rect x="394" y="244" width="110" height="26" rx="13"/></g>
</g>
<circle cx="450" cy="170" r="52" fill="#fcd34d" stroke="#b45309" stroke-width="6"/>
<circle cx="450" cy="170" r="38" fill="none" stroke="#b45309" stroke-width="3" opacity=".6"/>
<text x="450" y="192" font-family="Arial,Helvetica,sans-serif" font-size="58" font-weight="700" fill="#b45309" text-anchor="middle">$</text>"""),
    # 4 ví + tờ tiền
    ("#5eead4", "#115e59", """
<g transform="rotate(-8 300 150)"><rect x="150" y="60" width="300" height="160" rx="14" fill="#bbf7d0" stroke="#15803d" stroke-width="5"/><circle cx="300" cy="140" r="40" fill="#86efac" stroke="#15803d" stroke-width="5"/><text x="300" y="158" font-family="Arial,Helvetica,sans-serif" font-size="48" font-weight="700" fill="#15803d" text-anchor="middle">$</text><circle cx="184" cy="94" r="10" fill="#15803d"/><circle cx="416" cy="186" r="10" fill="#15803d"/></g>
<g transform="rotate(5 330 150)"><rect x="200" y="30" width="300" height="160" rx="14" fill="#d9f99d" stroke="#4d7c0f" stroke-width="5"/><circle cx="350" cy="110" r="36" fill="#bef264" stroke="#4d7c0f" stroke-width="5"/></g>
<rect x="120" y="170" width="400" height="150" rx="28" fill="#92400e"/>
<rect x="120" y="170" width="400" height="38" rx="19" fill="#b45309"/>
<rect x="420" y="228" width="100" height="56" rx="28" fill="#78350f"/>
<circle cx="450" cy="256" r="11" fill="#fcd34d"/>"""),
    # 5 biểu đồ cột tăng
    ("#86efac", "#166534", """
<g fill="#fff"><rect x="120" y="230" width="62" height="80" rx="8" opacity=".85"/><rect x="214" y="190" width="62" height="120" rx="8" opacity=".9"/><rect x="308" y="150" width="62" height="160" rx="8"/><rect x="402" y="100" width="62" height="210" rx="8"/></g>
<rect x="100" y="312" width="400" height="8" rx="4" fill="#14532d" opacity=".6"/>
<polyline points="140,200 238,150 330,112 440,62" fill="none" stroke="#fbbf24" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<polygon points="440,38 478,84 418,86" fill="#fbbf24" transform="rotate(14 440 62)"/>
<circle cx="540" cy="110" r="42" fill="#fcd34d" stroke="#b45309" stroke-width="5"/>
<text x="540" y="128" font-family="Arial,Helvetica,sans-serif" font-size="48" font-weight="700" fill="#b45309" text-anchor="middle">$</text>"""),
]

SCENES = {
    "travel-and-airports": T01,
    "money-and-banking": T15,
}


def main():
    for slug, scenes in SCENES.items():
        assert len(scenes) == 5, f"{slug}: cần đúng 5 cảnh"
        folder = os.path.join(OUT, slug)
        os.makedirs(folder, exist_ok=True)
        for i, (bg1, bg2, body) in enumerate(scenes, 1):
            with open(os.path.join(folder, f"{i}.svg"), "w", encoding="utf-8") as f:
                f.write(svg(bg1, bg2, body))
        print(f"OK: {folder} (5 ảnh)")


if __name__ == "__main__":
    main()
