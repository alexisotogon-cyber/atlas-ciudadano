import os,sys,glob,json
from multiprocessing import Pool
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','tmp','')  # carpeta de trabajo local (ignorada por git)
DIRS={2024:S+'ccpc24/DatosAbiertos_DECEyEC_ConteosCensales2024'}
for y in (2021,2018,2015,2012,2009):DIRS[y]=S+f'dl/{y}/DatosAbiertos_DECEyEC_ConteosCensales{y}'
def bucket(a):
    return 0 if a<30 else 1 if a<45 else 2 if a<60 else 3
def job(args):
    y,f=args
    out={}  # (edo,mpio,sex,age)->[ln,sv,nv,ns]
    names={}
    raw=open(f,'rb').read()
    try:txt=raw.decode('utf-8-sig')
    except UnicodeDecodeError:txt=raw.decode('latin-1')
    it=iter(txt.split('\n'));next(it)
    for line in it:
        p=line.split(',')
        if len(p)<16:continue
        try:
            e=int(p[2]);m=int(p[4]);s=int(p[10]);a=int(p[11]);ln=int(p[12]);sv=int(p[13]);nv=int(p[14]);ns=int(p[15])
        except ValueError:continue
        if a<18:a=18
        k=(e,m,s if s in(0,1,2) else 2,bucket(a))
        r=out.get(k)
        if r is None:out[k]=[ln,sv,nv,ns]
        else:r[0]+=ln;r[1]+=sv;r[2]+=nv;r[3]+=ns
        if (e,m) not in names:names[(e,m)]=p[5]
    return y,out,names
if __name__=='__main__':
    tasks=[(y,f) for y,d in DIRS.items() for f in sorted(glob.glob(d+'/*.csv'))]
    res={}
    names={}
    with Pool(os.cpu_count()) as pool:
        for y,out,nm in pool.imap_unordered(job,tasks,chunksize=1):
            R=res.setdefault(y,{})
            for k,v in out.items():
                r=R.get(k)
                if r is None:R[k]=v
                else:
                    for i in range(4):r[i]+=v[i]
            if y==2024:names.update(nm)
    ser={str(y):[[*k,*v] for k,v in R.items()] for y,R in res.items()}
    json.dump({'rows':ser,'names':{f'{e}-{m}':n for (e,m),n in names.items()}},open(S+'build/agg.json','w'))
    print({y:len(R) for y,R in res.items()})
