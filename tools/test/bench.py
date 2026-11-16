import asyncio, json, sys, time
from playwright.async_api import async_playwright
import os as _os
# Chrome: переменная CHROME_PATH или браузер Playwright по умолчанию (playwright install chromium)
CHROME = {'executable_path': _os.environ['CHROME_PATH']} if _os.environ.get('CHROME_PATH') else {}
URL=sys.argv[1]; OUT=sys.argv[2]; SCENES=sys.argv[3].split(',') if len(sys.argv)>3 else ['pobedy']
_os.makedirs(_os.path.dirname(_os.path.abspath(OUT)), exist_ok=True)
INIT="""
(()=>{const W=window;W.__bench={draws:0,frames:0,errs:[]};
for(const P of [W.WebGL2RenderingContext&&WebGL2RenderingContext.prototype,W.WebGLRenderingContext&&WebGLRenderingContext.prototype]){if(!P)continue;
 for(const f of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const o=P[f];if(!o)continue;P[f]=function(){W.__bench.draws++;return o.apply(this,arguments)}}}
const raf=W.requestAnimationFrame.bind(W);
W.addEventListener('error',e=>W.__bench.errs.push(String(e.message)));
})();"""
STATS="""(()=>{const g=window.__sev&&window.__sev.game, e=window.__sev&&window.__sev.engine; const s=g&&(g.scene||g._scene);
const r={fps:e?e.getFps():null};
if(s){r.meshes=s.meshes.length;r.active=s.getActiveMeshes().length;r.materials=s.materials.length;r.textures=s.textures.length;
r.lights=s.lights.length;r.verts=s.getTotalVertices();r.activeIdx=s.getActiveIndices();r.particles=s.particleSystems.length;
r.shadowGens=s.lights.filter(l=>l.getShadowGenerator&&l.getShadowGenerator()).length;
let inst=0,thin=0;for(const m of s.meshes){if(m.isAnInstance)inst++; if(m.thinInstanceCount)thin+=m.thinInstanceCount}r.instances=inst;r.thin=thin;
r.observers=s.onBeforeRenderObservable.observers.length;r.rtt=s.customRenderTargets.length;}
if(performance.memory)r.heapMB=Math.round(performance.memory.usedJSHeapSize/1e6);
return r})()"""
async def measure(page,sec=6):
    a=await page.evaluate("[window.__bench.draws,performance.now()]")
    fr0=await page.evaluate("new Promise(r=>{let n=0,t0=performance.now();function f(){n++;if(performance.now()-t0<%d)requestAnimationFrame(f);else r([n,performance.now()-t0])}requestAnimationFrame(f)})"%(sec*1000))
    b=await page.evaluate("[window.__bench.draws,performance.now()]")
    frames,ms=fr0
    st=await page.evaluate(STATS)
    st['frames']=frames; st['fpsMeasured']=round(frames/(ms/1000),2); st['drawsPerFrame']=round((b[0]-a[0])/max(frames,1),1)
    return st
async def main():
    res={'url':URL}
    async with async_playwright() as p:
        br=await p.chromium.launch(**CHROME,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--enable-precise-memory-info'])
        ctx=await br.new_context(viewport={'width':412,'height':915},device_scale_factor=1,is_mobile=True,has_touch=True)
        page=await ctx.new_page(); await page.add_init_script(INIT)
        cons=[];fails=[]
        page.on('console',lambda m: cons.append(f"{m.type}: {m.text}"[:300]) if m.type in('error','warning') else None)
        page.on('pageerror',lambda e: cons.append("PAGEERROR: "+str(e)[:300]))
        page.on('requestfailed',lambda r: fails.append(r.url[:150]+' '+str(r.failure)))
        page.on('response',lambda r: fails.append(f"{r.status} {r.url[:150]}") if r.status>=400 else None)
        t0=time.time(); await page.goto(URL,wait_until='load',timeout=180000); res['loadSec']=round(time.time()-t0,2)
        await page.wait_for_timeout(4000); await page.screenshot(path=OUT+'_splash.png')
        res['scenes']={}
        for sc in SCENES:
            if sc!=SCENES[0]:
                await page.goto(URL,wait_until='load',timeout=180000); await page.wait_for_timeout(3000)
            t1=time.time()
            await page.get_by_text('Играть').first.click(); await page.wait_for_timeout(3500)
            await page.evaluate("document.querySelector('button.pin--city').click()"); await page.wait_for_timeout(800)
            await page.evaluate("document.querySelector('.sheet__go') && document.querySelector('.sheet__go').click()"); await page.wait_for_timeout(3500)
            await page.evaluate("t=>{const b=[...document.querySelectorAll('#screens button.pin')].find(e=>e.textContent.includes(t)); b&&b.click()}",sc); await page.wait_for_timeout(800)
            await page.evaluate("()=>{const g=[...document.querySelectorAll('.sheet__go')].find(e=>e.offsetParent); g&&g.click()}")
            try:
                await page.wait_for_function("()=>window.__sevGame && window.__sev && document.getElementById('loading').hidden",timeout=300000)
            except Exception as e:
                res['scenes'][sc]={'error':'timeout'}; await page.screenshot(path=OUT+f'_{sc[:5]}_timeout.png'); continue
            ready=round(time.time()-t1,2)
            await page.wait_for_timeout(int(__import__('os').environ.get('WARM','6000')))
            st=await measure(page,15); st['readySec']=ready
            await page.screenshot(path=OUT+f'_{sc[:5]}.png')
            res['scenes'][sc]=st
        res['console']=cons[:60]; res['failed']=fails[:40]; res['bench']=await page.evaluate("window.__bench.errs.slice(0,20)")
        await br.close()
    json.dump(res,open(OUT+'.json','w'),ensure_ascii=False,indent=1); print(json.dumps(res,ensure_ascii=False,indent=1))
asyncio.run(main())
