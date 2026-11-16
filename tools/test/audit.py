"""Аудит производительности сцены: что рисуется, что считается каждый кадр.
python3 audit.py URL "Парк Победы" OUT.json
"""
import asyncio, json, sys
from playwright.async_api import async_playwright
import os as _os
# Chrome: переменная CHROME_PATH или браузер Playwright по умолчанию (playwright install chromium)
CHROME = {'executable_path': _os.environ['CHROME_PATH']} if _os.environ.get('CHROME_PATH') else {}
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from nav import enter  # noqa: E402  (переиспользуем навигацию)

URL, SCENE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

INIT = r"""
(()=>{const w=console.warn;window.__warnN=0;console.warn=function(){window.__warnN++;return w.apply(console,arguments)}})();
(()=>{const W=window;const B=W.__aud={draws:0,shadowDraws:0,inShadow:false,raf:{},frames:0};
for(const P of [WebGL2RenderingContext.prototype]){for(const f of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const o=P[f];P[f]=function(){B.draws++;if(B.inShadow)B.shadowDraws++;return o.apply(this,arguments)}}}
const R=W.requestAnimationFrame.bind(W);
W.requestAnimationFrame=function(cb){const key=(cb.name||'anon')+': '+String(cb).replace(/\s+/g,' ').slice(0,90);
 return R(function(t){const t0=performance.now();try{return cb(t)}finally{const e=B.raf[key]||(B.raf[key]={n:0,ms:0});e.n++;e.ms+=performance.now()-t0}})};
})();"""

SETUP = r"""(()=>{const g=window.__sevGame,s=g.scene,B=window.__aud;B.obs={};
// время каждого обработчика onBeforeRender
for(const [name,obsv] of [['beforeRender',s.onBeforeRenderObservable],['afterRender',s.onAfterRenderObservable],['beforeAnim',s.onBeforeAnimationsObservable]]){
 obsv.observers.forEach((o,i)=>{const cb=o.callback,key=name+'#'+i+': '+String(cb).replace(/\s+/g,' ').slice(0,100);
  o.callback=function(){const t0=performance.now();try{return cb.apply(this,arguments)}finally{const e=B.obs[key]||(B.obs[key]={n:0,ms:0});e.n++;e.ms+=performance.now()-t0}}})}
// вызовы отрисовки в карте теней
for(const l of s.lights){const sg=l.getShadowGenerator&&l.getShadowGenerator();if(!sg)continue;const m=sg.getShadowMap();
 m.onBeforeRenderObservable.add(()=>{B.inShadow=true});m.onAfterRenderObservable.add(()=>{B.inShadow=false})}
// время scene.render целиком (JS-часть)
const r=s.render.bind(s);B.renderMs=0;B.renderN=0;s.render=function(){const t0=performance.now();try{return r.apply(this,arguments)}finally{B.renderMs+=performance.now()-t0;B.renderN++}};
B.draws=0;B.shadowDraws=0;B.raf={};return true})()"""

REPORT = r"""(()=>{const g=window.__sevGame,s=g.scene,e=g.engine,B=window.__aud,out={};
const top=(o,k)=>Object.entries(o).map(([key,v])=>({key,n:v.n,msPerFrame:+(v.ms/Math.max(B.renderN,1)).toFixed(3)})).sort((a,b)=>b.msPerFrame-a.msPerFrame).slice(0,k);
out.frames=B.renderN;out.drawsPerFrame=+(B.draws/B.renderN).toFixed(1);out.shadowDrawsPerFrame=+(B.shadowDraws/B.renderN).toFixed(1);
out.renderJsMsPerFrame=+(B.renderMs/B.renderN).toFixed(2);
out.topObservers=top(B.obs,12);out.topRaf=top(B.raf,10);
out.hwScaling=e.getHardwareScalingLevel();out.renderSize=[e.getRenderWidth(),e.getRenderHeight()];
const cam=s.activeCamera;out.camera={minZ:cam.minZ,maxZ:cam.maxZ};out.fog=s.fogMode;
out.shadows=s.lights.map(l=>{const sg=l.getShadowGenerator&&l.getShadowGenerator();if(!sg)return {light:l.name,shadow:false};const m=sg.getShadowMap();
 return {light:l.name,type:l.getClassName(),mapSize:m.getSize(),casters:(m.renderList||[]).length,refreshRate:m.refreshRate,
  pcf:sg.usePercentageCloserFiltering,blurESM:sg.useBlurExponentialShadowMap,pcss:sg.useContactHardeningShadow,cascades:sg.numCascades||0}});
out.receivers=s.meshes.filter(m=>m.receiveShadows).length;
// активные меши по группам имени
const grp={};for(const m of s.getActiveMeshes().data.slice(0,s.getActiveMeshes().length)){const k=(m.name||'?').replace(/[-_ .]?\d+.*$/,'').slice(0,28);const x=grp[k]||(grp[k]={n:0,idx:0,inst:0});x.n++;x.idx+=m.getTotalIndices?m.getTotalIndices():0;if(m.isAnInstance)x.inst++}
out.activeGroups=Object.entries(grp).map(([k,v])=>({k,...v})).sort((a,b)=>b.idx-a.idx).slice(0,25);
const all={};for(const m of s.meshes){const k=(m.name||'?').replace(/[-_ .]?\d+.*$/,'').slice(0,28);const x=all[k]||(all[k]={n:0,enabled:0,verts:0});x.n++;if(m.isEnabled()&&m.isVisible)x.enabled++;x.verts+=m.getTotalVertices?m.getTotalVertices():0}
out.allGroups=Object.entries(all).map(([k,v])=>({k,...v})).sort((a,b)=>b.n-a.n).slice(0,25);
out.meshes=s.meshes.length;out.enabledMeshes=s.meshes.filter(m=>m.isEnabled()&&m.isVisible).length;out.frozenWorld=s.meshes.filter(m=>m._isWorldMatrixFrozen).length;
out.alwaysSelect=s.meshes.filter(m=>m.alwaysSelectAsActiveMesh).length;out.instances=s.meshes.filter(m=>m.isAnInstance).length;
out.materials=s.materials.length;out.frozenMaterials=s.materials.filter(m=>m.isFrozen).length;
const uniq=new Set(s.getActiveMeshes().data.slice(0,s.getActiveMeshes().length).map(m=>m.material&&m.material.uniqueId));out.activeMaterials=uniq.size;
let tex=0;const big=[];for(const t of s.textures){try{const z=t.getSize();const b=z.width*z.height*4*1.33;tex+=b;big.push([t.name.slice(0,50),z.width+'x'+z.height])}catch(_){}}
out.textureMB=+(tex/1e6).toFixed(1);out.textures=s.textures.length;out.bigTextures=big.sort((a,b)=>{const p=x=>x[1].split('x').reduce((u,v)=>u*v,1);return p(b)-p(a)}).slice(0,10);
out.particles=s.particleSystems.map(p=>p.getCapacity?p.getCapacity():0).reduce((a,b)=>a+b,0);out.particleSystems=s.particleSystems.length;
out.activeParticleSystems=s.particleSystems.filter(p=>p.isStarted&&p.isStarted()).length;
out.skipPick=s.skipPointerMovePicking;out.autoClear=s.autoClear;out.blockDirty=s.blockMaterialDirtyMechanism;
out.postProcesses=(cam._postProcesses||[]).filter(Boolean).map(p=>p.name);out.layers=(s.layers||[]).length+(s.effectLayers||[]).map(l=>l.name).length;
out.warnings=window.__warnN;out.npc={list:window.SevNPC.manager.list.length,pending:window.SevNPC.manager.pending.length};out.ls=window.__lsStat;out.cull=window.__cullStat;out.heapMB=performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null;
return out})()"""


async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(**CHROME, args=[
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'])
        ctx = await br.new_context(viewport={'width': 412, 'height': 915}, has_touch=True)
        page = await ctx.new_page(); await page.add_init_script(INIT)
        await page.goto(URL); await page.wait_for_timeout(3000)
        await enter(page, SCENE); await page.wait_for_timeout(int(sys.argv[4]) if len(sys.argv)>4 else 6000)
        await page.evaluate(SETUP)
        await page.wait_for_timeout(15000)
        rep = await page.evaluate(REPORT)
        await br.close()
    json.dump(rep, open(OUT, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(rep, ensure_ascii=False, indent=1))

asyncio.run(main())
