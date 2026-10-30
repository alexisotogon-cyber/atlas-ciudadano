import os
import json,os
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','tmp','')  # carpeta de trabajo local (ignorada por git)
P=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','')+'dist/assets/'
d=json.load(open(S+'build/agg.json'))
years=sorted(int(y) for y in d['rows'])
st={};mp={}
for y in years:
    for e,m,s,a,ln,sv,nv,ns in d['rows'][str(y)]:
        base=ln-ns
        c='%02d'%e
        M=st.setdefault(c,{}).setdefault(y,[[0,0] for _ in range(12)])
        M[s*4+a][0]+=base;M[s*4+a][1]+=sv
        k=(c,m)
        T=mp.setdefault(k,{}).setdefault(y,[[0,0] for _ in range(12)])
        T[s*4+a][0]+=base;T[s*4+a][1]+=sv
os.makedirs(P+'data',exist_ok=True)
out={'years':years,'states':{c:{str(y):[v for pair in M for v in pair] for y,M in sorted(ys.items())} for c,ys in sorted(st.items())}}
json.dump(out,open(P+'data/estados.json','w'),separators=(',',':'))
print('estados.json',os.path.getsize(P+'data/estados.json'))
miss=0;tot=0;nogeo=0
for i in range(1,33):
    c='%02d'%i
    fn=P+'mpios/%s.json'%c
    g=json.load(open(fn))
    have=set()
    for f in g:
        m=f['m'];have.add(m);ys=mp.get((c,m))
        if not ys:miss+=1;f['y']=None;continue
        tot+=1
        f['y']={str(y):[v for pair in ys[y] for v in pair] for y in years if y in ys}
    nogeo+=len([1 for (cc,m) in mp if cc==c and m not in have and 2024 in mp[(cc,m)]])
    json.dump(g,open(fn,'w'),separators=(',',':'),ensure_ascii=False)
print('munis con datos',tot,'sin datos',miss,'datos sin geometria(2024)',nogeo)
print(sum(os.path.getsize(P+'mpios/%02d.json'%i) for i in range(1,33))//1024,'KB')
