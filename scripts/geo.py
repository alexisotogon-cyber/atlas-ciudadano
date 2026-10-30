import os
import json,math,os,sys
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','tmp','')  # carpeta de trabajo local (ignorada por git)
P=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','')+'dist/assets/'
R=6371.0
l1,l2,l0,lo=map(math.radians,(17.5,29.5,12,-102))
n=math.log(math.cos(l1)/math.cos(l2))/math.log(math.tan(math.pi/4+l2/2)/math.tan(math.pi/4+l1/2))
F=math.cos(l1)*math.tan(math.pi/4+l1/2)**n/n
r0=R*F/math.tan(math.pi/4+l0/2)**n
def proj(lon,lat):
    la=math.radians(lat);lg=math.radians(lon)
    r=R*F/math.tan(math.pi/4+la/2)**n
    t=n*(lg-lo)
    return r*math.sin(t), -(r0-r*math.cos(t))   # y down (screen)
def rdp(pts,eps):
    if len(pts)<3:return pts
    keep=[False]*len(pts);keep[0]=keep[-1]=True
    stack=[(0,len(pts)-1)]
    e2=eps*eps
    while stack:
        a,b=stack.pop()
        ax,ay=pts[a];bx,by=pts[b];dx=bx-ax;dy=by-ay;L=dx*dx+dy*dy
        mx=-1;mi=-1
        for i in range(a+1,b):
            px,py=pts[i]
            if L==0:d=(px-ax)**2+(py-ay)**2
            else:
                t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L));d=(px-ax-t*dx)**2+(py-ay-t*dy)**2
            if d>mx:mx=d;mi=i
        if mx>e2:keep[mi]=True;stack.append((a,mi));stack.append((mi,b))
    return [p for p,k in zip(pts,keep) if k]
def area(r):
    return abs(sum(r[i][0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*r[i][1] for i in range(len(r))))/2
def ringpath(ring,eps,minarea):
    pts=[proj(x,y) for x,y in ring]
    if pts[0]==pts[-1]:pts=pts[:-1]
    if len(pts)<3 or area(pts)<minarea:return None,None
    s=rdp(pts+[pts[0]],eps)[:-1]
    if len(s)<3:return None,None
    q=[(round(x*10),round(y*10)) for x,y in s]   # 0.1 km units
    d='M%d %d'%q[0];px,py=q[0]
    d+='l'+' '.join('%d %d'%(x-px,y-py) for (x,y),(px,py) in zip(q[1:],q[:-1]))+'z'
    return d,q
def geom(g,eps,minarea):
    polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    ds=[];xs=[];ys=[];best=None
    for poly in polys:
        for ring in poly:
            d,q=ringpath(ring,eps,minarea)
            if d:
                ds.append(d)
                xs+= [p[0] for p in q];ys+=[p[1] for p in q]
    if not ds:  # keep largest ring regardless
        poly=max(polys,key=lambda p:len(p[0]));d,q=ringpath(poly[0],eps/3,0)
        ds=[d];xs=[p[0] for p in q];ys=[p[1] for p in q]
    return ''.join(ds),[min(xs),min(ys),max(xs),max(ys)]
os.makedirs(P+'mpios',exist_ok=True)
# states from existing simplified file
sg=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','')+'fuentes/mexico-entidades-inegi.geojson'))
states={}
for f in sg['features']:
    c=f['properties']['cve_ent'];d,b=geom(f['geometry'],0.5,2)
    states[c]={'d':d,'b':b,'n':f['properties'].get('nom_ent') or f['properties'].get('nomgeo') or ''}
json.dump(states,open(P+'estados.json','w'),separators=(',',':'),ensure_ascii=False)
print('estados',os.path.getsize(P+'estados.json'),list(sg['features'][0]['properties']))
tot=0
for i in range(1,33):
    c='%02d'%i
    g=json.load(open(S+'geo/AGEM_%s.geojson'%c))
    out=[]
    for f in g['features']:
        p=f['properties'];d,b=geom(f['geometry'],0.45,0.6)
        out.append({'id':p['cvegeo'],'m':int(p['cve_agem']),'n':p['nom_agem'],'pob':int(p.get('pob') or 0),'d':d,'b':b})
    out.sort(key=lambda o:o['m'])
    fn=P+'mpios/%s.json'%c
    json.dump(out,open(fn,'w'),separators=(',',':'),ensure_ascii=False)
    sz=os.path.getsize(fn);tot+=sz;print(c,len(out),sz//1024,'KB')
print('total',tot//1024,'KB')
