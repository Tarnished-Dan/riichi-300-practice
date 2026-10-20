from recognize_tiles import *
from collections import Counter
recs=json.loads((OUT/'questions.json').read_text());cs=json.loads((OUT/'clusters.json').read_text());labels=json.loads((OUT/'labels.json').read_text())
refs=np.array([feature(Image.open(ROOT/p)) for p in cs['refs']])
def identify(im):
 f=feature(im);err=np.mean((refs-f)**2,axis=1);indices=err.argsort();first=int(indices[0]);other=next(int(i) for i in indices if labels[str(i)]!=labels[str(first)])
 return labels[str(first)],float(err[first]),float(err[other]-err[first])
byid={r['id']:r for r in recs}
for r in recs:r['tiles']=[]
for s in cs['samples']:byid[s['id']]['tiles'].append(labels[str(s['cluster'])])
for r in recs:
 counts=Counter(('5'+x[1] if x[0]=='0' else x) for x in r['tiles'])
 assert max(counts.values())<=4,(r['id'],counts)
 suits={'m':0,'p':1,'s':2,'z':3}
 keys=[suits[t[1]]*10+(5 if t[0]=='0' else int(t[0])) for t in r['tiles'][:-1]]
 assert keys==sorted(keys),(r['id'],r['tiles'])
pdf=PdfReader(ROOT/'何切300.pdf');cache={};dora_debug=[]
for r in recs:
 if r['page'] not in cache:cache[r['page']]=pdf.pages[r['page']-1].images[0].image.convert('RGB')
 im=cache[r['page']];a=np.asarray(im);top=r['rowTop']-77;bottom=top+48
 b=a.min(2)<120;cols=np.where(b[top+5:bottom-5,420:920].mean(0)>.90)[0]+420
 lines=[float(g.mean()) for g in groups(cols)];candidates=[]
 for l in lines:
  for rr in lines:
   if 32<=rr-l<=37:
    crop=im.crop((round(l)+3,top+4,round(rr)-2,bottom-3))
    white=float((np.asarray(crop).min(2)>230).mean())
    candidates.append((white,crop,l,rr))
 assert candidates,r['id']
 white,crop,l,rr=max(candidates,key=lambda v:v[0])
 tile,err,margin=identify(crop);r['dora']=tile;r['doraScore']=err
 crop.save(OUT/f"dora-{r['id']:03d}.png");dora_debug.append((r['id'],crop,tile,err))
(OUT/'tile-data.json').write_text(json.dumps(recs,ensure_ascii=False,indent=2))
for batch in range(3):
 sh=Image.new('RGB',(1000,10*100),'#eee');d=ImageDraw.Draw(sh)
 for j,(qid,im,tile,err) in enumerate(dora_debug[batch*100:(batch+1)*100]):
  x=(j%10)*100;y=(j//10)*100;sh.paste(im.resize((40,56)),(x+25,y+20));d.text((x+8,y+3),f'{qid} {tile}',fill='black');d.text((x+15,y+78),f'{err:.3f}',fill='black')
 sh.save(OUT/f'dora-sheet-{batch}.png')
print('300 hand counts/sorting invariants pass; dora maxerror',max(x[3] for x in dora_debug))
structure=json.loads((ROOT/'tmp/pdfs/original-structure.json').read_text())['questions']
answer_debug=[]
for s in structure:
 r=byid[s['id']];im=Image.open(ROOT/s['answerPageImage']).convert('RGB');a=np.asarray(im);b=a.min(2)<120
 y=s['answerBadgeTop'];hdr=y+56
 # locate hand's first left border, then correct-answer box underneath.
 xs=np.where(b[hdr+5:hdr+46,100:180].mean(0)>.9)[0]+100

 if len(xs)==0:
  hdr=y+8;xs=np.where(b[hdr+5:hdr+46,100:180].mean(0)>.9)[0]+100
  assert len(xs),(s['id'],y)
 hand_left=int(xs.min());l=hand_left+27
 rows=groups(np.where(b[hdr+70:hdr+170,l:l+60].sum(1)>43)[0]+hdr+70)
 t=int(rows[0][0]);bt=int(rows[1][-1]) if len(rows)>1 and 70<rows[1][0]-t<84 else t+77
 crop=im.crop((l+4,t+5,l+55,bt-4));tile,err,margin=identify(crop)
 # A few dark red fives may have alternate chroma; compare all, then independently require in hand.
 # Visually verified against full answer figures: compact 3-man glyphs matched 5-man.
 if r['id'] in (32,72,86,113,215,224): tile='3m'
 r['answer']=tile;r['answerScore']=err;r['answerMargin']=margin
 crop.save(OUT/f"answer-{r['id']:03d}.png")
 answer_debug.append((r['id'],crop,tile,err,margin))
(OUT/'tile-data.json').write_text(json.dumps(recs,ensure_ascii=False,indent=2))
for batch in range(3):
 sh=Image.new('RGB',(1000,10*106),'#eee');d=ImageDraw.Draw(sh)
 for j,(qid,im,tile,err,margin) in enumerate(answer_debug[batch*100:(batch+1)*100]):
  x=(j%10)*100;y=(j//10)*106;sh.paste(im.resize((43,63)),(x+25,y+20));d.text((x+8,y+3),f'{qid} {tile}',fill='black');d.text((x+10,y+87),f'{err:.3f}',fill='black')
 sh.save(OUT/f'answer-sheet-{batch}.png')
print('answer maxerror',max(x[3] for x in answer_debug))
print('answer not in hand',[(r['id'],r['answer'],r['tiles']) for r in recs if r['answer'] not in r['tiles']])
