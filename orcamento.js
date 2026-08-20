/* ============================================================
   TECNOVA Digital — Pedido do site
   ------------------------------------------------------------
   TUDO O QUE PODE MUDAR ESTÁ AQUI EM CIMA.
   Preços em euros. Para alterar um preço, muda só o número.
   ============================================================ */

/* --- Campanha ativa ------------------------------------------------ */
const PROMO = {
  ativo: true,
  fim: '2026-09-30',        // último dia da campanha (AAAA-MM-DD)
  desconto: 0.40,           // 40% sobre o valor total do site
  codigo: 'INOVA40',
  mesGratis: true           // 1.ª mensalidade de manutenção grátis
};

/* A data por extenso, para não ficar escrita à mão em cinco sítios e
   depois um deles esquecer-se de acompanhar a campanha seguinte. */
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
                  'julho','agosto','setembro','outubro','novembro','dezembro'];
function fimPorExtenso() {
  var p = PROMO.fim.split('-');
  return Number(p[2]) + ' de ' + MESES_PT[Number(p[1]) - 1];
}

/* --- Link de pagamento --------------------------------------------
   Enquanto estiver vazio (""), o botão "Finalizar" abre a caixa com as
   instruções de pagamento por MB WAY e transferência. Assim que tiveres um link de
   pagamento (Stripe Payment Link, MB WAY, SumUp, etc.), cola-o aqui e o
   botão passa a levar o cliente direto para o pagamento.               */
const LINK_PAGAMENTO = "";

/* --- Moedas ---------------------------------------------------------
   Todos os preços do catálogo estão em EUROS. O real é convertido só na
   hora de mostrar, pela taxa aqui em baixo.

   >>> ATUALIZA A TAXA DE CÂMBIO DE VEZ EM QUANDO <<<
   Se ficar desatualizada, os pedidos em reais saem errados. Muda o
   número em `taxa` e a data em `taxaData`.

   O `ajuste` serve para praticar um preço diferente no Brasil sem mexer
   no catálogo: 1 = conversão direta, 0.8 = 20% abaixo da conversão.     */
// Câmbio de referência do Banco Central Europeu. Ao actualizar as taxas,
// actualize também esta data — ela aparece na página.
const CAMBIO_DATA = '30/07/2026';   // dia em que as taxas abaixo foram verificadas

// Para acrescentar um país: copia um bloco, muda a bandeira, o código, o
// símbolo e a taxa. Aparece logo no seletor, sem mexer em mais nada.
const MOEDAS = {
  pt: {
    pais: 'Portugal', bandeira: '🇵🇹', codigo: 'EUR', simbolo: '€', curto: 'EUR',
    sufixo: true, taxa: 1, ajuste: 1, casas: 2,
    pagamento: {
      titulo: 'Dados para o sinal',
      linhas: [
        ['MB WAY', '+351 933 113 525'],
        ['Transferência (IBAN)', 'PT50 0007 0000 0074 9704 5622 3'],
        ['Banco', 'Novo Banco'],
        ['Titular', 'Wesley Vianna']
      ],
      nota: 'Também pode pagar com cartão, Apple Pay ou Google Pay — peça-nos o link de pagamento.'
    }
  },
  br: {
    pais: 'Brasil', bandeira: '🇧🇷', codigo: 'BRL', simbolo: 'R$', curto: 'BRL',
    sufixo: false, taxa: 5.85, ajuste: 0.70, casas: 0,   // 0.70 = 30% abaixo da conversão direta
    pagamento: {
      titulo: 'Dados para o sinal (Pix)',
      linhas: [
        ['Chave Pix (email)', 'viannakoa3@gmail.com'],
        ['Nome do titular', 'Wesley Vianna'],
        ['Banco', 'Bradesco']
      ],
      nota: 'O pagamento é por Pix. Depois de pagar, envie o comprovativo por email com a referência do pedido.'
    }
  },
  us: {
    pais: 'Estados Unidos', bandeira: '🇺🇸', codigo: 'USD', simbolo: '$', curto: 'USD',
    sufixo: false, taxa: 1.15, ajuste: 1, casas: 0,
    pagamento: {
      titulo: 'Payment details / Dados para o sinal',
      linhas: [['Cartão, Apple Pay ou Google Pay', 'link enviado por email'],
               ['Transferência internacional', ''], ['Titular', 'Wesley Vianna']],
      nota: 'Paga com cartão, Apple Pay ou Google Pay pelo link que lhe enviamos. Sem taxas escondidas.'
    }
  },
  uk: {
    pais: 'Reino Unido', bandeira: '🇬🇧', codigo: 'GBP', simbolo: '£', curto: 'GBP',
    sufixo: false, taxa: 0.86, ajuste: 1, casas: 0,
    pagamento: {
      titulo: 'Dados para o sinal',
      linhas: [['Cartão, Apple Pay ou Google Pay', 'link enviado por email'],
               ['Transferência internacional', ''], ['Titular', 'Wesley Vianna']],
      nota: 'Paga com cartão, Apple Pay ou Google Pay pelo link que lhe enviamos.'
    }
  },
  ch: {
    pais: 'Suíça', bandeira: '🇨🇭', codigo: 'CHF', simbolo: 'CHF', curto: 'CHF',
    sufixo: false, taxa: 0.93, ajuste: 1, casas: 0,
    pagamento: {
      titulo: 'Dados para o sinal',
      linhas: [['Cartão, Apple Pay ou Google Pay', 'link enviado por email'],
               ['Transferência (IBAN)', ''], ['Titular', 'Wesley Vianna']],
      nota: 'Paga com cartão, Apple Pay, Google Pay ou transferência SEPA.'
    }
  },
  ca: {
    pais: 'Canadá', bandeira: '🇨🇦', codigo: 'CAD', simbolo: 'C$', curto: 'CAD',
    sufixo: false, taxa: 1.61, ajuste: 1, casas: 0,
    pagamento: {
      titulo: 'Dados para o sinal',
      linhas: [['Cartão, Apple Pay ou Google Pay', 'link enviado por email'],
               ['Transferência internacional', ''], ['Titular', 'Wesley Vianna']],
      nota: 'Paga com cartão, Apple Pay ou Google Pay pelo link que lhe enviamos.'
    }
  }
};

/* --- Dados de pagamento (usado se a moeda não tiver os seus) --------- */
const PAGAMENTO = {
  mbway: '+351 933 113 525',
  titular: 'Wesley Vianna',
  iban: ''                  // ex.: 'PT50 0000 0000 0000 0000 0000 0'
};

/* --- Detetar o país de quem entra --------------------------------
   Serve só para pré-escolher a bandeira certa: quem entra do Brasil vê
   logo os valores em reais, quem entra de Portugal vê em euros.

   O visitante pode sempre trocar de bandeira à mão — e isso é normal:
   num site nada do que o browser calcula pode ficar escondido de quem
   o está a ver. O que isto resolve é a comodidade, não o sigilo.

   Se falhar (sem rede, serviço em baixo, bloqueador de anúncios), fica
   simplesmente Portugal. Nunca trava o carregamento da página.          */
const GEO = {
  ativo: true,
  servicos: [
    'https://get.geojs.io/v1/ip/country.json',   // devolve {"country":"BR"}
    'https://ipwho.is/'                          // reserva
  ],
  // código do país (ISO) → chave em MOEDAS
  mapa: {
    PT: 'pt', BR: 'br', US: 'us', GB: 'uk', CH: 'ch', CA: 'ca',
    // países do euro caem em Portugal, que também é euro
    ES: 'pt', FR: 'pt', DE: 'pt', IT: 'pt', LU: 'pt', BE: 'pt',
    NL: 'pt', IE: 'pt', AT: 'pt'
  },
  timeout: 2500
};


/* --- Remodelação de um site que já existe --------------------------
   Quem já tem site não parte do zero: a estrutura está pensada, os textos
   e as fotos existem. Por isso a base e o trabalho de marca ficam mais
   baratos — e há tarefas próprias que um site novo não tem.            */
const REMODELACAO = {
  descBase: 0.30,     // 30% menos no tamanho do site
  descMarca: 0.20,    // 20% menos no grupo "Marca e conteúdo"
  itens: [
    { id: 'rMigrar',   nome: 'Migração dos textos e fotos do site atual', preco: 90,
      desc: 'Passamos o conteúdo que vale a pena do site antigo para o novo, revisto e organizado.' },
    { id: 'rRedirect', nome: 'Redirecionamentos para não perder o Google', preco: 70,
      desc: 'As moradas antigas passam a levar às novas páginas.',
      simples: 'Sem isto, quem tinha o seu site guardado nos favoritos ou o encontrava no Google passa a bater numa página de erro. É o erro mais caro de quem muda de site.' },
    { id: 'rDominio',  nome: 'Manter o domínio e os emails que já tem',  preco: 40,
      desc: 'Fica com o mesmo endereço e os mesmos emails. Ninguém do lado do cliente dá por nada.' },
    { id: 'rBackup',   nome: 'Cópia de segurança do site antigo',        preco: 30,
      desc: 'Guardamos uma cópia completa do que existe antes de mexer, por precaução.' },
    { id: 'rAudit',    nome: 'Análise do site atual por escrito',        preco: 80,
      desc: 'O que está a funcionar, o que está a afastar clientes e o que vale a pena aproveitar.',
      simples: 'Recebe um documento com o diagnóstico. Se depois não avançar connosco, o documento é seu na mesma.' }
  ]
};

/* --- Comparação com o mercado ---------------------------------------
   Isto é o que faz o cliente perceber que não está a ser enganado: mostramos
   as horas de trabalho de cada coisa e quanto o mesmo projeto custa noutro
   lado, com a fonte à vista.

   Os intervalos abaixo são de estudos de preços publicados sobre o mercado
   português em 2026 (ver `fontes`). NÃO são preços de concorrentes —
   e está escrito no ecrã que são valores de referência.

   `TAXA_HORA` é a nossa taxa efetiva: é com ela que convertemos o preço de
   cada item em horas de trabalho. Se mudares os preços, muda também isto.   */
const TAXA_HORA = 30;

const MERCADO = {
  ativo: true,
  taxaFreelancer: [30, 80],     // €/hora praticados por freelancers em Portugal
  perfis: [
    { id: 'landing', nome: 'Página única / landing page',
      quando: function (base) { return base === 'b1'; },
      agencia: [500, 2000], freelancer: [500, 1500] },
    { id: 'loja', nome: 'Loja online',
      quando: function (base, sel) { return !!sel.loja; },
      agencia: [3000, 15000], freelancer: [1890, 8000] },
    { id: 'site', nome: 'Site institucional completo',
      quando: function () { return true; },      // caso geral
      agencia: [2000, 10000], freelancer: [1000, 5000] }
  ],
  manutencao: [49, 149],        // €/mês de manutenção praticados no mercado
  fontes: 'Valores de referência para o mercado português em 2026, publicados por ' +
          'agências e plataformas do setor (Modular Digital, Webarty, 3hash, Savoris, Shopify). ' +
          'São intervalos típicos, não propostas de concorrentes.'
};

/* --- Manutenção mensal --------------------------------------------- */
const MANUTENCAO = [
  { id: 'm0', nome: 'Sem manutenção', preco: 0,
    desc: 'O site fica seu. Se precisar de alterações, pede quando quiser.' },
  { id: 'm1', nome: 'Manutenção Essencial', preco: 19.90, destaque: true,
    desc: 'Alterações de preços e serviços, banners de promoções e suporte prioritário por email.' },
  { id: 'm2', nome: 'Manutenção Completa', preco: 39.90,
    desc: 'Tudo do Essencial + pequenas alterações ilimitadas e campanhas de cupões e fidelidade feitas por nós.' }
];

/* --- Catálogo de funcionalidades -----------------------------------
   tipo 'base'  → escolhe-se uma (radio)
   tipo 'multi' → escolhem-se as que quiser (checkbox)
   req: ['id']  → esta opção precisa de outra; é ligada automaticamente  */
const GRUPOS = [
  {
    id: 'base', tipo: 'base', icone: '🧱',
    nome: 'Tamanho do site',
    sub: 'Escolha uma. É a base de tudo — depois acrescenta só o que fizer sentido para si.',
    itens: [
      { id: 'b1',    nome: 'Página única',        preco: 190, desc: 'Uma só página com tudo o essencial: quem é, o que faz, preços e contacto. Perfeita para começar já.' },
      { id: 'b3a5',  nome: '3 a 5 páginas',       preco: 320, desc: 'Início, Sobre, Serviços, Galeria e Contactos. O tamanho mais escolhido por negócios locais.', destaque: true },
      { id: 'b6a10', nome: '6 a 10 páginas',      preco: 490, desc: 'Espaço para páginas separadas de serviços, produtos, equipa e mais. Site completo.' },
      { id: 'b10',   nome: 'Mais de 10 páginas',  preco: 690, desc: 'Projetos maiores, com muitas categorias, várias unidades ou catálogo extenso.' }
    ]
  },
  {
    id: 'captar', tipo: 'multi', icone: '📞',
    nome: 'Trazer clientes',
    sub: 'O que faz o visitante deixar de ser visitante e passar a marcação ou encomenda.',
    itens: [
      { id: 'chatvivo',  nome: 'Chat ao vivo no site',                      preco: 30,  desc: 'O visitante escreve-lhe ali mesmo, sem sair do site. As conversas ficam guardadas e nada se perde.' },
      { id: 'form',      nome: 'Formulário de contacto por email',          preco: 40,  desc: 'Para quem prefere escrever em vez de telefonar. Chega-lhe ao email.' },
      { id: 'orc',       nome: 'Pedido de orçamento com perguntas próprias', preco: 60, desc: 'O cliente responde às perguntas certas e o pedido já lhe chega completo.' },
      { id: 'marcacao',  nome: 'Marcação online',                            preco: 110, desc: 'Escolhe serviço, dia e hora. O pedido cai organizado na sua caixa de entrada.', exemplo: 'modelo-barbearia.html',
        simples: 'O cliente escolhe serviço, dia e hora no site. O pedido chega-lhe ao email já escrito e organizado, sem telefonemas.' },
      { id: 'calendario',nome: 'Calendário com horários reais',              preco: 90,  req: ['marcacao'], desc: 'Só mostra as horas que tem mesmo livres e confirma automaticamente.' },
      { id: 'lembrete',  nome: 'Lembrete automático antes da hora',          preco: 60,  req: ['marcacao'], desc: 'Aviso ao cliente horas antes. Reduz faltas — e faltas são dinheiro perdido.' },
      { id: 'chat',      nome: 'Chat automático de atendimento',             preco: 80,  desc: 'Responde sozinho às perguntas de sempre: horários, preços, morada, estacionamento.',
        simples: 'Uma janelinha de conversa no canto do site que responde sozinha às perguntas de sempre — horários, morada, preços — mesmo quando está fechado.' },
      { id: 'news',      nome: 'Recolha de emails / newsletter',             preco: 50,  desc: 'Cria a sua lista de clientes. Um dia quer avisar de uma promoção — e já tem a quem.',
        simples: 'Os visitantes deixam o email no site e ficam numa lista sua. Um dia quer avisar de uma promoção — e já tem a quem enviar.' },
      { id: 'mapa',      nome: 'Botão de chamada e rota no Google Maps',     preco: 25,  desc: 'Um toque para ligar, um toque para o GPS arrancar até à sua porta.' }
    ]
  },
  {
    id: 'mostrar', tipo: 'multi', icone: '✨',
    nome: 'Mostrar o negócio',
    sub: 'O que faz o cliente confiar antes sequer de falar consigo.',
    itens: [
      { id: 'galeria',   nome: 'Galeria de fotos com filtros',        preco: 70,  desc: 'Os seus trabalhos organizados por categoria. É o seu portefólio a trabalhar 24h.', exemplo: 'modelo-confeitaria-galeria.html',
        simples: 'Uma página só com os seus trabalhos, separados por categoria — o cliente carrega numa e vê só essas fotos.' },
      { id: 'carrossel', nome: 'Carrossel de destaques na entrada',   preco: 60,  desc: 'Banners que rodam com as novidades, promoções e o que mais vende.', exemplo: 'modelo-confeitaria.html',
        simples: 'São aqueles banners grandes no topo da página que vão rodando sozinhos, um a seguir ao outro. Serve para mostrar logo à entrada as novidades, as promoções e o que mais vende, sem o cliente ter de procurar.' },
      { id: 'antesdepois', nome: 'Antes &amp; Depois (deslizador)',   preco: 60,  desc: 'O cliente arrasta e vê a diferença. Não há argumento de venda mais forte.',
        simples: 'Duas fotos sobrepostas com um puxador ao meio. O cliente arrasta e vê o antes de um lado e o depois do outro.' },
      { id: 'video',     nome: 'Vídeo de apresentação',               preco: 45,  desc: 'Integrado no site, sem sair para o YouTube.' },
      { id: 'precario',  nome: 'Preçário por categorias',             preco: 70,  desc: 'Deixa de responder "quanto custa?" vinte vezes por dia.', exemplo: 'modelo-barbearia-servicos.html',
        simples: 'A tabela de preços organizada por categorias dentro do site, em vez de um PDF que o cliente tem de descarregar e ler no telemóvel aos bocados.' },
      { id: 'pagserv',   nome: 'Página própria para cada serviço',    preco: 90,  desc: 'Cada serviço com foto, duração, preço e explicação. Também ajuda no Google.' },
      { id: 'cardapio',  nome: 'Cardápio digital + QR code de mesa',  preco: 120, desc: 'O cliente aponta o telemóvel e vê o menu atualizado. Zero impressões.', exemplo: 'modelo-restaurante-menu.html',
        simples: 'Imprime um QR code e cola na mesa. O cliente aponta o telemóvel e abre o menu — e você muda os preços quando quiser sem reimprimir nada.' },
      { id: 'catalogo',  nome: 'Catálogo de produtos com fotos',      preco: 130, desc: 'Os seus produtos organizados, com preço e descrição.', exemplo: 'modelo-confeitaria-catalogo.html' },
      { id: 'ficha',     nome: 'Ficha individual de produto',         preco: 90,  req: ['catalogo'], desc: 'Página própria por produto, com galeria e opções.' },
      { id: 'testemunhos', nome: 'Testemunhos de clientes',           preco: 40,  desc: 'Prova social. Quem já comprou vende melhor do que qualquer texto seu.' },
      { id: 'equipa',    nome: 'Equipa / profissionais',              preco: 60,  desc: 'Fotos e perfil de quem trabalha consigo. As pessoas compram a pessoas.' },
      { id: 'numeros',   nome: 'Números e resultados',                preco: 35,  desc: 'Anos de casa, clientes servidos, avaliação média — a contar sozinhos no ecrã.' }
    ]
  },
  {
    id: 'produtos', tipo: 'vol', icone: '📦',
    nome: 'Produtos: quantos e como entram no site',
    sub: 'Aqui é onde está o trabalho a sério. Meter 20 produtos é uma tarde; meter 2.000 com fotos tratadas é outro projeto. Por isso perguntamos primeiro.',
    itens: [
      { id: 'vol0',    nome: 'Não vou ter produtos',   preco: 0,    desc: 'O meu negócio é de serviços, não de produtos. Escolha esta e salte à frente.' },
      { id: 'vol25',   nome: 'Até 25 produtos',        preco: 60,   desc: 'Uma carta pequena, uma lista de serviços, meia dúzia de artigos.' },
      { id: 'vol100',  nome: 'Até 100 produtos',       preco: 180,  desc: 'Uma ementa completa ou uma loja pequena.', destaque: true },
      { id: 'vol500',  nome: 'Até 500 produtos',       preco: 550,  desc: 'Loja a sério. São 500 fichas com nome, preço, descrição e foto — uma a uma.' },
      { id: 'vol1000', nome: 'Até 1.000 produtos',     preco: 950,  desc: 'Catálogo grande. A esta escala fazemos a carga por ficheiro sempre que possível.' },
      { id: 'vol2000', nome: 'Mais de 2.000 produtos', preco: 1600, desc: 'Valor de partida. Com esta dimensão falamos primeiro para ver como estão os seus dados e fecho o preço certo consigo.' },

      { id: 'fotosProd', nome: 'Tratamento das fotos dos produtos', preco: 0,
        precoVol: { vol0: 0, vol25: 45, vol100: 140, vol500: 480, vol1000: 850, vol2000: 1500 },
        desc: 'Fotos todas com o mesmo fundo, o mesmo enquadramento e o mesmo tamanho.',
        simples: 'Sem isto, cada foto entra como a tirou — umas maiores, outras tortas, fundos diferentes — e o catálogo fica desalinhado. Isto é o que faz parecer uma loja a sério.' },
      { id: 'importar', nome: 'Importação a partir de Excel ou lista que já tenha', preco: 0,
        precoVol: { vol0: 0, vol25: 30, vol100: 70, vol500: 160, vol1000: 240, vol2000: 380 },
        desc: 'Se já tem os produtos numa folha de Excel ou noutro programa, entram de uma vez em vez de um a um.',
        simples: 'Poupa-lhe dias de trabalho — e é bem mais barato do que meter tudo à mão.' },
      { id: 'variantes', nome: 'Variantes por produto', preco: 110,
        desc: 'O mesmo produto em vários tamanhos, cores ou sabores, cada um com o seu preço.',
        simples: 'Exemplo: um bolo em P, M e G; uma t-shirt em S, M, L e em três cores.' },
      { id: 'fichaTec', nome: 'Ficha técnica por produto', preco: 0,
        precoVol: { vol0: 0, vol25: 40, vol100: 90, vol500: 220, vol1000: 340, vol2000: 520 },
        desc: 'Campos próprios como medidas, materiais, ingredientes, alergénios ou garantia.' }
    ]
  },
  {
    id: 'vender', tipo: 'multi', icone: '💶',
    nome: 'Vender e receber',
    sub: 'Para quem quer receber encomendas e dinheiro pelo site, não só contactos.',
    itens: [
      { id: 'simulador', nome: 'Simulador de encomenda com preço automático', preco: 180, desc: 'O cliente escolhe tamanho, sabor e extras — o site calcula o total sozinho.', exemplo: 'modelo-confeitaria-contactos.html',
        simples: 'O cliente escolhe as opções e o site faz a conta sozinho, mostrando o preço final antes de encomendar. É exatamente isto que está a usar agora.' },
      { id: 'comprov',   nome: 'Comprovativo de sinal obrigatório',   preco: 70,  desc: 'Sem anexar o comprovativo dos 50%, a encomenda não avança. Protege o seu trabalho.' },
      { id: 'mbway',     nome: 'Pagamento MB WAY / Multibanco',       preco: 120, desc: 'Referência gerada para o cliente pagar como está habituado.' },
      { id: 'cartao',    nome: 'Pagamento por cartão',                preco: 160, desc: 'Checkout seguro com cartão. O dinheiro cai na sua conta.' },
      { id: 'loja',      nome: 'Loja online completa',                preco: 390, desc: 'Carrinho, portes, checkout e gestão de encomendas.',
        simples: 'Carrinho de compras, portes, pagamento e gestão das encomendas. O cliente compra sozinho no site, do princípio ao fim.' },
      { id: 'stock',     nome: 'Gestão de stock',                     preco: 120, req: ['loja'], desc: 'Esgota sozinho quando acaba. Nunca mais vende o que não tem.' },
      { id: 'promo',     nome: 'Códigos promocionais de campanha',    preco: 90,  desc: 'Crie códigos com desconto e validade para as suas campanhas.' }
    ]
  },
  {
    id: 'fidelizar', tipo: 'multi', icone: '🏅',
    nome: 'Fazer o cliente voltar',
    sub: 'Trazer um cliente novo custa; fazer voltar o que já tem é lucro quase puro.',
    itens: [
      { id: 'contas',     nome: 'Conta de cliente com login',         preco: 150, desc: 'Cada cliente tem a sua área: dados, histórico e vantagens.', exemplo: 'conta.html',
        simples: 'Cada cliente cria a conta dele com email e senha — como faz num banco ou numa loja online. Depois entra e vê o histórico dele, os cupões e o cartão de fidelidade.' },
      { id: 'fidelidade', nome: 'Cartão de fidelidade com selos',     preco: 140, req: ['contas'], desc: 'A cada visita, um selo. Ao 10.º, prémio. Sem cartões de papel perdidos na carteira.' },
      { id: 'cupoes',     nome: 'Cupões de desconto',                 preco: 90,  req: ['contas'], desc: 'Cria cupões com validade e vê quem os usou.' },
      { id: 'aniver',     nome: 'Cupão de aniversário automático',    preco: 70,  req: ['contas'], desc: 'No mês de anos do cliente, sai um desconto sozinho. Zero trabalho seu.' },
      { id: 'historico',  nome: 'Histórico do cliente',               preco: 80,  req: ['contas'], desc: 'Sabe o que cada cliente fez e quando. Atendimento de outro nível.' }
    ]
  },
  {
    id: 'app', tipo: 'multi', icone: '📱',
    nome: 'Aplicação integrada no site',
    sub: 'O mesmo site a funcionar como uma aplicação no telemóvel do seu cliente.',
    itens: [
      { id: 'pwa',     nome: 'Aplicação própria integrada no site', preco: 190,
        desc: 'O cliente entra no seu site e instala o ícone no telemóvel dele, sem passar pela App Store nem pela Play Store.',
        simples: 'Fica um ícone no ecrã do telemóvel com o seu logótipo. Abre em ecrã inteiro e parece uma aplicação de verdade — mas não paga lojas, nem espera aprovações, e funciona em iPhone e Android ao mesmo tempo.',
        exemplo: 'app.html' },
      { id: 'offline', nome: 'Funciona sem internet',          preco: 70,  req: ['pwa'],
        desc: 'Abre na mesma quando a rede falha, com a última informação que carregou.' },
      { id: 'push',    nome: 'Notificações no telemóvel',      preco: 110, req: ['pwa'],
        desc: 'Avisa os seus clientes de novidades e promoções sem pagar publicidade.',
        simples: 'Aquele aviso que aparece no telemóvel mesmo com a aplicação fechada.' }
    ]
  },
  {
    id: 'painel', tipo: 'multi', icone: '📊',
    nome: 'O seu painel de gestão',
    sub: 'A parte que só você vê, com senha própria. É daqui que controla o site sem depender de ninguém.',
    itens: [
      { id: 'admin',   nome: 'Painel de gestão (base)',        preco: 160,
        desc: 'Entra com a sua senha e muda preços, textos, fotos e novidades sozinho.',
        simples: 'Sem isto, sempre que quiser mudar um preço tem de me pedir. Com isto, muda você em dois minutos.' },
      { id: 'painelFat', nome: 'Painel de faturação',          preco: 160, req: ['admin'],
        desc: 'Quanto entrou hoje, esta semana, este mês e este ano — e a comparação com o período anterior.',
        simples: 'É o painel que lhe diz se o negócio está a crescer ou a cair, sem ter de fazer contas.' },
      { id: 'painelOrc', nome: 'Painel de encomendas e orçamentos', preco: 140, req: ['admin'],
        desc: 'Todos os pedidos que entram pelo site, organizados por estado: novo, pago, em preparação, entregue.',
        simples: 'Deixa de andar à procura de encomendas perdidas no meio das mensagens.' },
      { id: 'painelProd', nome: 'Gestão de produtos',          preco: 150, req: ['admin'],
        desc: 'Criar, editar, mudar preço, esconder ou marcar como esgotado — tudo por si, sem mexer em código.' },
      { id: 'painelCli', nome: 'Ficheiro de clientes',         preco: 90,  req: ['admin'],
        desc: 'A lista de quem lhe compra, com contactos e histórico, sempre à mão.' },
      { id: 'exportar', nome: 'Exportar tudo para Excel',      preco: 70,  req: ['admin'],
        desc: 'Um botão que descarrega vendas, clientes ou produtos numa folha de cálculo.',
        simples: 'Para entregar ao contabilista ou tratar os números à sua maneira.' },
      { id: 'users',   nome: 'Vários utilizadores com permissões', preco: 90, req: ['admin'],
        desc: 'Cada funcionário com o seu acesso — e você decide o que cada um pode ou não mexer.' },
      { id: 'relat',   nome: 'Relatórios e estatísticas',      preco: 80,  req: ['admin'],
        desc: 'O que mais vende, que dias enchem, de onde vêm os clientes.' }
    ]
  },
  {
    id: 'google', tipo: 'multi', icone: '🔎',
    nome: 'Ser encontrado no Google',
    sub: 'Um site bonito que ninguém encontra não serve de nada.',
    itens: [
      { id: 'seo',    nome: 'SEO base',                           preco: 90,  desc: 'Títulos, descrições e estrutura para o Google perceber e mostrar o seu site.',
        simples: 'SEO é o trabalho de preparar o site para o Google o mostrar quando alguém pesquisa «barbearia perto de mim» ou «bolos de aniversário Lisboa».' },
      { id: 'gmn',    nome: 'Google Meu Negócio',                 preco: 60,  desc: 'A sua ficha no Maps e na pesquisa, tratada e ligada ao site.' },
      { id: 'insta',  nome: 'Ligação ao Instagram',               preco: 50,  desc: 'As suas publicações a aparecerem no site sem ter de as repetir.' },
      { id: 'stats',  nome: 'Estatísticas de visitas',            preco: 40,  desc: 'Saber quantas pessoas entram, de onde vêm e o que veem.',
        simples: 'Um painel que lhe diz quantas pessoas entraram no site, de onde vieram e que páginas viram.' },
      { id: 'rgpd',   nome: 'RGPD: privacidade e cookies',        preco: 60,  desc: 'Política de privacidade, termos e aviso de cookies. Fica dentro da lei.',
        simples: 'É a lei da proteção de dados. Um site que recolhe nomes, emails ou telefones precisa destas páginas — sem elas arrisca coima.' },
      { id: 'speed',  nome: 'Velocidade e otimização',            preco: 55,  desc: 'Imagens tratadas e site a abrir depressa — o Google conta isso.' },
      { id: 'idioma', nome: 'Site em 2 idiomas (PT / EN)',        preco: 180, desc: 'Essencial se tem turistas ou clientes estrangeiros.',
        simples: 'O mesmo site com um botão para trocar de língua. Tudo traduzido, não só umas palavras.' },
      { id: 'dominio',nome: 'Domínio próprio .pt (1.º ano)',      preco: 30,  desc: 'www.oseunegocio.pt em vez de um endereço emprestado.',
        simples: 'É o endereço do site. Em vez de um endereço emprestado e comprido, fica www.oseunegocio.pt.' },
      { id: 'email',  nome: 'Email profissional',                 preco: 45,  desc: 'geral@oseunegocio.pt. Passa outra imagem do que um gmail.' }
    ]
  },
  {
    id: 'marca', tipo: 'multi', icone: '🎨',
    nome: 'Marca e conteúdo',
    sub: 'Se não tem textos, fotos ou logótipo, isto resolve — e o site sai pronto a sério.',
    itens: [
      { id: 'textos',   nome: 'Redação dos textos do site',    preco: 120, desc: 'Escrevo eu os textos todos, com as palavras que vendem o seu serviço.' },
      { id: 'fotos',    nome: 'Tratamento das suas fotos',     preco: 80,  desc: 'As fotos que tem, tratadas e uniformizadas para ficarem de revista.' },
      { id: 'banco',    nome: 'Banco de imagens profissional', preco: 40,  desc: 'Fotos profissionais licenciadas para o que ainda não tem fotografado.' },
      { id: 'logo',     nome: 'Logótipo novo',                 preco: 150, desc: 'Logótipo original, em todos os formatos que vai precisar.' },
      { id: 'identidade', nome: 'Identidade visual',           preco: 90,  desc: 'Cores e tipografia definidas para usar no site, nas redes e nos cartazes.' },
      { id: 'personagem', nome: 'Personagem 3D da marca',      preco: 130, desc: 'Uma mascote ou o seu retrato em 3D, para se destacar nas redes.', exemplo: 'modelo-confeitaria-sobre.html' },
      { id: 'cartaoqr', nome: 'Cartão de visita digital com QR', preco: 45, desc: 'O cliente aponta e fica com os seus contactos guardados.' }
    ]
  },
  {
    id: 'remod', tipo: 'multi', icone: '♻️', so_remod: true,
    nome: 'Passar do site antigo para o novo',
    sub: 'Trocar de site tem tarefas próprias. É aqui que a maior parte das pessoas se queima — e não custa quase nada evitar.',
    itens: REMODELACAO.itens
  }
];

/* --- Pacotes fechados (para sugerir poupança) ----------------------- */
const PACOTES = [
  { nome: 'ESSENCIAL', preco: 350, base: 'b3a5', link: 'pacotes.html',
    inclui: ['b3a5','chatvivo','mapa'] },
  { nome: 'PROFISSIONAL', preco: 650, base: 'b6a10', link: 'pacotes.html',
    inclui: ['b6a10','chatvivo','mapa','precario','marcacao','chat','pagserv','form'] },
  { nome: 'PREMIUM', preco: 990, base: 'b6a10', link: 'pacotes.html',
    inclui: ['b6a10','chatvivo','mapa','precario','marcacao','chat','pagserv','form',
             'pwa','contas','fidelidade','cupoes','aniver','admin'] }
];

/* --- Sugestões por tipo de negócio ---------------------------------- */
const PRESETS = {
  barbearia:   { nome: 'Barbearia',            modelo: 'modelo-barbearia.html',   itens: ['b3a5','chatvivo','marcacao','calendario','lembrete','precario','galeria','testemunhos','equipa','seo','gmn','insta','rgpd','mapa'] },
  estetica:    { nome: 'Clínica de Estética',  modelo: 'modelo-estetica.html',    itens: ['b3a5','chatvivo','marcacao','calendario','lembrete','precario','pagserv','antesdepois','galeria','testemunhos','equipa','seo','gmn','insta','rgpd','mapa'] },
  restaurante: { nome: 'Restaurante ou Café',  modelo: 'modelo-restaurante.html', itens: ['b3a5','chatvivo','cardapio','vol100','fotosProd','galeria','carrossel','testemunhos','seo','gmn','insta','rgpd','mapa'] },
  ginasio:     { nome: 'Ginásio / Personal',   modelo: 'modelo-ginasio.html',     itens: ['b3a5','chatvivo','precario','marcacao','calendario','equipa','numeros','testemunhos','contas','seo','gmn','insta','rgpd','mapa'] },
  oficina:     { nome: 'Oficina Automóvel',    modelo: 'modelo-oficina.html',     itens: ['b3a5','chatvivo','orc','marcacao','precario','testemunhos','numeros','seo','gmn','rgpd','mapa'] },
  salao:       { nome: 'Salão de Beleza',      modelo: 'modelo-salao.html',       itens: ['b3a5','chatvivo','marcacao','calendario','lembrete','precario','galeria','catalogo','vol25','testemunhos','equipa','seo','gmn','insta','rgpd','mapa'] },
  confeitaria: { nome: 'Confeitaria / Bolos',  modelo: 'modelo-confeitaria.html', itens: ['b3a5','chatvivo','catalogo','ficha','vol25','fotosProd','variantes','simulador','comprov','galeria','carrossel','testemunhos','seo','gmn','insta','rgpd','mapa'] },
  loja:        { nome: 'Loja / Comércio',      modelo: 'modelo-confeitaria-catalogo.html', itens: ['b6a10','chatvivo','catalogo','ficha','vol500','fotosProd','importar','variantes','loja','stock','cartao','promo','admin','painelFat','painelOrc','painelProd','galeria','seo','gmn','insta','rgpd','mapa'] },
  servicos:    { nome: 'Serviços ao domicílio', modelo: '',                       itens: ['b3a5','chatvivo','orc','form','precario','testemunhos','galeria','seo','gmn','rgpd','mapa'] },
  outro:       { nome: 'Outro negócio',        modelo: 'modelos.html',            itens: ['b3a5','chatvivo','precario','galeria','testemunhos','seo','gmn','rgpd','mapa'] }
};

/* ============================================================
   Daqui para baixo é o funcionamento. Não precisa de mexer.
   ============================================================ */
(function () {
  'use strict';

  var sel = {};                 // id -> true
  var base = 'b3a5';
  var vol = 'vol0';             // escalão de quantidade de produtos
  var projeto = 'novo';         // 'novo' ou 'remod' (remodelação de site existente)
  var manut = 'm1';
  var negocio = '';
  var TODOS = {};               // id -> item
  var GRUPO_DE = {};            // id -> grupo

  GRUPOS.forEach(function (g) {
    g.itens.forEach(function (it) { TODOS[it.id] = it; GRUPO_DE[it.id] = g; });
  });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var moeda = 'pt';    // chave de MOEDAS: pt, br, us, uk, ch, ca…
  function M() { return MOEDAS[moeda]; }

  // Converte de euros para a moeda escolhida e formata.
  function preco(n) {
    var m = M();
    var v = n * m.taxa * m.ajuste;
    var casas = (m.casas === 0 || Number.isInteger(v)) ? 0 : m.casas;
    if (m.casas === 0) v = Math.round(v);
    var txt = v.toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    return m.sufixo ? txt + m.simbolo : m.simbolo + ' ' + txt;
  }
  var eur = preco;   // nome antigo, mantido para não partir nada

  // Preço do item. Os que dependem da quantidade de produtos (tratamento de
  // fotos, importação, fichas técnicas) mudam conforme o escalão escolhido.
  function precoDe(it) {
    if (it.precoVol) return it.precoVol[vol] || 0;
    return it.preco;
  }
  // Um item cujo preço depende do volume não faz sentido sem produtos.
  function indisponivel(it) { return !!it.precoVol && vol === 'vol0'; }

  // Horas de trabalho por trás de um preço, à nossa taxa efetiva.
  function horasDe(eurAmount) {
    var h = eurAmount / TAXA_HORA;
    return h < 1 ? Math.round(h * 10) / 10 : Math.round(h * 2) / 2;
  }
  function horasTxt(eurAmount) {
    var h = horasDe(eurAmount);
    if (!h) return '';
    return '≈ ' + String(h).replace('.', ',') + (h === 1 ? ' hora' : ' horas') + ' de trabalho';
  }

  /* ---------- campanha ---------- */
  function promoAtiva() {
    if (!PROMO.ativo) return false;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var fim = new Date(PROMO.fim + 'T23:59:59');
    return hoje <= fim;
  }
  function diasQueFaltam() {
    var fim = new Date(PROMO.fim + 'T23:59:59');
    return Math.max(0, Math.ceil((fim - new Date()) / 86400000));
  }

  /* ---------- construir o ecrã ---------- */

  /* ---------- moedas ----------
     Três funções, cada uma com um trabalho só. Estavam as três dentro de
     `montarMoeda()`, e como trocar de moeda voltava a chamar essa função, cada
     clique acrescentava mais um par de ouvintes ao mesmo elemento: 1, 2, 4,
     8… ao décimo clique o navegador refazia a página 512 vezes seguidas e
     bloqueava. Separadas, os ouvintes ficam ligados uma única vez. */

  // desenha os botões e liga o clique — corre uma vez
  function montarMoedas() {
    var box = $('#moedas'); if (!box) return;
    box.innerHTML = Object.keys(MOEDAS).map(function (k) {
      var m = MOEDAS[k];
      return '<button type="button" class="mo" data-m="' + k + '" aria-pressed="false"' +
             ' title="' + m.pais + '"><i>' + m.bandeira + '</i><b>' + m.curto + '</b></button>';
    }).join('');
    box.addEventListener('mousedown', function (e) { e.preventDefault(); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.mo');
      if (b && box.contains(b)) escolherMoeda(b.dataset.m, true);
    });
    pintarMoedas();
  }

  // marca qual está escolhida — corre a cada troca
  function pintarMoedas() {
    var bs = document.querySelectorAll('#moedas .mo');
    Array.prototype.forEach.call(bs, function (b) {
      var ativo = b.dataset.m === moeda;
      b.classList.toggle('on', ativo);
      b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
  }

  // troca a moeda e volta a desenhar tudo o que depende dela.
  // `guardar` só é verdade quando foi a pessoa a escolher: a deteção pelo país
  // é um palpite e não deve ficar registada como preferência.
  function escolherMoeda(codigo, guardar) {
    if (!MOEDAS[codigo] || codigo === moeda) return;
    moeda = codigo;
    if (guardar) { try { localStorage.setItem('tecnova-moeda', moeda); } catch (e) {} }
    pintarMoedas(); notaCambio(); recontar(); calcular();
  }

  // Os preços de cada opção também têm de mudar de moeda.
  function recontar() {
    document.querySelectorAll('#grupos .opt').forEach(function (l) {
      var it = TODOS[l.dataset.id]; if (!it) return;
      var pr = l.querySelector('.pr'); if (!pr) return;
      if (it.precoVol && indisponivel(it)) { pr.textContent = 'escolha primeiro os produtos'; return; }
      pr.textContent = precoDe(it) ? '+' + preco(precoDe(it)) : 'sem custo';
      var hh = l.querySelector('.opt-horas');
      if (hh) hh.textContent = horasTxt(precoDe(it));
    });
    MANUTENCAO.forEach(function (m) {
      var l = document.querySelector('#grp-manut .opt[data-id="' + m.id + '"] .pr');
      if (l) l.textContent = m.preco ? preco(m.preco) + '/mês' : 'grátis';
    });
  }

  function notaCambio() {
    var el = $('#cambio'); if (!el) return;
    var m = M();
    if (m.taxa === 1) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'block';
    var cambio = m.taxa.toLocaleString('pt-PT');
    var txt = m.bandeira + ' Valores em <b>' + m.codigo + '</b>, ao câmbio de <b>1€ = ' +
      cambio + ' ' + m.codigo + '</b> (' + CAMBIO_DATA + ').';
    if (m.ajuste < 1) {
      txt += ' Aplicamos ainda um <b>desconto de ' + Math.round((1 - m.ajuste) * 100) +
             '%</b> sobre a conversão, para o preço acompanhar o mercado local.';
    }
    txt += ' O contrato é feito em euros, por isso o valor na sua moeda pode variar' +
           ' um pouco no dia do pagamento.';
    el.innerHTML = txt;
  }

  function montarProjeto() {
    var box = $('#projeto');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.pj'); if (!b) return;
      projeto = b.dataset.p;
      if (projeto !== 'remod') {
        Object.keys(sel).forEach(function (k) {
          if (GRUPO_DE[k] && GRUPO_DE[k].so_remod) delete sel[k];
        });
      }
      pintar(); calcular();
    });
    box.addEventListener('mousedown', function (e) { e.preventDefault(); });
  }

  function montarNegocios() {
    var box = $('#negocios');
    Object.keys(PRESETS).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.k = k;
      b.textContent = PRESETS[k].nome;
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { aplicarPreset(k); });
      box.appendChild(b);
    });
  }

  function montarGrupos() {
    var box = $('#grupos');
    GRUPOS.forEach(function (g, gi) {
      var s = document.createElement('section');
      s.className = 'grp'; s.id = 'grp-' + g.id;
      if (g.so_remod) s.classList.add('so-remod');
      var itens = g.itens.map(function (it) {
        // num grupo de escolha única, o rádio; nos outros, caixa de seleção.
        // No grupo dos produtos, o escalão é rádio e os extras são caixas.
        var radio = (g.tipo === 'base') || (g.tipo === 'vol' && !it.precoVol && it.id.indexOf('vol') === 0);
        var nome = g.tipo === 'base' ? 'base' : 'vol';
        var ex = it.exemplo
          ? '<a class="ex" href="' + it.exemplo + '" target="_blank" rel="noopener">ver exemplo →</a>' : '';
        return '<label class="opt" data-id="' + it.id + '">' +
          '<input type="' + (radio ? 'radio' : 'checkbox') + '"' +
            (radio ? ' name="' + nome + '"' : '') + ' value="' + it.id + '">' +
          '<span class="mark"></span>' +
          '<span class="opt-body">' +
            '<span class="opt-top"><b>' + it.nome + '</b>' +
              (it.destaque ? '<i class="tag">mais escolhido</i>' : '') +
              '<em class="pr">' + (precoDe(it) ? '+' + eur(precoDe(it)) : 'sem custo') + '</em></span>' +
            '<span class="opt-desc">' + it.desc + ' ' + ex + '</span>' +
            (MERCADO.ativo && precoDe(it) ? '<span class="opt-horas">' + horasTxt(precoDe(it)) + '</span>' : '') +
            (it.simples ? '<span class="opt-simples"><b>Em palavras simples:</b> ' + it.simples + '</span>' : '') +
          '</span></label>';
      }).join('');
      s.innerHTML =
        '<div class="grp-head"><span class="grp-n">' + (gi + 1) + '</span>' +
          '<div><h3>' + g.icone + ' ' + g.nome + '</h3><p>' + g.sub + '</p></div></div>' +
        '<div class="opts">' + itens + '</div>';
      box.appendChild(s);
    });

    // Manutenção
    var s = document.createElement('section');
    s.className = 'grp'; s.id = 'grp-manut';
    s.innerHTML =
      '<div class="grp-head"><span class="grp-n">' + (GRUPOS.length + 1) + '</span>' +
        '<div><h3>🛠️ Manutenção mensal</h3><p>Opcional, mas é o que mantém o site vivo, seguro e atualizado. ' +
        (PROMO.mesGratis ? 'O <b>1.º mês é grátis</b>, para experimentar sem compromisso.' : '') + '</p></div></div>' +
      '<div class="opts">' + MANUTENCAO.map(function (m) {
        return '<label class="opt" data-id="' + m.id + '">' +
          '<input type="radio" name="manut" value="' + m.id + '"' + (m.id === manut ? ' checked' : '') + '>' +
          '<span class="mark"></span><span class="opt-body">' +
          '<span class="opt-top"><b>' + m.nome + '</b>' +
            (m.destaque ? '<i class="tag">recomendado</i>' : '') +
            '<em class="pr">' + (m.preco ? eur(m.preco) + '/mês' : 'grátis') + '</em></span>' +
          '<span class="opt-desc">' + m.desc + '</span></span></label>';
      }).join('') + '</div>';
    box.appendChild(s);

    box.addEventListener('change', function (e) {
      var inp = e.target;
      if (inp.name === 'base') { base = inp.value; }
      else if (inp.name === 'vol') {
        vol = inp.value;
        // sem produtos, os extras que dependem da quantidade deixam de fazer sentido
        if (vol === 'vol0') {
          Object.keys(sel).forEach(function (k) { if (TODOS[k] && TODOS[k].precoVol) delete sel[k]; });
        }
      }
      else if (inp.name === 'manut') { manut = inp.value; }
      else {
        var id = inp.value;
        if (inp.checked) { sel[id] = true; ligarRequisitos(id); }
        else { delete sel[id]; desligarDependentes(id); }
      }
      pintar(); calcular();
    });
  }

  function ligarRequisitos(id) {
    var it = TODOS[id]; if (!it || !it.req) return;
    it.req.forEach(function (r) {
      if (r === 'b6a10' || r.charAt(0) === 'b') return;
      if (!sel[r]) { sel[r] = true; ligarRequisitos(r); }
    });
  }
  function desligarDependentes(id) {
    Object.keys(TODOS).forEach(function (k) {
      var it = TODOS[k];
      if (sel[k] && it.req && it.req.indexOf(id) >= 0) { delete sel[k]; desligarDependentes(k); }
    });
  }

  function pintar() {
    document.querySelectorAll('#grupos .opt').forEach(function (l) {
      var id = l.dataset.id;
      var inp = l.querySelector('input');
      if (inp.name === 'base') inp.checked = (id === base);
      else if (inp.name === 'vol') inp.checked = (id === vol);
      else if (inp.name === 'manut') inp.checked = (id === manut);
      else inp.checked = !!sel[id];
      l.classList.toggle('on', inp.checked);

      // preços que mudam com o escalão de produtos
      var it = TODOS[id];
      if (it && it.precoVol) {
        var fora = indisponivel(it);
        l.classList.toggle('bloq', fora);
        inp.disabled = fora;
        var pr = l.querySelector('.pr');
        if (pr) pr.textContent = fora ? 'escolha primeiro os produtos' : '+' + eur(precoDe(it));
      }
    });
    document.querySelectorAll('#negocios .chip').forEach(function (c) {
      c.classList.toggle('on', c.dataset.k === negocio);
    });
    document.querySelectorAll('#projeto .pj').forEach(function (b) {
      b.classList.toggle('on', b.dataset.p === projeto);
    });
    document.querySelectorAll('#grupos .so-remod').forEach(function (g) {
      g.style.display = (projeto === 'remod') ? '' : 'none';
    });
    var av = $('#remodAviso');
    if (av) av.style.display = (projeto === 'remod') ? 'block' : 'none';
  }

  function aplicarPreset(k) {
    negocio = k;
    sel = {};
    vol = 'vol0';
    PRESETS[k].itens.forEach(function (id) {
      if (!TODOS[id]) return;
      if (GRUPO_DE[id].tipo === 'base') base = id;
      else if (id.indexOf('vol') === 0) vol = id;
      else sel[id] = true;
    });
    pintar(); calcular();

    var av = $('#presetAviso');
    if (av) av.style.display = 'none';   // a proposta diz tudo o que ele dizia

    mostrarProposta(k);
  }

  /* ---------- a proposta pronta ----------
     Quem chega aqui quer saber três coisas: o que leva, quanto custa e o que
     fazer a seguir. A lista ao pormenor continua a existir, mas atrás de um
     botão — porque oitenta caixas de seleção à frente de quem só quer um site
     não são liberdade de escolha, são um obstáculo. */

  // Nome do negócio na frase, tal como se diz a falar.
  var COMO_SE_CHAMA = {
    barbearia:   'uma barbearia',
    estetica:    'uma clínica de estética',
    restaurante: 'um restaurante',
    ginasio:     'um ginásio',
    oficina:     'uma oficina',
    salao:       'um salão de beleza',
    confeitaria: 'uma confeitaria',
    loja:        'uma loja',
    servicos:    'quem presta serviços ao domicílio',
    outro:       'um negócio como o seu'
  };

  var COMO_SE_DIZ = {
    barbearia:   'da sua barbearia',
    estetica:    'da sua clínica',
    restaurante: 'do seu restaurante',
    ginasio:     'do seu ginásio',
    oficina:     'da sua oficina',
    salao:       'do seu salão',
    confeitaria: 'da sua confeitaria',
    loja:        'da sua loja',
    servicos:    'do seu serviço',
    outro:       'do seu negócio'
  };

  /* A lista sai do que está seleccionado neste momento, e não do preset —
     senão bastava tirar um item na lista detalhada para a proposta passar a
     dizer uma coisa e o preço outra. */
  function pintarListaProposta() {
    var alvo = $('#prLista');
    if (!alvo) return;
    var lis = ['<li><b>' + TODOS[base].nome + '</b></li>'];
    GRUPOS.forEach(function (g) {
      if (g.tipo === 'base') return;
      if (g.so_remod && projeto !== 'remod') return;
      if (g.tipo === 'vol') {
        if (vol !== 'vol0' && TODOS[vol]) lis.push('<li>' + TODOS[vol].nome + '</li>');
        return;
      }
      g.itens.forEach(function (it) {
        if (!sel[it.id] || indisponivel(it)) return;
        lis.push('<li>' + it.nome.replace(/&amp;/g, '&') + '</li>');
      });
    });
    alvo.innerHTML = lis.join('');
  }

  /* O tradutor do site não mexe em elementos com `id` — e faz bem, porque são
     os que o JavaScript reescreve. Só que a proposta vive toda dentro deles.
     Então pedimos a tradução ao dicionário nós próprios, na altura de
     escrever. O que não estiver traduzido fica em português, como sempre. */
  function frase(pt) {
    try {
      var l = window.TecnovaI18N && window.TecnovaI18N.atual();
      var d = l && window.TECNOVA_DIC && window.TECNOVA_DIC[l];
      return (d && d[pt]) || pt;
    } catch (e) { return pt; }
  }

  function refrescarProposta() {
    var caixa = $('#proposta');
    if (!caixa || caixa.hidden) return;
    var o = window.__ORC;
    if (!o) return;
    pintarListaProposta();
    // Se houver campanha, mostra-se o antes riscado: o desconto vê-se, não
    // se anuncia.
    var antes = $('#prAntes'), nota = $('#prNota');
    if (o.desconto) {
      antes.textContent = eur(o.aposRemod);
      antes.hidden = false;
      nota.innerHTML = frase('já com') + ' <b>' + (PROMO.desconto * 100) + '%</b> ' +
        frase('de desconto') + ' · ' + frase('código') + ' ' + PROMO.codigo +
        ' · ' + frase('até') + ' ' + frase(fimPorExtenso());
    } else {
      antes.hidden = true;
      nota.textContent = frase('preço fechado, sem extras a meio');
    }
    $('#prTotal').textContent = eur(o.total);
    $('#prSinal').textContent = eur(o.sinal);
  }

  function mostrarPropostaTexto(k) {
    var t = $('#prTitulo'), sub = $('#prSub');
    if (!t || !sub) return;
    t.innerHTML = frase('O site ' + (COMO_SE_DIZ[k] || 'do seu negócio') + ' fica <em>assim</em>.');
    sub.textContent = frase(
      'Escolhemos o que costuma fazer falta a ' + (COMO_SE_CHAMA[k] || 'um negócio como o seu') +
      '. Está tudo incluído no preço — não há extras a aparecer a meio.');
  }

  function mostrarProposta(k) {
    var caixa = $('#proposta');
    if (!caixa) return;

    mostrarPropostaTexto(k);

    pintarListaProposta();

    var mod = $('#prModelo'), m = PRESETS[k].modelo;
    if (m) { mod.href = m; mod.hidden = false; } else { mod.hidden = true; }

    caixa.hidden = false;
    refrescarProposta();
    window.scrollTo({ top: caixa.offsetTop - 90, behavior: 'smooth' });
  }

  /* ---------- cálculo ---------- */
  function linhas() {
    var L = [{ nome: TODOS[base].nome, preco: TODOS[base].preco, grupo: 'Tamanho do site' }];
    GRUPOS.forEach(function (g) {
      if (g.tipo === 'base') return;
      if (g.so_remod && projeto !== 'remod') return;
      if (g.tipo === 'vol' && vol !== 'vol0') {
        L.push({ nome: TODOS[vol].nome, preco: TODOS[vol].preco, grupo: g.nome });
      }
      g.itens.forEach(function (it) {
        if (!sel[it.id] || indisponivel(it)) return;
        L.push({ nome: it.nome.replace(/&amp;/g, '&'), preco: precoDe(it), grupo: g.nome });
      });
    });
    return L;
  }

  function melhorPacote(subtotal) {
    var escolhidos = [base].concat(Object.keys(sel).filter(function (id) {
      if (GRUPO_DE[id] && GRUPO_DE[id].so_remod && projeto !== 'remod') return false;
      return !indisponivel(TODOS[id]);
    }));
    if (vol !== 'vol0') escolhidos.push(vol);
    var melhor = null;
    PACOTES.forEach(function (p) {
      var extra = 0, cobertos = 0;
      escolhidos.forEach(function (id) {
        if (p.inclui.indexOf(id) >= 0) { cobertos++; return; }
        if (GRUPO_DE[id] && GRUPO_DE[id].tipo === 'base') {
          var dif = TODOS[id].preco - TODOS[p.base].preco;
          if (dif > 0) extra += dif;
          return;
        }
        extra += precoDe(TODOS[id]);
      });
      var total = p.preco + extra;
      if (cobertos >= 4 && total < subtotal) {
        if (!melhor || total < melhor.total) melhor = { p: p, total: total, poupa: subtotal - total, extra: extra };
      }
    });
    return melhor;
  }

  function calcular() {
    var L = linhas();
    var subtotal = L.reduce(function (a, b) { return a + b.preco; }, 0);

    var pack = melhorPacote(subtotal);
    var baseFinal = pack ? pack.total : subtotal;

    // Remodelação: o site já existe, por isso a estrutura e o trabalho de
    // marca não se pagam por inteiro. Mostramos como desconto próprio para
    // o cliente ver de onde vem o abatimento.
    var descRemod = 0;
    if (projeto === 'remod') {
      descRemod = Math.round(TODOS[base].preco * REMODELACAO.descBase);
      L.forEach(function (l) {
        if (l.grupo === 'Marca e conteúdo') descRemod += Math.round(l.preco * REMODELACAO.descMarca);
      });
      if (descRemod > baseFinal) descRemod = baseFinal;
    }
    var aposRemod = baseFinal - descRemod;

    var promo = promoAtiva();
    var desconto = promo ? Math.round(aposRemod * PROMO.desconto) : 0;
    var total = aposRemod - desconto;
    var sinal = Math.round(total / 2);
    var mens = MANUTENCAO.filter(function (m) { return m.id === manut; })[0];

    // resumo
    var html = '';
    var grupoAtual = '';
    L.forEach(function (l) {
      if (l.grupo !== grupoAtual) { grupoAtual = l.grupo; html += '<li class="res-g">' + grupoAtual + '</li>'; }
      html += '<li><span>' + l.nome + '</span><b>' + eur(l.preco) + '</b></li>';
    });
    $('#resLista').innerHTML = html;
    var ling = (window.TecnovaI18N && TecnovaI18N.atual()) || 'pt';
    var palavraItem = { pt: [' item', ' itens'], en: [' item', ' items'], es: [' artículo', ' artículos'] }[ling] || [' item', ' itens'];
    $('#resCount').textContent = L.length + (L.length === 1 ? palavraItem[0] : palavraItem[1]);

    var packBox = $('#resPacote');
    if (pack) {
      packBox.style.display = 'block';
      packBox.innerHTML = '<b>Boa notícia:</b> com o que escolheu, o <b>Pacote ' + pack.p.nome +
        '</b> (' + eur(pack.p.preco) + ')' + (pack.extra ? ' + ' + eur(pack.extra) + ' de extras' : '') +
        ' fica mais barato do que somar item a item. Aplicámos já esse preço — <b>poupa ' + eur(pack.poupa) + '</b>.';
    } else { packBox.style.display = 'none'; }

    $('#resSubtotal').textContent = eur(baseFinal);
    $('#resSubtotalRiscado').textContent = pack ? eur(subtotal) : '';
    var lRemod = $('#linhaRemod');
    if (descRemod) {
      lRemod.style.display = 'flex';
      $('#resRemod').textContent = '− ' + eur(descRemod);
    } else { lRemod.style.display = 'none'; }
    var lDesc = $('#linhaDesconto');
    if (desconto) {
      lDesc.style.display = 'flex';
      $('#resDesconto').textContent = '− ' + eur(desconto);
    } else { lDesc.style.display = 'none'; }

    $('#resTotal').textContent = eur(total);
    $('#resSinal').textContent = eur(sinal);
    $('#resResto').textContent = eur(total - sinal);
    $('#resPrestacao').textContent = eur(Math.ceil(total / 12));
    $('#resManut').innerHTML = mens.preco
      ? eur(mens.preco) + '/mês' + (PROMO.mesGratis && promoAtiva() ? ' <s>1.º mês</s> <b>grátis</b>' : '')
      : '—';
    $('#barTotal').textContent = preco(total);

    // ---- comparação com o mercado ----
    var cmp = $('#resMercado');
    if (cmp && MERCADO.ativo && total > 0) {
      var perfil = null;
      for (var i = 0; i < MERCADO.perfis.length; i++) {
        if (MERCADO.perfis[i].quando(base, sel)) { perfil = MERCADO.perfis[i]; break; }
      }
      var horas = horasDe(baseFinal);
      var poupaMin = Math.max(0, perfil.freelancer[0] - total);
      var poupaMax = Math.max(0, perfil.agencia[1] - total);
      cmp.style.display = 'block';
      cmp.innerHTML =
        '<b class="merc-t">O mesmo projeto, no mercado português</b>' +
        '<div class="merc-l"><span>Numa agência</span><b>' + preco(perfil.agencia[0]) + ' – ' + preco(perfil.agencia[1]) + '</b></div>' +
        '<div class="merc-l"><span>Com um freelancer</span><b>' + preco(perfil.freelancer[0]) + ' – ' + preco(perfil.freelancer[1]) + '</b></div>' +
        '<div class="merc-l aqui"><span>Aqui, com tudo o que escolheu</span><b>' + preco(total) + '</b></div>' +
        (poupaMin > 0 ? '<div class="merc-poupa">Poupa entre <b>' + preco(poupaMin) + '</b> e <b>' + preco(poupaMax) + '</b></div>' : '') +
        '<p class="merc-nota">São <b>' + String(horas).replace('.', ',') + ' ' +
        ({ pt: 'horas', en: 'hours', es: 'horas' }[ling] || 'horas') + '</b> de trabalho. ' +
        'Um freelancer em Portugal cobra <b>' + preco(MERCADO.taxaFreelancer[0]) + ' a ' + preco(MERCADO.taxaFreelancer[1]) +
        ' por hora</b>; a nossa taxa efetiva ronda os <b>' + preco(TAXA_HORA) + '/hora</b>. ' +
        'Não há extras a meio: o que está aqui é o que paga.</p>' +
        (mens.preco ? '<p class="merc-nota">Manutenção no mercado: <b>' + preco(MERCADO.manutencao[0]) + ' a ' +
          preco(MERCADO.manutencao[1]) + '/mês</b> · aqui <b>' + preco(mens.preco) + '/mês</b>.</p>' : '') +
        (moeda !== 'pt' ? '<p class="merc-nota">Estes valores de referência são do <b>mercado português</b>, ' +
          'convertidos para ' + M().codigo + ' só para comparar. No seu país os preços locais podem ser outros.</p>' : '') +
        '<p class="merc-fonte">' + MERCADO.fontes + '</p>';
    } else if (cmp) { cmp.style.display = 'none'; }

    window.__ORC = { linhas: L, subtotal: subtotal, pack: pack, baseFinal: baseFinal,
                     projeto: projeto, descRemod: descRemod, aposRemod: aposRemod,
                     desconto: desconto, total: total, sinal: sinal, manut: mens };
    refrescarProposta();
  }

  /* ---------- referência, texto do pedido, gravar ---------- */
  function referencia() {
    var d = new Date();
    var p = function (n) { return ('0' + n).slice(-2); };
    // PED- de pedido. As referências antigas ORC- continuam a funcionar em
    // todo o lado: nada valida o prefixo, é só um texto identificador.
    return 'PED-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function texto(ref, dados) {
    var o = window.__ORC;
    var t = 'Olá Wesley! Fiz a simulação no site da TECNOVA.\n\n';
    t += 'Referência: ' + ref + '\n';
    t += 'Nome: ' + dados.nome + '\n';
    if (dados.negocio) t += 'Negócio: ' + dados.negocio + '\n';
    t += 'Contacto: ' + dados.tel + (dados.email ? ' · ' + dados.email : '') + '\n';
    t += '\n— O QUE ESCOLHI —\n';
    var g = '';
    o.linhas.forEach(function (l) {
      if (l.grupo !== g) { g = l.grupo; t += '\n' + g.toUpperCase() + '\n'; }
      t += '• ' + l.nome + ' — ' + eur(l.preco) + '\n';
    });
    t += '\n— VALORES (' + M().codigo + ') —\n';
    t += 'Tipo de projeto: ' + (o.projeto === 'remod' ? 'Remodelação de site existente' : 'Site novo') + '\n';
    if (o.pack) t += 'Pacote ' + o.pack.p.nome + ' aplicado (poupança de ' + eur(o.pack.poupa) + ')\n';
    t += 'Valor do site: ' + eur(o.baseFinal) + '\n';
    if (o.descRemod) t += 'Desconto de remodelação: −' + eur(o.descRemod) + '\n';
    if (o.desconto) t += 'Desconto ' + (PROMO.desconto * 100) + '% (' + PROMO.codigo + '): −' + eur(o.desconto) + '\n';
    t += 'TOTAL: ' + eur(o.total) + '\n';
    t += 'Sinal de 50% para começar: ' + eur(o.sinal) + '\n';
    t += 'Restante na entrega: ' + eur(o.total - o.sinal) + '\n';
    if (o.manut.preco) t += 'Manutenção: ' + eur(o.manut.preco) + '/mês' + (PROMO.mesGratis ? ' (1.º mês grátis)' : '') + '\n';
    if (dados.notas) t += '\nObservações: ' + dados.notas + '\n';
    return t;
  }

  function gravar(ref, dados) {
    try {
      if (typeof db === 'undefined') return Promise.resolve(false);
      var o = window.__ORC;
      var q = new URLSearchParams(location.search);
      return db.collection('orcamentos').doc(ref).set({
        ref: ref, criado: new Date().toISOString(), estado: 'novo',
        nome: dados.nome, negocio: dados.negocio, tel: dados.tel, email: dados.email, notas: dados.notas,
        pais: M().pais, moeda: M().codigo, taxaCambio: M().taxa * M().ajuste,
        totalEur: o.total, sinalEur: o.sinal,
        projeto: projeto, projetoNome: (projeto === 'remod' ? 'Remodelação de site existente' : 'Site novo'),
        descontoRemodelacao: o.descRemod,
        tipo: negocio, tipoNome: (PRESETS[negocio] || {}).nome || '',
        base: base, baseNome: TODOS[base].nome,
        volume: vol, volumeNome: TODOS[vol].nome,
        itens: Object.keys(sel),
        linhas: o.linhas.map(function (l) { return { nome: l.nome, preco: l.preco, grupo: l.grupo }; }),
        manutencao: manut, manutencaoNome: o.manut.nome, manutencaoPreco: o.manut.preco,
        subtotal: o.subtotal, pacote: o.pack ? o.pack.p.nome : '', valorSite: o.baseFinal,
        desconto: o.desconto, codigoPromo: o.desconto ? PROMO.codigo : '',
        total: o.total, sinal: o.sinal,
        origem: q.get('utm_source') || document.referrer || 'direto',
        campanha: q.get('utm_campaign') || ''
      }).then(function () { return true; }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* ---------- descobrir o país de quem entra ---------- */
  function detetarPais() {
    if (!GEO.ativo || !window.fetch) return Promise.resolve(null);

    function tentar(url) {
      var ctrl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, GEO.timeout);
      return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          clearTimeout(t);
          if (!j) return null;
          // get.geojs.io devolve "country"; ipwho.is devolve "country_code"
          var cod = (j.country_code || j.country || '').toString().toUpperCase();
          return GEO.mapa[cod] || null;
        })
        .catch(function () { clearTimeout(t); return null; });
    }

    return tentar(GEO.servicos[0]).then(function (r) {
      return r || (GEO.servicos[1] ? tentar(GEO.servicos[1]) : null);
    });
  }

  /* ---------- arranque ---------- */
  function iniciar() {
    // permite chegar já em modo remodelação: orcamento.html?projeto=remod
    if (new URLSearchParams(location.search).get('projeto') === 'remod') projeto = 'remod';
    var escolheuAntes = false;
    try {
      var mUrl = new URLSearchParams(location.search).get('moeda');
      var mGuardada = localStorage.getItem('tecnova-moeda');
      if (mUrl && MOEDAS[mUrl]) { moeda = mUrl; escolheuAntes = true; }
      else if (mGuardada && MOEDAS[mGuardada]) { moeda = mGuardada; escolheuAntes = true; }
    } catch (e) {}
    montarMoedas(); notaCambio();

    // Sem escolha anterior, tentamos adivinhar pelo país. A página já está
    // desenhada em euros; se vier resposta, troca sozinha em silêncio.
    if (!escolheuAntes) {
      detetarPais().then(function (pais) {
        escolherMoeda(pais, false);
      });
    }
    montarProjeto();
    montarNegocios();
    montarGrupos();

    // O tradutor não chega ao que escrevemos dentro dos elementos com id,
    // por isso reescrevemo-los sempre que o idioma muda.
    document.addEventListener('tecnova:idioma', function () {
      if (negocio) mostrarPropostaTexto(negocio);
      refrescarProposta();
    });

    // "Ver e mudar item a item": abre a lista detalhada, uma vez só.
    var afinar = $('#prAfinar');
    if (afinar) {
      afinar.addEventListener('click', function () {
        var g = $('#grupos');
        if (!g) return;
        g.hidden = false;
        afinar.hidden = true;
        var av = $('#presetAviso');
        if (av) {
          av.style.display = 'block';
          av.innerHTML = 'Tire ou acrescente o que quiser — a proposta lá em cima e o ' +
            'preço acompanham cada mudança.';
        }
        window.scrollTo({ top: g.offsetTop - 90, behavior: 'smooth' });
      });
    }
    PRESETS.outro.itens.forEach(function (id) {
      if (TODOS[id] && GRUPO_DE[id].tipo !== 'base') sel[id] = true;
    });
    pintar(); calcular();

    // campanha
    var pb = $('#promoBar');
    if (promoAtiva()) {
      var d = diasQueFaltam();
      pb.innerHTML = '<b>' + (PROMO.desconto * 100) + '% de desconto</b> em todo o site até <b>' + fimPorExtenso() + '</b>' +
        (PROMO.mesGratis ? ' + <b>1.ª mensalidade de manutenção grátis</b>' : '') +
        ' · código <span class="cod">' + PROMO.codigo + '</span> · ' +
        '<i>' + (d === 1 ? 'último dia' : 'faltam ' + d + ' dias') + '</i>';
    } else { pb.style.display = 'none'; }

    // barra fixa no telemóvel
    // A altura muda com o idioma e com a largura do ecrã (em telemóveis
    // estreitos o texto quebra). Medimo-la e guardamo-la em --bar-h, para o
    // assistente e o chat ficarem sempre por cima e nunca taparem o total.
    (function medirBarra() {
      var bar = $('#barFixa');
      if (!bar) return;
      function medir() {
        var h = getComputedStyle(bar).display === 'none' ? 0 : bar.offsetHeight;
        document.documentElement.style.setProperty('--bar-h', h + 'px');
      }
      medir();
      window.addEventListener('resize', medir);
      if (window.ResizeObserver) new ResizeObserver(medir).observe(bar);
      document.addEventListener('tecnova:idioma', function () { setTimeout(medir, 60); });
    })();

    $('#barVer').addEventListener('click', function () {
      var r = $('#resumo');
      window.scrollTo({ top: r.offsetTop - 80, behavior: 'smooth' });
    });

    $('#btnLimpar').addEventListener('click', function () {
      sel = {}; base = 'b3a5'; vol = 'vol0'; manut = 'm1'; negocio = ''; projeto = 'novo';
      $('#presetAviso').style.display = 'none';
      pintar(); calcular();
    });

    $('#btnImprimir').addEventListener('click', function () { window.print(); });

    // finalizar
    $('#formFinal').addEventListener('submit', function (e) {
      e.preventDefault();
      var dados = {
        nome: $('#fNome').value.trim(),
        negocio: $('#fNegocio').value.trim(),
        tel: $('#fTel').value.trim(),
        email: $('#fEmail').value.trim(),
        notas: $('#fNotas').value.trim()
      };
      if (!dados.nome || !dados.tel) {
        $('#formErro').textContent = 'Precisamos do seu nome e de um contacto para lhe responder.';
        $('#formErro').style.display = 'block';
        return;
      }
      $('#formErro').style.display = 'none';
      var ref = referencia();
      var msg = texto(ref, dados);
      gravar(ref, dados).catch(function (e) {
        // Se o Firestore recusar, o pedido não chega ao painel. Não podemos
        // deixar o cliente a pensar que está tratado — mandamo-lo pelo email,
        // que não depende de nada do nosso lado estar de pé.
        console.error('Pedido não gravado:', e);
        var av = $('#okAviso');
        if (av) {
          av.innerHTML = 'Não conseguimos guardar o pedido no nosso sistema. ' +
            'Carregue em <b>Enviar o pedido para o meu email</b> aqui em baixo e envie-mo — ' +
            'a referência ' + ref + ' vai na mensagem.';
          av.style.display = 'block';
        }
      });

      $('#okRef').textContent = ref;
      $('#okTotal').textContent = eur(window.__ORC.total);
      $('#okSinal').textContent = eur(window.__ORC.sinal);
      $('#okEmail').href = 'mailto:wesley@tecnovadigital.pt' +
        '?subject=' + encodeURIComponent('Pedido ' + ref + ' — TECNOVA Digital') +
        '&body=' + encodeURIComponent(msg);
      // A página de pagamento leva a referência e os valores no endereço,
      // para cobrar o montante certo sem depender de nada guardado.
      var pay = $('#okPagar');
      pay.href = (LINK_PAGAMENTO || 'pagamento.html') +
        '?ref=' + encodeURIComponent(ref) +
        '&total=' + Math.round(window.__ORC.total) +
        '&sinal=' + Math.round(window.__ORC.sinal) +
        '&moeda=' + M().codigo;
      pay.removeAttribute('target');
      // Os dados de pagamento deixaram de estar repetidos aqui: vivem só na
      // página de pagamento, para não haver dois sítios a dizer o mesmo e um
      // deles a ficar desatualizado.

      // se o cliente estiver com sessão iniciada, o pedido fica logo na
      // conversa da conta dele — passa a poder falar connosco por lá
      try {
        if (typeof auth !== 'undefined' && auth.currentUser && window.TecnovaChat) {
          var u = auth.currentUser;
          TecnovaChat.garantir(u.uid, { nome: dados.nome, email: dados.email || u.email, telefone: dados.tel })
            .then(function () {
              return TecnovaChat.enviar(u.uid, 'admin',
                'Recebemos o seu pedido ' + ref + ' — total de ' + preco(window.__ORC.total) +
                ', com sinal de ' + preco(window.__ORC.sinal) + '. Assim que o sinal entrar, ' +
                'começo o seu site e digo-lhe aqui a data de entrega. Este chat é o seu canal direto ' +
                'comigo: é por aqui que pede alterações e tira dúvidas, sempre que precisar.');
            }).catch(function () {});
        }
      } catch (e) {}

      $('#final').style.display = 'none';
      $('#sucesso').style.display = 'block';
      window.scrollTo({ top: $('#sucesso').offsetTop - 90, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
