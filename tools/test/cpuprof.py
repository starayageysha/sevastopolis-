import asyncio,sys,json,collections
from playwright.async_api import async_playwright
import os as _os
# Chrome: переменная CHROME_PATH или браузер Playwright по умолчанию (playwright install chromium)
CHROME = {'executable_path': _os.environ['CHROME_PATH']} if _os.environ.get('CHROME_PATH') else {}
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from nav import enter
URL,SC,WARM,OUT=sys.argv[1],sys.argv[2],int(sys.argv[3]),sys.argv[4]
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(**CHROME,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=await (await br.new_context(viewport={'width':412,'height':915},has_touch=True)).new_page()
    await pg.goto(URL); await pg.wait_for_timeout(3000); await enter(pg,SC); await pg.wait_for_timeout(WARM)
    cdp=await pg.context.new_cdp_session(pg)
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval',{'interval':500})
    await cdp.send('Profiler.start'); await pg.wait_for_timeout(15000)
    prof=(await cdp.send('Profiler.stop'))['profile']
    await br.close()
  nodes={n['id']:n for n in prof['nodes']}
  dt=collections.Counter()
  for i,s in enumerate(prof['samples']): dt[s]+=prof['timeDeltas'][i] if i<len(prof['timeDeltas']) else 0
  total=sum(dt.values())/1000
  self_=collections.Counter(); byfile=collections.Counter()
  for nid,us in dt.items():
    cf=nodes[nid]['callFrame']; f=cf['url'].split('/')[-1] or '(native)'
    key=f"{cf['functionName'] or '(anon)'} @ {f}:{cf['lineNumber']+1}"
    self_[key]+=us/1000; byfile[f]+=us/1000
  # inclusive time per file-level top functions: compute via parent map
  parent={}
  for n in prof['nodes']:
    for c in n.get('children',[]): parent[c]=n['id']
  incl=collections.Counter()
  for nid,us in dt.items():
    seen=set(); x=nid
    while x is not None:
      cf=nodes[x]['callFrame']; key=f"{cf['functionName'] or '(anon)'} @ {cf['url'].split('/')[-1]}:{cf['lineNumber']+1}"
      if key not in seen: incl[key]+=us/1000; seen.add(key)
      x=parent.get(x)
  r={'totalMs':round(total),'byFile':[(k,round(v)) for k,v in byfile.most_common(12)],
     'selfTop':[(k,round(v)) for k,v in self_.most_common(25)],
     'inclTop':[(k,round(v)) for k,v in incl.most_common(60) if '@ :' not in k][:40]}
  json.dump(r,open(OUT,'w'),ensure_ascii=False,indent=1); print(json.dumps(r,ensure_ascii=False,indent=1))
asyncio.run(main())
