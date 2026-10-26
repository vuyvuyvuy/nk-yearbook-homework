"""Build the single-file app: template + Kernmodul data (+ optional Fachmodul lessons).

usage: python3 src/build.py <kern.json> <out.html> [fach_dir_with_*.json]
"""
import glob, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
kern_path, out_path = sys.argv[1], sys.argv[2]
fach_dir = sys.argv[3] if len(sys.argv) > 3 else None

html = open(os.path.join(here, 'testas-deathmatch.template.html'), encoding='utf-8').read()
kern = open(kern_path, encoding='utf-8').read()
lessons = []
if fach_dir:
    for f in sorted(glob.glob(os.path.join(fach_dir, '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        lessons += d if isinstance(d, list) else [d]
# </script> inside the JSON would end the script tag early
dump = lambda s: s.replace('</', '<\\/')
assert '/*__KERN__*/null' in html and '/*__FACH__*/[]' in html
html = html.replace('/*__KERN__*/null', dump(kern)).replace('/*__FACH__*/[]', dump(json.dumps(lessons, ensure_ascii=False)))
open(out_path, 'w', encoding='utf-8').write(html)
print(f'{out_path}: {os.path.getsize(out_path) // 1024} KB, {len(lessons)} Fach lessons')
