/* ============================================================
   TECNOVA Digital — assistente do site
   ------------------------------------------------------------
   Responde às perguntas mais comuns sobre criação de sites,
   preços, prazos, vendas e marketing — e passa a conversa para
   o email quando não sabe ou quando o visitante quer falar.

   Funciona sem servidor e sem custos: as respostas estão todas
   aqui em baixo. Para acrescentar uma, copia um bloco de RESPOSTAS.
   ============================================================ */
(function () {
  'use strict';

  var EMAIL = 'wesley@tecnovadigital.pt';
  var emailLink = function (msg) {
    return 'mailto:' + EMAIL +
      '?subject=' + encodeURIComponent('Pergunta pelo site da TECNOVA Digital') +
      '&body=' + encodeURIComponent(msg || 'Olá Wesley! Vim do site da TECNOVA.');
  };

  /* --------------------------------------------------------
     Base de respostas.
     chaves  → palavras que o visitante pode escrever
     resposta→ o que respondemos
     acoes   → botões que aparecem por baixo da resposta
     -------------------------------------------------------- */
  var RESPOSTAS = [
    {
      id: 'preco',
      chaves: ['preço', 'preco', 'quanto custa', 'custa', 'valor', 'orçamento', 'orcamento', 'pedido', 'encomendar', 'comprar', 'caro', 'barato', 'pagar quanto', 'quanto fica', 'investimento'],
      resposta: 'Depende do que o site precisa de fazer — mas não é um mistério, dá para ver na hora.\n\n' +
        'Um site profissional começa nos <b>350€</b> (3 a 5 páginas, chat no site, perfeito no telemóvel). ' +
        'Com marcações online, preçário e chat de atendimento, fica em <b>650€</b>. ' +
        'Com aplicação própria, contas de cliente e cartão de fidelidade, <b>990€</b>.\n\n' +
        'Na página do pedido escolhe exatamente o que quer e o preço aparece à frente dos olhos, item a item.',
      acoes: [['Abrir a página do pedido', 'orcamento.html'], ['Ver os pacotes', 'pacotes.html']]
    },
    {
      id: 'campanha',
      chaves: ['desconto', 'promoção', 'promocao', 'campanha', 'cupão', 'cupao', 'voucher', 'código', 'codigo', 'setembro'],
      resposta: 'Está a apanhar a campanha certa. 🎉\n\n' +
        'Até <b>30 de setembro</b>: <b>40% de desconto</b> sobre o valor total do site e a <b>1.ª mensalidade de manutenção grátis</b>. ' +
        'O código é <b>INOVA40</b> e é aplicado automaticamente quando faz o pedido.\n\n' +
        'O preço que vê ao montar o pedido é o preço final: paga metade para arrancar e a outra metade só depois de aprovar o site.',
      acoes: [['Montar o pedido com desconto', 'orcamento.html']]
    },
    {
      id: 'prazo',
      chaves: ['prazo', 'quanto tempo', 'demora', 'dias', 'rápido', 'rapido', 'quando fica pronto', 'entrega'],
      resposta: 'Entre <b>5 e 15 dias úteis</b>, conforme o tamanho.\n\n' +
        '• Site essencial: 5 dias úteis\n• Site profissional: 10 dias úteis\n• Com aplicação e contas de cliente: 15 dias úteis\n\n' +
        'O relógio começa a contar quando recebemos o sinal e os conteúdos. Se não tiver textos ou fotos, tratamos disso — só acrescenta uns dias.',
      acoes: [['Ver o que está incluído', 'servicos.html'], ['Escrever ao Wesley', emailLink('Olá Wesley! Preciso do site pronto para uma data. Consegue?')]]
    },
    {
      id: 'pagamento',
      chaves: ['pagamento', 'pagar', 'mbway', 'mb way', 'multibanco', 'transferência', 'transferencia', 'cartão', 'cartao', 'pix', 'prestações', 'prestacoes', 'sinal'],
      resposta: 'Paga em duas partes, e nunca tudo à cabeça:\n\n' +
        '<b>50% para começar</b> e <b>50% na entrega</b> — só paga o resto depois de ver o site no ar e aprovar tudo.\n\n' +
        'Em Portugal aceitamos MB WAY, Multibanco, transferência e cartão (Apple Pay e Google Pay incluídos). ' +
        'No Brasil, Pix. Noutros países, cartão pelo link de pagamento.',
      acoes: [['Montar o pedido e ver o sinal', 'orcamento.html']]
    },
    {
      id: 'ja-tem-site',
      chaves: ['já tenho site', 'ja tenho site', 'tenho um site', 'remodelação', 'remodelacao', 'refazer', 'renovar', 'site antigo', 'atualizar o site', 'melhorar o site', 'wordpress', 'wix'],
      resposta: 'Ótimo — quem já tem site parte com vantagem, e isso desconta no preço.\n\n' +
        'A estrutura fica <b>30% mais barata</b> e o trabalho de textos e imagem <b>20% mais barato</b>, porque já existe muita coisa aproveitável.\n\n' +
        'Há só um cuidado importante: ao mudar de site é preciso fazer <b>redirecionamentos</b>, senão quem o encontrava no Google passa a bater numa página de erro. Tratamos disso.\n\n' +
        'O diagnóstico do seu site atual é gratuito e chega em 24h.',
      acoes: [['Pedir a remodelação', 'orcamento.html?projeto=remod'], ['Pedir diagnóstico grátis', emailLink('Olá Wesley! Quero o diagnóstico grátis do meu site atual.')]]
    },
    {
      id: 'nao-tem-site',
      chaves: ['não tenho site', 'nao tenho site', 'nunca tive', 'começar do zero', 'comecar do zero', 'só tenho instagram', 'so tenho instagram', 'só instagram', 'facebook'],
      resposta: 'Só redes sociais é um risco maior do que parece: a conta não é sua, o alcance é decidido por outros e, se a página cair, perde tudo de uma vez.\n\n' +
        'Um site é o único sítio onde manda você. E resolve as três coisas que mais lhe roubam tempo:\n\n' +
        '• deixa de responder «quanto custa?» vinte vezes por dia\n' +
        '• as marcações chegam organizadas em vez de espalhadas pelas mensagens\n' +
        '• quem o procura no Google encontra-o — hoje, provavelmente, encontra o concorrente\n\n' +
        'Começa nos 350€ e fica pronto em 5 dias úteis.',
      acoes: [['Ver preços', 'orcamento.html'], ['Ver sites de exemplo', 'modelos.html']]
    },
    {
      id: 'vendas',
      chaves: ['vender', 'vendas', 'mais clientes', 'trazer clientes', 'faturar', 'faturação', 'faturacao', 'converter', 'aumentar'],
      resposta: 'Um site bonito que não vende não serve para nada. O que faz diferença é isto, por ordem:\n\n' +
        '<b>1. Tirar o atrito.</b> Chat no site e marcação online. Cada clique a mais perde clientes.\n' +
        '<b>2. Mostrar o preço.</b> Quem esconde o preço perde o cliente para quem o mostra. O preçário à vista poupa-lhe chamadas e traz gente já decidida.\n' +
        '<b>3. Provar.</b> Fotos dos seus trabalhos e testemunhos reais. As pessoas compram a quem confiam, não a quem é mais barato.\n' +
        '<b>4. Fazer voltar.</b> Cartão de fidelidade e cupões. Trazer um cliente novo custa; fazer voltar o que já tem é lucro quase puro.',
      acoes: [['Ver isto a funcionar', 'servicos.html'], ['Montar o meu site', 'orcamento.html']]
    },
    {
      id: 'marketing',
      chaves: ['marketing', 'divulgar', 'divulgação', 'divulgacao', 'publicidade', 'anúncios', 'anuncios', 'redes sociais', 'seo', 'google', 'aparecer no google', 'instagram'],
      resposta: 'A ordem certa poupa-lhe muito dinheiro:\n\n' +
        '<b>Primeiro o site.</b> Fazer anúncios sem site é pagar para mandar gente para o vazio.\n' +
        '<b>Depois o Google.</b> Ficha do Google Meu Negócio tratada e SEO base. É gratuito e é onde as pessoas procuram «perto de mim».\n' +
        '<b>Depois as redes.</b> Instagram com o link do site na bio, a levar ao preçário ou à marcação — não a uma conversa que tem de responder à mão.\n' +
        '<b>Só no fim, anúncios pagos.</b> E aí já sabe quanto lhe custa cada cliente, porque tem números.\n\n' +
        'Muita gente faz isto ao contrário e queima o orçamento todo na última etapa.',
      acoes: [['Montar o pedido com SEO incluído', 'orcamento.html'], ['Escrever sobre a minha situação', emailLink('Olá Wesley! Queria falar sobre como divulgar o meu negócio.')]]
    },
    {
      id: 'design',
      chaves: ['design', 'bonito', 'estética', 'estetica', 'aspeto', 'moderno', 'profissional', 'imagem', 'visual', 'logótipo', 'logotipo', 'logo', 'marca', 'fica bonito', 'no telemovel', 'no telemóvel', 'responsivo', 'adapta'],
      resposta: 'O aspeto conta — mas conta por uma razão concreta: em poucos segundos o visitante decide se você é de confiança.\n\n' +
        'Todos os nossos sites são feitos <b>a pensar primeiro no telemóvel</b>, porque é aí que os seus clientes estão. Nada de texto minúsculo nem botões que não se acertam com o dedo.\n\n' +
        'Se não tiver logótipo, identidade visual ou fotos tratadas, fazemos também — está tudo na página do pedido com preço à frente.\n\n' +
        'A melhor forma de perceber o nível é ver: temos sete sites completos de exemplo, a funcionar a sério.',
      acoes: [['Ver os sites de exemplo', 'modelos.html'], ['Montar o pedido com logótipo', 'orcamento.html']]
    },
    {
      id: 'modelos',
      chaves: ['exemplo', 'exemplos', 'modelo', 'modelos', 'portefólio', 'portefolio', 'trabalhos', 'ver sites', 'demonstração', 'demonstracao'],
      resposta: 'Temos sete sites completos que pode abrir e usar como se fosse um cliente:\n\n' +
        'Barbearia · Clínica de estética · Restaurante e café · Ginásio · Oficina automóvel · Salão de beleza · Confeitaria\n\n' +
        'Não são imagens: são sites a funcionar, com galeria, preçário, páginas de produto e formulários. O da confeitaria até tem um simulador de encomenda que calcula o bolo com recheio e extras.',
      acoes: [['Ver todos os modelos', 'modelos.html'], ['Ver o da confeitaria', 'modelo-confeitaria.html']]
    },
    {
      id: 'app',
      chaves: ['aplicação', 'aplicacao', 'app', 'aplicativo', 'play store', 'app store', 'instalar', 'icone no telemovel', 'ícone no telemóvel', 'app propria', 'aplicação própria', 'aplicacao no telemovel', 'aplicação no telemóvel', 'app no telemovel'],
      resposta: 'Sim, e sem passar pelas lojas.\n\n' +
        'O cliente entra no seu site e instala um ícone no telemóvel dele com o seu logótipo. Abre em ecrã inteiro e parece uma aplicação de verdade — mas não paga taxas de loja, não espera aprovações e funciona em iPhone e Android ao mesmo tempo.\n\n' +
        'Pode ainda ter conta de cliente com login, cartão de fidelidade com selos e notificações no telemóvel.',
      acoes: [['Ver a aplicação', 'app.html'], ['Montar o pedido com aplicação', 'orcamento.html']]
    },
    {
      id: 'marcacoes',
      chaves: ['marcação', 'marcacao', 'marcações', 'agenda', 'agendar', 'reserva', 'reservas', 'horário', 'horario', 'calendário', 'calendario'],
      resposta: 'O cliente escolhe o serviço, o dia e a hora no site, e o pedido cai-lhe no email já escrito e organizado. Sem telefonemas e sem confusão de agenda.\n\n' +
        'Pode ainda ter calendário com as horas que tem mesmo livres, confirmação automática e lembrete horas antes — que é o que faz mesmo baixar as faltas. E faltas são dinheiro perdido.',
      acoes: [['Experimentar num modelo', 'modelo-barbearia.html'], ['Montar o pedido com marcações', 'orcamento.html']]
    },
    {
      id: 'dominio',
      chaves: ['domínio', 'dominio', 'alojamento', 'hospedagem', 'servidor', 'email profissional', '.pt', '.com'],
      resposta: 'Fica tudo tratado por nós.\n\n' +
        '<b>Domínio próprio .pt:</b> +30€/ano (opcional). Fica com www.oseunegocio.pt em vez de um endereço emprestado.\n' +
        '<b>Email profissional</b> (geral@oseunegocio.pt): +45€.\n' +
        '<b>Alojamento:</b> incluído no plano de manutenção, a partir de 19,90€/mês.\n\n' +
        'E o mais importante: <b>o site é seu</b>. Domínio, conteúdos e ficheiros ficam em seu nome — não fica preso a ninguém.',
      acoes: [['Ver preços', 'orcamento.html']]
    },
    {
      id: 'manutencao',
      chaves: ['manutenção', 'manutencao', 'mensalidade', 'mensal', 'depois de pronto', 'suporte', 'alterações', 'alteracoes'],
      resposta: 'Não é obrigatória, mas é o que mantém o site vivo.\n\n' +
        '<b>Essencial — 19,90€/mês:</b> alojamento, cópias de segurança, atualizações de segurança e alterações de preços e serviços.\n' +
        '<b>Completa — 39,90€/mês:</b> tudo o anterior + alterações ilimitadas e campanhas de cupões e fidelidade feitas por nós.\n\n' +
        'O <b>1.º mês é sempre grátis</b> e cancela quando quiser. Se preferir ficar sem, o site é seu na mesma.',
      acoes: [['Ver planos', 'renovacao.html']]
    },
    {
      id: 'garantia',
      chaves: ['garantia', 'confiança', 'confianca', 'seguro', 'e se não gostar', 'e se nao gostar', 'devolução', 'devolucao', 'contrato'],
      resposta: 'Percebo a dúvida — é dinheiro seu. Por isso:\n\n' +
        '• <b>Paga metade no início.</b> A outra metade só depois de ver o site no ar e aprovar.\n' +
        '• <b>Preço fechado.</b> O que está no pedido é o que paga. Nada aparece a meio a dizer «afinal isto é extra».\n' +
        '• <b>O site é seu.</b> Fica com domínio, conteúdos e ficheiros.\n' +
        '• <b>Fala sempre com quem faz.</b> Sem call centers nem tickets — trata diretamente com o Wesley.',
      acoes: [['Conhecer o Wesley', 'sobre.html'], ['Escrever já', emailLink('Olá Wesley! Tenho algumas dúvidas antes de avançar.')]]
    },
    {
      id: 'loja',
      chaves: ['loja online', 'ecommerce', 'e-commerce', 'vender online', 'carrinho', 'produtos', 'catálogo', 'catalogo', 'stock'],
      resposta: 'Sim. Desde um catálogo simples até uma loja completa com carrinho e pagamento.\n\n' +
        'A pergunta mais importante é <b>quantos produtos vai ter</b> — é aí que está o trabalho. Meter 20 produtos é uma tarde; meter 2.000 com fotos tratadas é outro projeto.\n\n' +
        'Por isso o pedido pergunta o número de produtos e ajusta o preço do carregamento, do tratamento das fotos e da importação a partir do seu Excel.',
      acoes: [['Pedir a minha loja', 'orcamento.html'], ['Ver um catálogo', 'modelo-confeitaria-catalogo.html']]
    },
    {
      id: 'brasil',
      chaves: ['brasil', 'reais', 'real', 'brasileiro', 'r$', 'moeda', 'outro país', 'outro pais', 'estrangeiro', 'dólar', 'dolar', 'em reais', 'pagar em reais', 'moeda do meu pais', 'noutro pais'],
      resposta: 'Trabalhamos com clientes em vários países.\n\n' +
        'Ao fazer o pedido escolhe a bandeira do seu país e os valores aparecem na sua moeda: <b>euros</b> (Portugal), <b>reais</b> (Brasil), <b>dólares</b>, <b>libras</b>, <b>francos suíços</b> ou <b>dólares canadianos</b>.\n\n' +
        'No Brasil o pagamento é por <b>Pix</b>. Nos outros países, cartão, Apple Pay ou Google Pay.',
      acoes: [['Montar o pedido em reais', 'orcamento.html?moeda=br'], ['Abrir a página do pedido', 'orcamento.html']]
    },
    {
      id: 'quem',
      chaves: ['quem é', 'quem e', 'wesley', 'sobre', 'empresa', 'agência', 'agencia', 'equipa', 'quem faz'],
      resposta: 'A TECNOVA Digital é o Wesley Vianna. Não é uma agência com camadas de atendimento — é a pessoa que faz o seu site a falar diretamente consigo, do primeiro dia ao último.\n\n' +
        'É por isso que consegue preços de 350€ a 990€ para o que uma agência cobraria vários milhares. E é também por isso que responde no mesmo dia.',
      acoes: [['Ver a página Sobre', 'sobre.html'], ['Escrever ao Wesley', emailLink('Olá Wesley! Queria falar consigo sobre um site.')]]
    },
    {
      id: 'conta',
      chaves: ['conta', 'login', 'registar', 'registrar', 'entrar', 'palavra-passe', 'senha'],
      resposta: 'Criar conta é gratuito e leva menos de um minuto.\n\n' +
        'Com conta fica com: os seus cupões de desconto, o histórico com a TECNOVA e uma <b>conversa direta com o Wesley</b> guardada — nada de repetir a história de cada vez.',
      acoes: [['Criar conta', 'conta.html']]
    }
  ];

  var SUGESTOES = [
    ['💶 Quanto custa um site?', 'quanto custa'],
    ['🏪 Já tenho site, vale a pena refazer?', 'já tenho site'],
    ['📈 Como é que um site me traz clientes?', 'mais clientes'],
    ['⏱️ Em quanto tempo fica pronto?', 'prazo'],
    ['🖼️ Ver exemplos', 'exemplos'],
    ['🇧🇷 Estou no Brasil', 'brasil']
  ];

  var ABERTURA =
    'Olá! 👋 Sou o assistente da TECNOVA Digital.\n\n' +
    'Posso ajudar com preços, prazos, o que um site pode fazer pelo seu negócio e como usá-lo para vender mais. ' +
    'Pergunte à vontade — e se eu não souber, ponho-o a falar com o Wesley.';

  /* ---------- procurar a melhor resposta ---------- */
  function normalizar(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function responder(texto) {
    var t = normalizar(texto);
    if (!t) return null;
    var melhor = null, melhorPonto = 0;
    RESPOSTAS.forEach(function (r) {
      var pontos = 0;
      // Quanto mais longa a expressão que bate certo, mais específica é —
      // por isso "aplicação no telemóvel" ganha a "no telemóvel".
      r.chaves.forEach(function (k) {
        var kn = normalizar(k);
        if (t.indexOf(kn) >= 0) pontos += kn.length;
      });
      if (pontos > melhorPonto) { melhorPonto = pontos; melhor = r; }
    });
    return melhor;
  }

  /* ---------- construir o widget ---------- */
  function iniciar() {
    if (document.getElementById('asWrap')) return;

    var wrap = document.createElement('div');
    wrap.id = 'asWrap';
    wrap.innerHTML =
      '<button class="as-botao" id="asBotao" aria-label="Falar com o assistente">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 3C7 3 3 6.6 3 11c0 2.2 1 4.2 2.7 5.6L5 21l4.6-2A11 11 0 0 0 12 19c5 0 9-3.6 9-8s-4-8-9-8z"/></svg>' +
        '<span class="as-ping"></span></button>' +
      '<div class="as-caixa" id="asCaixa" role="dialog" aria-label="Assistente TECNOVA">' +
        '<div class="as-topo">' +
          '<span class="as-av">T</span>' +
          '<div><b>Assistente TECNOVA</b><span>Responde na hora · 24 horas por dia</span></div>' +
          '<button class="as-fechar" id="asFechar" aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="as-corpo" id="asCorpo"></div>' +
        '<form class="as-envio" id="asForm">' +
          '<input id="asTexto" type="text" autocomplete="off" placeholder="Escreva a sua pergunta…">' +
          '<button type="submit" aria-label="Enviar">➤</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(wrap);

    var caixa = document.getElementById('asCaixa');
    var corpo = document.getElementById('asCorpo');
    var form = document.getElementById('asForm');
    var campo = document.getElementById('asTexto');
    var botao = document.getElementById('asBotao');
    var aberto = false;

    function bolha(quem, html, acoes) {
      var d = document.createElement('div');
      d.className = 'as-msg ' + quem;
      var acHtml = '';
      if (acoes && acoes.length) {
        acHtml = '<div class="as-acoes">' + acoes.map(function (a) {
          var externo = /^https?:/.test(a[1]);
          return '<a href="' + a[1] + '"' + (externo ? ' target="_blank" rel="noopener"' : '') + '>' + a[0] + '</a>';
        }).join('') + '</div>';
      }
      d.innerHTML = '<div class="as-bolha">' + html.replace(/\n/g, '<br>') + acHtml + '</div>';
      corpo.appendChild(d);
      corpo.scrollTop = corpo.scrollHeight;
      return d;
    }

    function sugestoes() {
      var d = document.createElement('div');
      d.className = 'as-sug';
      d.innerHTML = SUGESTOES.map(function (s) {
        return '<button type="button" data-p="' + s[1] + '">' + s[0] + '</button>';
      }).join('');
      corpo.appendChild(d);
      corpo.scrollTop = corpo.scrollHeight;
      d.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        d.remove();
        perguntar(b.textContent.replace(/^[^\w\u00C0-\u017F]+/, '').trim(), b.dataset.p);
      });
    }

    function aPensar() {
      var d = bolha('bot', '<span class="as-dots"><i></i><i></i><i></i></span>');
      d.classList.add('as-pensa');
      return d;
    }

    function perguntar(mostrar, procurar) {
      bolha('eu', mostrar);
      var pensa = aPensar();
      setTimeout(function () {
        pensa.remove();
        var r = responder(procurar || mostrar);
        if (r) {
          bolha('bot', r.resposta, r.acoes);
        } else {
          bolha('bot',
            'Essa não sei responder bem — e prefiro não inventar.\n\n' +
            'O Wesley responde-lhe diretamente, normalmente em poucas horas. Quer falar com ele?',
            [['Escrever ao Wesley', emailLink('Olá Wesley! Perguntei isto no site: "' + mostrar + '"')],
             ['Ver preços', 'orcamento.html']]);
        }
      }, 480);
    }

    function abrir() {
      aberto = true;
      caixa.classList.add('on');
      botao.classList.add('on');
      document.querySelector('.as-ping') && document.querySelector('.as-ping').remove();
      if (!corpo.children.length) {
        bolha('bot', ABERTURA);
        sugestoes();
      }
      setTimeout(function () { if (window.innerWidth > 640) campo.focus(); }, 260);
    }
    function fechar() { aberto = false; caixa.classList.remove('on'); botao.classList.remove('on'); }

    botao.addEventListener('click', function () { aberto ? fechar() : abrir(); });
    document.getElementById('asFechar').addEventListener('click', fechar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && aberto) fechar(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = campo.value.trim(); if (!t) return;
      campo.value = '';
      var s = corpo.querySelector('.as-sug'); if (s) s.remove();
      perguntar(t);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
