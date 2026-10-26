"""Extract Kernmodul exercises from the 3 book PDFs into kern.json.

usage: python3 src/extract_kern.py <dir>   (expects <dir>/books/Quyen{1,2,3}_*/*.pdf, writes <dir>/build/kern.json)
"""
import subprocess, re, json, os, io, base64, glob, sys
from PIL import Image
SP = sys.argv[1]
BOOKS = [
  ('fig', 'Quyen1_Figurale_Sequenzen_VN', 'Quyển 1 · Figurale Sequenzen', 'Chuỗi hình'),
  ('math', 'Quyen2_Mathematische_Gleichungen_VN', 'Quyển 2 · Mathematische Gleichungen', 'Phương trình toán'),
  ('latin', 'Quyen3_Lateinische_Quadrate_VN', 'Quyển 3 · Lateinische Quadrate', 'Ô vuông Latin'),
]
def run(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def runb(*a): return subprocess.run(a, capture_output=True).stdout
def to_jpeg_b64(img, width, q, mode='L'):
    img = img.convert(mode)
    if img.width > width: img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
out = {}
tmp = os.path.join(SP, 'build', 'tmpimg'); os.makedirs(tmp, exist_ok=True)
for bid, folder, title, vn in BOOKS:
    pdfs = sorted(glob.glob(f'{SP}/books/{folder}/*.pdf'))
    pages = []  # (pdf, pageno, text)
    for pdf in pdfs:
        t = run('pdftotext', '-raw', pdf, '-').split('\f')
        for i, pt in enumerate(t):
            if pt.strip(): pages.append((pdf, i + 1, pt))
    ex, tips, cur_pruef = {}, [], 0
    in_tips = False
    for pdf, pn, pt in pages:
        lines = [l.strip() for l in pt.splitlines() if l.strip()]
        body = [l for l in lines if not l.startswith('TestAS Kernmodul ·') and not re.fullmatch(r'\d+', l)]
        joined = '\n'.join(body)
        if re.search(r'Phần 1 · Mẹo', joined): in_tips = True
        m = re.search(r'Phần 2 · Prüfung (\d)|Phần \d · Prüfung (\d)', joined)
        if m: in_tips = False; cur_pruef = int(m.group(1) or m.group(2)); continue
        if body and re.match(r'(Phần \d+ · )?Bảng đáp án nhanh', body[0]): in_tips = False; break
        if in_tips:
            tips.append((pdf, pn)); continue
        mq = re.match(r'Bài (\d+\.\d+)\s*(.*)', body[0]) if body else None
        ms = re.search(r'Đáp án & giải bài (\d+\.\d+)', joined)
        if ms:
            k = ms.group(1); e = ex.setdefault(k, {'id': k})
            idx = body.index(next(l for l in body if l.startswith('Đáp án & giải bài')))
            rest = body[idx + 1:]
            e['answerLine'] = rest[0]
            sol = rest[1:]
            if bid == 'latin' and 'Hình lời giải' in sol:  # drop garbled solution grid
                a = sol.index('α β γ δ ε') if 'α β γ δ ε' in sol else 0
                sol = sol[:a] + sol[sol.index('Hình lời giải') + 1:]
            e['solution'] = '\n'.join(sol)
        elif mq:
            k = mq.group(1); e = ex.setdefault(k, {'id': k})
            e['level'] = mq.group(2).strip(); e['pruef'] = cur_pruef
            e['_img'] = (pdf, pn)
            if bid == 'math':
                ml = [l for l in body[1:3] if 'PT' in l]
                if ml: e['meta'] = ml[0]
    # answers
    for k, e in ex.items():
        a = e.get('answerLine', '')
        if bid == 'fig':
            m = re.search(r'Bild 1 = Matrix (\d)\s*Bild 2 = Matrix (\d)', a); e['answer'] = [int(m.group(1)), int(m.group(2))]
        elif bid == 'math':
            e['answer'] = {x: int(y) for x, y in re.findall(r'([A-D])\s*=\s*(\d+)', a)}
        else:
            m = re.search(r'\((.+?)\)\s*=\s*([A-E])', a); e['cell'] = m.group(1); e['answer'] = m.group(2)
    # images
    for k, e in ex.items():
        pdf, pn = e.pop('_img')
        for f in glob.glob(tmp + '/*'): os.remove(f)
        subprocess.run(['pdfimages', '-f', str(pn), '-l', str(pn), '-png', pdf, tmp + '/x'])
        files = sorted(glob.glob(tmp + '/x-*.png'), key=os.path.getsize, reverse=True)
        e['img'] = to_jpeg_b64(Image.open(files[0]), 760 if bid != 'math' else 620, 58)
    tipimgs = []
    for pdf, pn in tips:
        data = runb('pdftoppm', '-f', str(pn), '-l', str(pn), '-r', '100', '-png', pdf)
        tipimgs.append(to_jpeg_b64(Image.open(io.BytesIO(data)), 900, 60, 'RGB'))
    items = sorted(ex.values(), key=lambda e: tuple(map(int, e['id'].split('.'))))
    out[bid] = {'id': bid, 'title': title, 'vn': vn, 'tips': tipimgs, 'ex': items}
    miss = [e['id'] for e in items if 'answer' not in e or 'img' not in e or 'solution' not in e]
    print(bid, 'exercises', len(items), 'tips', len(tipimgs), 'missing', miss, file=sys.stderr)
json.dump(out, open(f'{SP}/build/kern.json', 'w'), ensure_ascii=False)
print(os.path.getsize(f'{SP}/build/kern.json') // 1024, 'KB', file=sys.stderr)
