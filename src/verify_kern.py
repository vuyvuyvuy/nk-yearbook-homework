# Cross-check kern.json answers against each book's quick answer table (run from the same <dir>).
import json, re, subprocess, glob, sys
d = json.load(open('build/kern.json'))
def key(folder):
    f = sorted(glob.glob(f'books/{folder}*/*.pdf'))[-1]
    t = subprocess.run(['pdftotext', '-raw', f, '-'], capture_output=True, text=True).stdout
    return t[t.index('Bảng đáp án nhanh'):].splitlines()
bad = 0
for l in key('Quyen1'):
    m = re.match(r'(\d+) (.*)', l)
    if m and 'B1' in l:
        for p, (a, b) in enumerate(re.findall(r'B1 = M(\d) · B2 = M(\d)', m.group(2)), 1):
            e = next(x for x in d['fig']['ex'] if x['id'] == f'{p}.{m.group(1)}')
            if e['answer'] != [int(a), int(b)]: bad += 1; print('fig', e['id'], e['answer'], a, b)
for l in key('Quyen2'):
    m = re.match(r'(\d+) (A=.*)', l)
    if m:
        groups = re.split(r' (?=A=)', m.group(2).replace(' *', ''))
        for p, g in enumerate(groups, 1):
            exp = {x: int(y) for x, y in re.findall(r'([A-D])=(\d+)', g)}
            e = next(x for x in d['math']['ex'] if x['id'] == f'{p}.{m.group(1)}')
            if e['answer'] != exp: bad += 1; print('math', e['id'], e['answer'], exp)
for l in key('Quyen3'):
    m = re.fullmatch(r'(\d+) ([A-E]) ([A-E]) ([A-E])', l.strip())
    if m:
        for p in range(1, 4):
            e = next(x for x in d['latin']['ex'] if x['id'] == f'{p}.{m.group(1)}')
            if e['answer'] != m.group(p + 1): bad += 1; print('latin', e['id'], e['answer'], m.group(p + 1))
print('mismatches', bad)
