"""Atlas ciudadano · reconstrucción de datos (CCPC 2009–2024 del INE → JSON del sitio).

Corrige los dos errores detectados en la auditoría:
  1. Lectura con csv.reader (antes split(','): un municipio con coma en el nombre recorría columnas).
  2. Cruce municipal INE→INEGI por NOMBRE normalizado dentro del estado (antes por clave; no coinciden).

Uso:  python3 scripts/build_data.py <carpeta_con_x2009..x2024>
Escribe dist/assets/data/estados.json, dist/assets/mpios/*.json (campo y) y dist/assets/data/buscar.json.
"""
import csv, glob, json, os, re, sys, unicodedata
from collections import defaultdict

RAW = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'dist', 'assets')
YEARS = [2009, 2012, 2015, 2018, 2021, 2024]

def bucket(a):
    return 0 if a < 30 else 1 if a < 45 else 2 if a < 60 else 3

def rows(path):
    raw = open(path, 'rb').read()
    try: txt = raw.decode('utf-8-sig')
    except UnicodeDecodeError: txt = raw.decode('latin-1')
    r = csv.reader(txt.splitlines())
    head = next(r)
    ix = {k.strip(): i for i, k in enumerate(head)}
    for p in r:
        if len(p) < len(head): continue
        yield p, ix

# ---------- 1. agregación por (estado, municipio INE, sexo, edad) ----------
agg = {y: defaultdict(lambda: [0, 0]) for y in YEARS}      # (e,m,s,a) -> [base, sv]
names = {y: {} for y in YEARS}                              # (e,m) -> nombre INE
skipped = defaultdict(int)
for y in YEARS:
    for f in sorted(glob.glob(os.path.join(RAW, f'x{y}', '**', '*.csv'), recursive=True)):
        for p, ix in rows(f):
            try:
                e = int(p[ix['EDOCVE']]); m = int(p[ix['MPIOCVE']]); s = int(p[ix['SEXO']]); a = int(p[ix['EDAD']])
                ln = int(p[ix['LN']]); sv = int(p[ix['SV']]); ns = int(p[ix['NS']] or 0)
            except (ValueError, KeyError):
                skipped[y] += 1; continue
            if s not in (0, 1): s = 2   # no binario (2024): cuenta en el total
            k = (e, m, s, bucket(max(a, 18)))
            t = agg[y][k]; t[0] += ln - ns; t[1] += sv
            names[y].setdefault((e, m), p[ix['MPIONOM']])
print('filas omitidas:', dict(skipped))

# ---------- 2. estados ----------
def flat(cells):
    out = [0] * 24
    for (s, a), (b, v) in cells.items():
        i = (s * 4 + a) * 2; out[i] += b; out[i + 1] += v
    return out
st = {}
for y in YEARS:
    acc = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for (e, m, s, a), (b, v) in agg[y].items():
        c = acc['%02d' % e][(s, a)]; c[0] += b; c[1] += v
    for cc, cells in acc.items():
        st.setdefault(cc, {})[str(y)] = flat(cells)
json.dump({'years': YEARS, 'states': dict(sorted(st.items()))}, open(os.path.join(A, 'data', 'estados.json'), 'w'), separators=(',', ':'))

# ---------- 3. cruce municipal por nombre ----------
STOP = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'heroica', 'ciudad', 'villa', 'h', 'municipio'}
def norm(n):
    n = unicodedata.normalize('NFD', n.lower())
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'\bdto\.? ?\d+', ' ', n)                     # "San Juan Mixtepec Dto 08"
    n = re.sub(r'[^a-z0-9ñ ]', ' ', n)
    w = [{'gral': 'general', 'dr': 'doctor'}.get(x, x) for x in n.split()]
    return ' '.join(x for x in w if x not in STOP)
# Casos conocidos con nombre distinto entre INE e INEGI (se amplía con el reporte de no cruzados).
# Errores de captura o cambios de nombre en las tablas del INE → id INEGI (revisados a mano).
ALIAS = {
    '04': {'hopelche en': '04006', 'dzitblache': '04013'},
    '05': {'cuatrocienegas': '05007'},
    '07': {'maravilla tejenapa': '07115', 'huitiupaan': '07039'},
    '13': {'san aguston metzquititlan': '13036'},
    '20': {'hidalgo': '20038'},
    '23': {'solidaridad': '23008'},
    '29': {'zitlaltepec trinidad sanchez santos': '29037'},
    '30': {'alto lucero gutierrez barios': '30009'},
}

by_mpio = {y: defaultdict(dict) for y in YEARS}
for y in YEARS:
    for (e, m, s, a), v in agg[y].items(): by_mpio[y][(e, m)][(s, a)] = v

report = []
buscar = []
for cc in sorted(st):
    path = os.path.join(A, 'mpios', f'{cc}.json')
    geo = json.load(open(path))
    by_name = {}
    for g in geo: by_name.setdefault(norm(g['n']), []).append(g)
    per = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0, 0])))   # inegi id -> year -> (s,a)
    for y in YEARS:
        for (e, m), nm in names[y].items():
            if '%02d' % e != cc: continue
            key = ALIAS.get(cc, {}).get(norm(nm))
            cand = [g for g in geo if g['id'] == key] if key else by_name.get(norm(nm), [])
            if len(cand) > 1:   # nombre repetido en el estado: se empareja por tamaño (base INE ↔ población INEGI)
                same = sorted([mm for (ee, mm), nn in names[y].items() if '%02d' % ee == cc and norm(nn) == norm(nm)],
                              key=lambda mm: -sum(v[0] for v in by_mpio[y][(e, mm)].values()))
                geos = sorted(cand, key=lambda g: -(g.get('pob') or 0))
                if len(same) == len(geos): cand = [geos[same.index(m)]]
            if not cand:   # coincidencia por contención (p. ej. nombres largos/cortos)
                n0 = norm(nm)
                cand = [g for k, gs in by_name.items() for g in gs if n0 and (n0 in k or k in n0) and min(len(n0), len(k)) >= 5]
            if len(cand) != 1:
                report.append((cc, y, m, nm, [g['n'] for g in cand][:3]))
                continue
            gid = cand[0]['id']
            for (s, a), (b, v) in by_mpio[y].get((e, m), {}).items():
                c = per[gid][y][(s, a)]; c[0] += b; c[1] += v
    for g in geo:
        ys = per.get(g['id'])
        g['y'] = {str(y): flat(ys[y]) for y in YEARS if ys and y in ys} or None
        buscar.append([cc, g['id'], g['n'], g.get('pob') or 0])
    json.dump(geo, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
json.dump(buscar, open(os.path.join(A, 'data', 'buscar.json'), 'w'), separators=(',', ':'), ensure_ascii=False)

json.dump(report, open(os.path.join(ROOT, 'scripts', 'no_cruzados.json'), 'w'), ensure_ascii=False, indent=0)
print('municipios INE sin pareja única:', len(report), '(ver scripts/no_cruzados.json)')
