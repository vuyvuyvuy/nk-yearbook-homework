"""Build the single-file app: template + Kernmodul data (+ optional Fachmodul lessons).

usage: python3 src/build.py [--artifact] <kern.json> <out.html> [fach_dir_with_*.json]

--artifact: drop the <!doctype>/<html>/<head>/<body> wrapper and the charset/viewport
metas, which the claude.ai Artifact publisher adds itself.
"""
import glob, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if a != '--artifact']
artifact = '--artifact' in sys.argv
kern_path, out_path = args[0], args[1]
fach_dir = args[2] if len(args) > 2 else None

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
if artifact:
    for tag in ['<!DOCTYPE html>\n', '<html lang="vi">\n', '<head>\n', '<meta charset="UTF-8">\n',
                '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n', '</head>\n', '<body>\n', '</body>\n', '</html>\n']:
        assert tag in html, tag
        html = html.replace(tag, '', 1)
open(out_path, 'w', encoding='utf-8').write(html)
print(f'{out_path}: {os.path.getsize(out_path) // 1024} KB, {len(lessons)} Fach lessons')
