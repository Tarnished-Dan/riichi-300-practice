"""Recover printed tile faces with deterministic image matching; mappings reviewed by hand."""
from pathlib import Path
from pypdf import PdfReader
from PIL import Image,ImageDraw
import numpy as np,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/pdfs/tile-recognition';OUT.mkdir(parents=True,exist_ok=True)
STARTS=[12,34,56,78,98,120,142,164,184,206]
def groups(a):return [g for g in np.split(a,np.where(np.diff(a)>1)[0]+1) if len(g)]
def feature(im):
 a=np.asarray(im.resize((24,36),Image.Resampling.LANCZOS).convert('RGB'),dtype=np.float32)/255
 # Include ink density and chroma to distinguish red fives.
 return np.concatenate([(1-a.min(2)).ravel(),((a[:,:,0]-a[:,:,1])*.7).ravel()])
def question_tiles():
 pdf=PdfReader(ROOT/'何切300.pdf');records=[];errors=[]
 for start in STARTS:
  for off in range(10):
   page=start+2*off;im=pdf.pages[page-1].images[0].image.convert('RGB')
   b=np.asarray(im).min(2)<120
   bands=groups(np.where(b[:,110:980].sum(1)>650)[0])
   pairs=[(255,332),(593,670),(931,1008)]
   if len(pairs)!=3:
    errors.append({'page':page,'bands':[(int(g[0]),int(g[-1])) for g in bands],'pairs':pairs});continue
   for row,(top,bottom) in enumerate(pairs):
    qid=STARTS.index(start)*30+off*3+row+1
    xs=np.where(b[top:top+4,100:1010].any(0))[0]+100
    runs=[g for g in np.split(xs,np.where(np.diff(xs)>9)[0]+1) if len(g)]
    main,draw=runs[:2]
    x0,x1=int(main[0])-1,int(main[-1])+1
    count=round((x1-x0)/56.15)
    assert count in (4,7,10,13),(qid,count)
    rects=[(round(x0+j*(x1-x0)/count),top,round(x0+(j+1)*(x1-x0)/count),bottom) for j in range(count)]+[(int(draw[0])-1,top,int(draw[-1])+1,bottom)]
    meld_image=None
    if count<13:
     md=ROOT/f'dist/assets/melds/{qid:03d}.webp';md.parent.mkdir(parents=True,exist_ok=True)
     im.crop((int(draw[-1])+12,top-3,min(1010,im.width),bottom+5)).save(md,quality=95)
     meld_image=str(md.relative_to(ROOT/'dist'))
    tile_files=[]
    for j,(l,t,r,bt) in enumerate(rects):
     path=OUT/f'{qid:03d}-{j:02d}.png';im.crop((l+4,t+5,r-4,bt-4)).save(path);tile_files.append(str(path.relative_to(ROOT)))
    records.append({'id':qid,'page':page,'rowTop':top,'rowBottom':bottom,'tileFiles':tile_files,'meldImage':meld_image})
 (OUT/'questions.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
 print('records',len(records),'errors',errors)
 return records

def cluster(records):
 samples=[];refs=[];centers=[];members=[]
 for r in records:
  for j,p in enumerate(r['tileFiles']):
   im=Image.open(ROOT/p);f=feature(im)
   if centers:
    errors=np.mean((np.array(centers)-f)**2,axis=1);c=int(errors.argmin());err=float(errors[c])
   else:c=-1;err=10
   if err>.016:
    c=len(centers);centers.append(f);members.append([]);refs.append(p)
   members[c].append([r['id'],j,err]);samples.append({'id':r['id'],'index':j,'cluster':c,'error':err})
 (OUT/'clusters.json').write_text(json.dumps({'refs':refs,'members':members,'samples':samples},indent=2))
 w=1000;h=((len(refs)+11)//12)*112;sheet=Image.new('RGB',(w,h),'#eee');d=ImageDraw.Draw(sheet)
 for c,p in enumerate(refs):
  x=(c%12)*83;y=(c//12)*112
  sheet.paste(Image.open(ROOT/p).resize((50,70)),(x+15,y+22));d.text((x+6,y+4),f'{c} ({len(members[c])})',fill='black')
 sheet.save(OUT/'clusters.png');print('clusters',len(refs))
if __name__=='__main__':cluster(question_tiles())
