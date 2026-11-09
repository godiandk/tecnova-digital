#!/usr/bin/env python3
"""
TECNOVA Digital — dados estruturados nas paginas que ainda nao tinham.

  FAQPage        (a partir dos <details class="faq-item"> que ja estao na pagina)
  BreadcrumbList (caminho ate a pagina)
  Service        (nas paginas de servico)

Le as perguntas do proprio HTML: se o texto da pagina mudar, basta correr
outra vez e o JSON-LD acompanha. Nada e inventado aqui.

Idempotente: tudo fica entre <!-- seo-extra:inicio --> e <!-- seo-extra:fim -->.
"""
import re, json, os, glob

BASE = 'https://tecnovadigital.pt'
NEG = BASE + '/#negocio'
INICIO, FIM = '<!-- seo-extra:inicio -->', '<!-- seo-extra:fim -->'

# Paginas privadas ou sem valor de pesquisa: fora do Google.
NOINDEX = {'conta.html', 'folheto.html', 'pagamento.html', 'admin.html'}

NOMES = {
    'index.html': 'Início', 'servicos.html': 'O que fazemos',
    'pacotes.html': 'Pacotes e Preços', 'modelos.html': 'Modelos',
    'orcamento.html': 'Fazer o pedido', 'contacto.html': 'Contacto',
    'sobre.html': 'Sobre', 'renovacao.html': 'Renovação',
    'privacidade.html': 'Privacidade', 'termos.html': 'Termos e Condições',
    'cookies.html': 'Cookies', 'reembolso.html': 'Cancelamento e reembolso',
    'app.html': 'Aplicação',
}


def limpo(h):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h)).strip()


def faq(s):
    """Le os <details class="faq-item"> reais da pagina."""
    itens = []
    for m in re.finditer(r'<details[^>]*class="[^"]*faq-item[^"]*"[^>]*>(.*?)</details>',
                         s, re.S):
        b = m.group(1)
        q = re.search(r'<summary[^>]*>(.*?)</summary>', b, re.S)
        a = re.search(r'<p[^>]*>(.*?)</p>', b, re.S)
        if q and a:
            itens.append({'@type': 'Question', 'name': limpo(q.group(1)),
                          'acceptedAnswer': {'@type': 'Answer',
                                             'text': limpo(a.group(1))}})
    if not itens:
        return None
    return {'@type': 'FAQPage', 'mainEntity': itens}


def migalhas(f):
    if f == 'index.html':
        return None
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Início',
         'item': BASE + '/'},
        {'@type': 'ListItem', 'position': 2,
         'name': NOMES.get(f, f.replace('.html', '').replace('-', ' ').title()),
         'item': f'{BASE}/{f}'},
    ]}


def servico(f, s):
    if f not in ('servicos.html', 'renovacao.html', 'modelos.html'):
        return None
    t = re.search(r'<title>(.*?)</title>', s, re.S)
    d = re.search(r'<meta\s+name="description"\s+content="(.*?)"', s, re.S)
    return {
        '@type': 'Service',
        'name': re.split(r'\s+—\s+', limpo(t.group(1)))[0] if t else f,
        'description': limpo(d.group(1)) if d else '',
        'url': f'{BASE}/{f}',
        'provider': {'@id': NEG},
        'areaServed': {'@type': 'Country', 'name': 'Portugal'},
    }


def main():
    n = 0
    for f in sorted(x for x in glob.glob('*.html') if not x.startswith('modelo-')):
        s = open(f, encoding='utf-8').read()
        partes = []

        if f in NOINDEX:
            if 'name="robots"' not in s:
                partes.append('<meta name="robots" content="noindex, follow">')
        else:
            grafo = [x for x in (migalhas(f), faq(s), servico(f, s)) if x]
            if grafo:
                partes.append(
                    '<script type="application/ld+json">' +
                    json.dumps({'@context': 'https://schema.org',
                                '@graph': grafo},
                               ensure_ascii=False, separators=(',', ':')) +
                    '</script>')

        if not partes:
            continue
        novo = INICIO + '\n' + '\n'.join(partes) + '\n' + FIM
        if INICIO in s:
            s = re.sub(re.escape(INICIO) + r'.*?' + re.escape(FIM),
                       lambda _: novo, s, flags=re.S)
        else:
            s = s.replace('</head>', novo + '\n</head>', 1)
        open(f, 'w', encoding='utf-8').write(s)
        n += 1
    print(f'{n} paginas atualizadas')


if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    main()
