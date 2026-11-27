"""
Extracts a Multilevel (CEFR) Reading paper PDF into machine-readable form:
  <out>/lines.json   ordered text lines {page, text, x0, x1, italic, bold, blockStart}
  <out>/key.json     Reading answer key {"1": "genes", "7": "E", ...} (right column of the key page)
  <out>/advert_<n>.png  Part 2 advert images, numbered from 7 in reading order

Usage:  python scripts/extract-multilevel-pdf.py "<paper.pdf>" <out-dir>
Requires PyMuPDF (pip install pymupdf).
"""
import json
import os
import re
import sys

import pymupdf

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
doc = pymupdf.open(src)
NOISE = re.compile(r"^(Click to buy NOW!|PDF-XChange Viewer|www\.docu-track\.co ?m|BAGDAD \d{4})$")


def page_lines(page):
    rows = []
    for block in page.get_text("dict", sort=True)["blocks"]:
        if block.get("type") != 0:
            continue
        lines = []
        for ln in block["lines"]:
            spans = [s for s in ln["spans"] if s["text"].strip()]
            text = "".join(s["text"] for s in ln["spans"]).strip()
            if not spans or NOISE.match(text):
                continue
            italic = all(s["flags"] & 2 for s in spans)
            bold = all((s["flags"] & 16) or "Bold" in s["font"] for s in spans)
            lines.append({"page": page.number + 1, "text": text, "x0": round(ln["bbox"][0]), "x1": round(ln["bbox"][2]), "italic": italic, "bold": bold})
        if not lines or (len(lines) == 1 and len(lines[0]["text"]) <= 2):  # stamp fragments
            continue
        lines[0]["blockStart"] = True
        rows.extend(lines)
    return rows


# Locate special pages
key_page = next(p for p in doc if "Answer keys" in p.get_text())
advert_page = None
rows = []
for page in doc:
    t = page.get_text()
    if page.number == 0 or page.number == key_page.number:
        continue
    if advert_page is None and "PART 2" not in t and len(page.get_images()) >= 8 and len(t.strip()) < 300:
        advert_page = page
        continue
    rows.extend(page_lines(page))
json.dump(rows, open(os.path.join(out, "lines.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)

# Answer key: Reading is the right-hand column
key = {}
mid = key_page.rect.width / 2
for line in page_lines(key_page):
    if line["x0"] < mid:
        continue
    m = re.match(r"^(\d{1,2})\s*[.,]\s*(.+)$", line["text"])
    if m:
        key[m.group(1)] = m.group(2).strip()
json.dump(key, open(os.path.join(out, "key.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# Adverts: each advert = an outer "shadow" image + an inner content image; keep the inner (higher-res) one.
saved = 0
if advert_page is not None:
    items = []
    for im in advert_page.get_images(full=True):
        xref = im[0]
        for r in advert_page.get_image_rects(xref):
            items.append((r, xref))
    # keep images that sit inside another image's rectangle (= inner content), else all
    contained = [(r, x) for r, x in items if any(o != r and o.contains(r) for o, _ in items)]
    chosen = contained or items
    col_split = advert_page.rect.width / 2
    # column by the image's centre (the right column can start just left of the page middle)
    chosen.sort(key=lambda t: ((t[0].x0 + t[0].x1) / 2 >= col_split, t[0].y0))
    for n, (r, xref) in enumerate(chosen, start=7):
        pix = pymupdf.Pixmap(doc, xref)
        if pix.n - pix.alpha >= 4:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        pix.save(os.path.join(out, f"advert_{n}.png"))
        saved += 1

print(f"lines: {len(rows)} | key items: {len(key)} | adverts: {saved}")
