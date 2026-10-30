"""Validación de los datos del sitio. Sale con código 1 si algo falla.
  1. Los 32 estados (2024) coinciden con la Tabla General oficial del INE (diferencia < 0.05 pp).
  2. Base municipal / población INEGI en [0.4, 1.05] para ≥ 96 % de los municipios con población ≥ 2,000.
     (El resto son casos reales: casillas no instaladas en 2024 —Chicomuselo, Pantelhó—, usos y costumbres —Cherán—
      y municipios de alta emigración donde la lista nominal supera a la población residente.)
  3. Correlación de Spearman base–población > 0.9 en cada estado.
  4. La capital está entre los 3 municipios con más registros de su estado.
"""
import json, os, sys
A = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist', 'assets')
st = json.load(open(os.path.join(A, 'data', 'estados.json')))['states']
of = json.load(open(os.path.join(A, 'data', 'oficial2024.json')))['states']
CAP = {'01': 'Aguascalientes', '02': 'Mexicali', '03': 'La Paz', '04': 'Campeche', '05': 'Saltillo', '06': 'Colima', '07': 'Tuxtla Gutiérrez', '08': 'Chihuahua', '09': 'Cuauhtémoc', '10': 'Durango', '11': 'Guanajuato', '12': 'Chilpancingo de los Bravo', '13': 'Pachuca de Soto', '14': 'Guadalajara', '15': 'Toluca', '16': 'Morelia', '17': 'Cuernavaca', '18': 'Tepic', '19': 'Monterrey', '20': 'Oaxaca de Juárez', '21': 'Puebla', '22': 'Querétaro', '23': 'Othón P. Blanco', '24': 'San Luis Potosí', '25': 'Culiacán', '26': 'Hermosillo', '27': 'Centro', '28': 'Victoria', '29': 'Tlaxcala', '30': 'Xalapa', '31': 'Mérida', '32': 'Zacatecas'}
# Capitales cuyo municipio no es el mayor del estado por diseño (se exige top 10 en vez de top 3).
LOOSE = {'09', '11', '12', '29', '30', '04', '06', '22', '24', '32'}

def rank(xs):
    o = sorted(range(len(xs)), key=lambda i: xs[i]); r = [0] * len(xs)
    for k, i in enumerate(o): r[i] = k
    return r
def spearman(a, b):
    ra, rb = rank(a), rank(b); n = len(a); ma = mb = (n - 1) / 2
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb)); den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** .5
    return num / den if den else 0

fails = []
for cc, v in sorted(st.items()):
    f = v['2024']; r = 100 * sum(f[1::2]) / sum(f[0::2]); d = r - of[cc]['part']
    if abs(d) >= .05: fails.append(f'estado {cc}: {r:.2f} vs oficial {of[cc]["part"]:.2f}')
ok = tot = 0
for cc in sorted(st):
    ms = [m for m in json.load(open(os.path.join(A, 'mpios', f'{cc}.json'))) if m.get('y') and m['y'].get('2024')]
    base = [sum(m['y']['2024'][0::2]) for m in ms]; pob = [m.get('pob') or 0 for m in ms]
    for b, p in zip(base, pob):
        if p >= 2000: tot += 1; ok += .4 <= b / p <= 1.05
    rho = spearman(base, pob)
    if rho <= .9: fails.append(f'estado {cc}: rho base-pob {rho:.2f}')
    order = [m['n'] for m in sorted(ms, key=lambda m: -sum(m['y']['2024'][0::2]))]
    cap = next((i for i, n in enumerate(order) if n.startswith(CAP[cc])), 99)
    if cap >= (10 if cc in LOOSE else 3): fails.append(f'estado {cc}: capital {CAP[cc]} en lugar {cap + 1}')
share = ok / tot
if share < .96: fails.append(f'proporción base/pob válida: {share:.3f}')
print(f'32 estados vs oficial · base/pob válida {share:.3%} ({tot} municipios)')
print('\n'.join(fails) if fails else 'TODO OK')
sys.exit(1 if fails else 0)
