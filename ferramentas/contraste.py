# -*- coding: utf-8 -*-
"""Contraste a sério: compõe as cores translúcidas e ignora quem está sobre
imagem/gradiente (aí não dá para saber a cor de fundo por cálculo)."""
from playwright.sync_api import sync_playwright
import glob, os, collections

os.chdir('/workspace/tecnova-digital')
PAGINAS = sorted(os.path.basename(f) for f in glob.glob('*.html'))

JS = r"""() => {
  const vis = el => { const s = getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden' && s.opacity!=='0' && el.getBoundingClientRect().width>0; };
  const rgba = c => { const m=(c||'').match(/[\d.]+/g); if(!m) return null;
    return [ +m[0], +m[1], +m[2], m.length>3 ? +m[3] : 1 ]; };
  const sobre = (f,b) => [0,1,2].map(i => f[i]*f[3] + b[i]*(1-f[3])).concat([1]);
  const lum = c => { const [r,g,b]=c.slice(0,3).map(v=>{v=v/255;
      return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);});
    return 0.2126*r+0.7152*g+0.0722*b; };

  // fundo real: compõe todas as camadas até ao topo. Devolve null se
  // encontrar imagem/gradiente pelo caminho — aí não se calcula, vê-se.
  function fundo(el){
    const camadas=[]; let e=el;
    while(e){
      const s=getComputedStyle(e);
      if(s.backgroundImage && s.backgroundImage!=='none') return null;
      const c=rgba(s.backgroundColor);
      if(c && c[3]>0){ camadas.push(c); if(c[3]>=1) break; }
      e=e.parentElement;
    }
    if(!camadas.length) return null;
    let base=[255,255,255,1];
    for(let i=camadas.length-1;i>=0;i--) base=sobre(camadas[i],base);
    return base;
  }
  const sel = el => {
    let s=el.tagName.toLowerCase();
    const c=(el.className||'').toString().trim().split(/\s+/).filter(Boolean).slice(0,2);
    if(c.length) s+='.'+c.join('.');
    return s;
  };
  const out=[];
  document.querySelectorAll('p,li,span,a,label,td,small,h1,h2,h3,h4,b,strong,div').forEach(el=>{
    if(!vis(el)) return;
    if(el.children.length) return;
    const t=el.textContent.trim(); if(t.length<8) return;
    const cs=getComputedStyle(el);
    const bg=fundo(el); if(!bg) return;
    let fg=rgba(cs.color); if(!fg) return;
    if(fg[3]<1) fg=sobre(fg,bg);
    const lf=lum(fg), lb=lum(bg);
    const r=(Math.max(lf,lb)+0.05)/(Math.min(lf,lb)+0.05);
    const fs=parseFloat(cs.fontSize), pw=parseInt(cs.fontWeight)||400;
    const grande = fs>=24 || (fs>=18.66 && pw>=700);
    const min = grande ? 3 : 4.5;
    if(r < min) out.push([sel(el), r.toFixed(2), cs.color+' | '+`rgb(${bg.slice(0,3).map(Math.round).join(', ')})`, fs.toFixed(0)+'px', t.slice(0,26)]);
  });
  return out;
}"""

cnt = collections.Counter(); onde = collections.defaultdict(set)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args=["--no-sandbox"])
    for w,h,m in [(390,844,True),(1366,768,False)]:
        ctx = b.new_context(viewport={"width":w,"height":h}, has_touch=m, is_mobile=m)
        for pat in ["**://fonts.googleapis.com/**","**://fonts.gstatic.com/**","**://www.gstatic.com/**",
                    "**://get.geojs.io/**","**://ipwho.is/**"]:
            ctx.route(pat, lambda r: r.abort())
        for f in PAGINAS:
            pg = ctx.new_page()
            try:
                pg.goto("http://localhost:8899/"+f, wait_until="load", timeout=30000)
                pg.wait_for_timeout(350)
                for s,r,c,fs,t in pg.evaluate(JS):
                    cnt[(s,r,c,fs)] += 1; onde[(s,r,c,fs)].add(f)
            except Exception as e:
                print("ERRO", f, str(e)[:50])
            pg.close()
        ctx.close()
    b.close()

print("="*76); print("CONTRASTE REAL (WCAG AA) —", sum(cnt.values()), "ocorrências,", len(cnt), "padrões"); print("="*76)
for k,v in cnt.most_common(50):
    p = sorted(onde[k])
    print("%4d  %-26s %5s  %-46s %s" % (v, k[0], k[1], k[2], k[3]))
    print("      %s%s" % (', '.join(p[:4]), ' …' if len(p)>4 else ''))
