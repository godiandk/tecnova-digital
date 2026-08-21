# -*- coding: utf-8 -*-
# Pergunta a propria pagina que chaves e que o i18n tentou traduzir e nao
# encontrou no dicionario. Sao os valores exactos que faltam -- nao o que
# aparece no ecra, que junta pedacos e nao serve de chave.
from playwright.sync_api import sync_playwright
import glob, io, json, os

PAGINAS = sorted(os.path.basename(f) for f in glob.glob('./*.html'))
PAGINAS = [p for p in PAGINAS if not p.startswith('modelo-') and p not in ('folheto.html','404.html')]

JS = """(ling) => {
  const dic = (window.TECNOVA_DIC && window.TECNOVA_DIC[ling]) || {};
  const limpa = s => String(s||'').replace(/\\s+/g,' ').trim();
  const padroes = dic.__padroes || [];
  function traduz(t){
    const k = limpa(t);
    if (!k || k.length < 2) return null;
    if (dic[k]) return dic[k];
    const m = k.match(/^(.*?)([.!?:;,…]+)$/);
    if (m && dic[m[1]]) return dic[m[1]] + m[2];
    for (const p of padroes) if (k.match(new RegExp(p[0]))) return 'padrao';
    return null;
  }
  const faltam = new Set();
  document.querySelectorAll('*').forEach(el => {
    if (el.__i18n_pt !== undefined && limpa(el.__i18n_pt) && !traduz(el.__i18n_pt))
      faltam.add(limpa(el.__i18n_pt));
  });
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.__i18n_pt !== undefined && limpa(n.__i18n_pt) && !traduz(n.__i18n_pt))
      faltam.add(limpa(n.__i18n_pt));
  }
  return [...faltam];
}"""

fora = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.route('**/*', lambda r: r.continue_() if 'localhost' in r.request.url else r.abort())
    for pag in PAGINAS:
        for ling in ('en', 'es'):
            pg.goto('http://localhost:8899/%s?lang=%s' % (pag, ling), wait_until='domcontentloaded')
            pg.wait_for_timeout(900)
            for x in pg.evaluate(JS, ling):
                fora.setdefault(x, set()).add(pag)
    b.close()

SC=''
io.open(SC+'chaves.json','w',encoding='utf-8').write(
    json.dumps({k: sorted(v) for k, v in fora.items()}, ensure_ascii=False, indent=1))
print(len(fora), 'chaves por traduzir')
