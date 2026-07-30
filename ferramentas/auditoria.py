# -*- coding: utf-8 -*-
"""Auditoria completa do site TECNOVA — página a página, aparelho a aparelho."""
from playwright.sync_api import sync_playwright
import glob, os, json, collections

os.chdir('/workspace/tecnova-digital')
PAGINAS = sorted(os.path.basename(f) for f in glob.glob('*.html'))

APARELHOS = [
    ("iPhone SE",        320, 568, 2, True),
    ("Android pequeno",  360, 740, 3, True),
    ("iPhone 14",        390, 844, 3, True),
    ("iPhone Pro Max",   430, 932, 3, True),
    ("iPad retrato",     768,1024, 2, True),
    ("iPad Pro",        1024,1366, 2, True),
    ("iPad deitado",    1024, 768, 2, True),
    ("Portátil",        1366, 768, 1, False),
    ("Desktop",         1920,1080, 1, False),
]

AUDITA = r"""() => {
  const p = [];
  const vis = el => { const s = getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden' && s.opacity!=='0' && el.getBoundingClientRect().width>0; };

  // 1. transbordo horizontal e quem o causa
  const ovDoc = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (ovDoc > 1) {
    const larg = document.documentElement.clientWidth;
    const culpados = [...document.querySelectorAll('body *')].filter(el=>{
      if(!vis(el)) return false;
      const r = el.getBoundingClientRect();
      return r.right > larg + 2 || r.left < -2;
    }).slice(0,3).map(el => el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ')[0]);
    p.push({t:'transbordo', d: ovDoc+'px · '+culpados.join(', ')});
  }

  // 2. texto pequeno demais para ler no telemóvel
  if (innerWidth <= 480) {
    const pequenos = [...document.querySelectorAll('p,li,span,a,td,label,button,input')].filter(el=>{
      if(!vis(el)) return false;
      if(!el.textContent.trim() || el.textContent.trim().length < 12) return false;
      if(el.querySelector('*')) return false;
      return parseFloat(getComputedStyle(el).fontSize) < 11.5;
    });
    if (pequenos.length) p.push({t:'letra<11.5px', d: pequenos.length+' elementos · ex: "'+pequenos[0].textContent.trim().slice(0,40)+'"'});
  }

  // 3. alvos de toque pequenos (mínimo recomendado 44x44 / 40x40 aceitável)
  if (innerWidth <= 900) {
    const pequenos = [...document.querySelectorAll('a,button,input[type=checkbox],input[type=radio],select')].filter(el=>{
      if(!vis(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width===0) return false;
      // uma caixa de 24px dentro de um rótulo de 44px é tocável na mesma:
      // quem responde ao dedo é o rótulo, não a caixa
      const rot = el.closest('label,button');
      if (rot && rot!==el) { const rr = rot.getBoundingClientRect();
        if (rr.height>=34 && rr.width>=26) return false; }
      // ignora links dentro de parágrafos (texto corrido)
      if (el.tagName==='A' && el.parentElement && /^(P|LI|SPAN|SMALL)$/.test(el.parentElement.tagName)
          && el.parentElement.textContent.trim().length > el.textContent.trim().length + 10) return false;
      return r.height < 34 || r.width < 26;
    });
    if (pequenos.length) p.push({t:'toque<34px', d: pequenos.length+' · ex: "'+(pequenos[0].textContent.trim()||pequenos[0].getAttribute('aria-label')||pequenos[0].type).slice(0,32)+'"'});
  }

  // 4. imagens partidas ou sem texto alternativo
  const imgsMas = [...document.images].filter(i=>i.complete && i.naturalWidth===0);
  if (imgsMas.length) p.push({t:'imagem-partida', d: imgsMas.map(i=>i.getAttribute('src')).slice(0,2).join(', ')});
  const semAlt = [...document.images].filter(i=>!i.getAttribute('alt'));
  if (semAlt.length) p.push({t:'img-sem-alt', d: semAlt.length+''});

  // 5. sobreposição entre elementos fixos do canto
  const cantos = [['idioma','#langWrap'],['app','.app-float'],['whatsapp','.wa-float'],
                  ['assistente','.as-botao'],['barra-total','.bar-fixa'],['tabbar','.tabbar'],
                  ['cta-fixo','.sticky-cta'],['botao-menu','.nav-right .btn']];
  const cx=[];
  cantos.forEach(([n,sel])=>{const e=document.querySelector(sel); if(!e||!vis(e))return;
    const r=e.getBoundingClientRect(); cx.push({n,l:r.left,t:r.top,r:r.right,b:r.bottom});});
  for(let i=0;i<cx.length;i++) for(let j=i+1;j<cx.length;j++){
    const a=cx[i],b=cx[j];
    if(Math.min(a.r,b.r)-Math.max(a.l,b.l)>2 && Math.min(a.b,b.b)-Math.max(a.t,b.t)>2)
      p.push({t:'sobreposicao', d:a.n+' × '+b.n});
  }

  // 6. menu partido em duas linhas quando não é hambúrguer
  const links=document.querySelector('nav.links');
  if(links){
    const bg=document.querySelector('.burger');
    const hamb = bg && getComputedStyle(bg).display!=='none';
    if(!hamb){
      const filhos=[...links.children].filter(vis);
      const linhas=[...new Set(filhos.map(c=>Math.round(c.getBoundingClientRect().top)))].length;
      if(linhas>1) p.push({t:'menu-2-linhas', d:linhas+' linhas'});
    }
  }

  // 7. contraste real (WCAG AA), compondo as camadas translúcidas.
  //    Sobre imagem ou gradiente não se calcula — vê-se; por isso passa-se à frente.
  const rgba = c => { const m=(c||'').match(/[\d.]+/g); if(!m) return null;
    return [ +m[0], +m[1], +m[2], m.length>3 ? +m[3] : 1 ]; };
  const sobre = (f,b) => [0,1,2].map(i => f[i]*f[3] + b[i]*(1-f[3])).concat([1]);
  const lumi = c => { const [r,g,b]=c.slice(0,3).map(v=>{v=v/255;
      return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);});
    return 0.2126*r+0.7152*g+0.0722*b; };
  function fundoReal(el){
    const camadas=[]; let e=el;
    while(e){ const s=getComputedStyle(e);
      if(s.backgroundImage && s.backgroundImage!=='none') return null;
      const c=rgba(s.backgroundColor);
      if(c && c[3]>0){ camadas.push(c); if(c[3]>=1) break; }
      e=e.parentElement; }
    if(!camadas.length) return null;
    let base=[255,255,255,1];
    for(let i=camadas.length-1;i>=0;i--) base=sobre(camadas[i],base);
    return base;
  }
  const baixoContraste=[...document.querySelectorAll('p,li,span,a,label,td,small,h1,h2,h3,h4,b,strong,div')].filter(el=>{
    if(!vis(el) || el.children.length || el.textContent.trim().length<8) return false;
    const cs=getComputedStyle(el);
    const bg=fundoReal(el); if(!bg) return false;
    let fg=rgba(cs.color); if(!fg) return false;
    if(fg[3]<1) fg=sobre(fg,bg);
    const r=(Math.max(lumi(fg),lumi(bg))+0.05)/(Math.min(lumi(fg),lumi(bg))+0.05);
    const fs=parseFloat(cs.fontSize), pw=parseInt(cs.fontWeight)||400;
    const grande = fs>=24 || (fs>=18.66 && pw>=700);
    return r < (grande ? 3 : 4.5);
  });
  if(baixoContraste.length) p.push({t:'contraste-baixo', d: baixoContraste.length+' · ex: "'+baixoContraste[0].textContent.trim().slice(0,38)+'"'});

  // 8. campos de formulário que provocam zoom no iPhone (font-size < 16px)
  const zoom=[...document.querySelectorAll('input,select,textarea')].filter(el=>{
    if(!vis(el)) return false;
    return parseFloat(getComputedStyle(el).fontSize) < 16;
  });
  if(zoom.length && innerWidth<=480) p.push({t:'zoom-iphone', d: zoom.length+' campos com letra <16px'});

  // 9. conteúdo cortado pela barra de demonstração
  const bar=document.querySelector('.demo-bar'), hd=document.querySelector('header');
  if(bar&&hd&&vis(bar)){
    const folga = hd.getBoundingClientRect().top + (parseFloat(getComputedStyle(hd).paddingTop)||0)
                - bar.getBoundingClientRect().bottom;
    if(folga < -2) p.push({t:'cabecalho-tapado', d: Math.round(folga)+'px'});
  }

  return p;
}"""

def correr():
    resultados = collections.defaultdict(list)
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                               args=["--no-sandbox"])
        for nome, w, h, dpr, touch in APARELHOS:
            ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr,
                                has_touch=touch, is_mobile=touch)
            for pat in ["**://fonts.googleapis.com/**", "**://fonts.gstatic.com/**",
                        "**://www.gstatic.com/**", "**://get.geojs.io/**", "**://ipwho.is/**"]:
                ctx.route(pat, lambda r, q=None: r.abort())
            for f in PAGINAS:
                pg = ctx.new_page(); errs = []; http = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("response", lambda r: http.append((r.status, r.url.split('/')[-1])) if r.status >= 400 else None)
                try:
                    pg.goto("http://localhost:8899/" + f, wait_until="load", timeout=30000)
                    pg.wait_for_timeout(500)
                    probs = pg.evaluate(AUDITA)
                except Exception as e:
                    probs = [{'t': 'erro-ao-abrir', 'd': str(e)[:80]}]
                reais = [e for e in errs if 'firebase' not in e and 'auth is not defined' not in e
                         and 'tecnovaApplyAvatar' not in e]
                if reais: probs.append({'t': 'erro-js', 'd': reais[0][:70]})
                if http:  probs.append({'t': 'http-erro', 'd': str(set(http))[:70]})
                for p in probs:
                    resultados[p['t']].append((f, nome, p['d']))
                pg.close()
            ctx.close()
        b.close()
    return resultados

if __name__ == "__main__":
    r = correr()
    total = sum(len(v) for v in r.values())
    print("=" * 74)
    print("AUDITORIA — %d páginas × %d aparelhos = %d verificações" % (len(PAGINAS), len(APARELHOS), len(PAGINAS)*len(APARELHOS)))
    print("=" * 74)
    if not total:
        print("\nNenhum problema encontrado.")
    for tipo in sorted(r, key=lambda k: -len(r[k])):
        occ = r[tipo]
        print("\n### %s — %d ocorrências" % (tipo.upper(), len(occ)))
        pags = sorted({o[0] for o in occ})
        aps  = sorted({o[1] for o in occ})
        print("    páginas (%d): %s" % (len(pags), ', '.join(pags[:6]) + (' …' if len(pags) > 6 else '')))
        print("    aparelhos: %s" % ', '.join(aps))
        for o in occ[:3]:
            print("    · %s [%s] %s" % (o[0], o[1], o[2]))
    json.dump({k: v for k, v in r.items()},
              open('/tmp/claude-0/-home-user-godiandk/1e2aa493-b0d0-5406-875e-37168533ac6a/scratchpad/auditoria.json', 'w'),
              ensure_ascii=False, indent=1)
