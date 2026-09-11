# Auditoria de segurança do APLICATIVO

> A auditoria anterior cobriu a segurança do **jogo** — autoridade do servidor, RNG,
> saldo, idempotência — e concluiu que estava boa. Isso continua valendo e **não é o
> assunto aqui**. Este documento é a auditoria da segurança do **aplicativo**, que nunca
> tinha sido feita e que estava explicitamente registrada como assunto em aberto.

**Escopo:** autenticação, sessão, autorização, limite de chamadas, validação de entrada,
SQL, segredos, variáveis de ambiente, CORS, WebSocket, abuso e registro de dado sensível.

**O que esta auditoria NÃO é:** um teste de invasão. Ela é uma leitura do código com
conferência automatizada (`npm run verify:seguranca`) do que dá para provar sem subir a
rede. Um teste de invasão de verdade continua sendo necessário antes de publicar.

---

## Resumo

| | Achado | Gravidade | Estado |
|---|---|---|---|
| **A1** | CORS aceitava **qualquer origem** (`enableCors()` sem argumento) | **alta** | corrigido |
| **A2** | WebSocket aceitava **qualquer origem** (`origin: '*'`) | **alta** | corrigido |
| **A3** | **Nenhum limite de tentativas** em lugar nenhum, inclusive no login | **alta** | corrigido |
| **A4** | Token sem **pinagem de algoritmo** na verificação | média | corrigido |
| **A5** | Sem **cabeçalhos de segurança** (nosniff, frame-options, referrer, HSTS) | média | corrigido |
| **A6** | Corpo de requisição **sem teto explícito** | baixa | corrigido |
| **A7** | Origem recusada respondia **500** em vez de 403 | baixa | corrigido |
| **B1** | Sessão de **30 dias sem revogação** | média | **em aberto** |
| **B2** | Sem `ValidationPipe` global — validação é manual, rota a rota | média | **em aberto** |
| **B3** | Limite de tentativas é **por processo** (não serve a várias instâncias) | baixa | **em aberto, documentado** |

E o que **já estava certo**, conferido e mantido: senha com scrypt e sal por conta,
comparação em tempo constante, identidade do socket decidida por token assinado uma única
vez, `userId` vindo sempre do token e nunca do corpo, webhook de pagamento com HMAC em
tempo constante, nenhum segredo no código, `.env` fora do versionamento, servidor que se
recusa a subir sem `JWT_SECRET`, e registro que esconde dado sensível por nome **e por
formato**.

---

## Os achados corrigidos

### A1 · CORS aceitava qualquer origem

`app.enableCors()` sem argumento significa *qualquer origem*.

Num aplicativo nativo isso não mudaria nada — CORS é regra de navegador. Mas este projeto
**também roda na web** (`react-native-web`), e aí qualquer página que a pessoa abrisse em
outra aba podia fazer o navegador dela chamar esta API **em nome dela**: apostar, coletar,
trocar o nome. Não é roubo do token; é uso dele, o que dá no mesmo.

**Correção:** lista em `comum/origens-permitidas.ts`, alimentada por `ORIGENS_PERMITIDAS`.
Sem a variável, valem localhost e a rede local privada — que é como se testa no celular.

Duas decisões dentro da correção, ditas porque parecem frouxidão e não são:

- **Pedido sem `Origin` continua passando.** Aplicativo nativo, `curl` e o webhook do
  provedor não mandam esse cabeçalho. Recusá-los quebraria o aplicativo inteiro sem fechar
  nada: quem não é navegador não é obrigado a mandar cabeçalho nenhum, então usar a
  ausência dele como tranca não tranca coisa alguma. Quem protege essas portas é o token e
  a assinatura HMAC.
- **`credentials: false`.** Não há cookie de sessão: o token vai no `Authorization`, que o
  navegador não manda sozinho entre sites. É isso que torna um pedido forjado de outra aba
  inútil mesmo que passasse pelo CORS.

### A2 · WebSocket aceitava qualquer origem

`@WebSocketGateway({ cors: { origin: '*' } })`. A identidade já estava protegida (o evento
`identificar` exige token assinado), mas a porta aberta deixava qualquer site conectar e
receber os eventos públicos das mesas. Agora usa a mesma lista da API.

### A3 · Nenhum limite de tentativas

**Não existia limite em rota nenhuma**, e a de login também não. Com scrypt no meio, cada
tentativa custa caro **ao servidor** — é para isso que scrypt é lento —, então o mesmo laço
que testa senhas também derruba a máquina. Duas portas pelo preço de uma.

**Correção:** `comum/limite-de-tentativas.ts`, janela deslizante por chave.

| Rota | Limite | Também por |
|---|---|---|
| `POST /auth/entrar` | 10 em 5 min | **e-mail** |
| `POST /auth/cadastrar` | 5 em 1 h | — |
| `POST /auth/entrar-com-provedor` | 20 em 5 min | — |

**Por IP *e* por e-mail** porque IP não é pessoa: quem ataca uma conta específica troca de
IP, e quem varre muitas contas troca de e-mail. Os dois juntos fecham os dois caminhos.

**O limite roda ANTES da autenticação** (ordem dos `APP_GUARD`). Ao contrário, cada
tentativa errada ainda pagaria o scrypt inteiro antes de ser recusada — exatamente o custo
que o atacante quer impor.

Medido, com o servidor no ar: dez `401`, depois `429`.

### A4 · Token sem pinagem de algoritmo

`jwt.verify(token, segredo)` sem `algorithms` aceita o que o **próprio token** declarar no
cabeçalho — a porta clássica de confusão de algoritmo. Agora `['HS256']` na verificação e
na assinatura. Uma linha, uma classe inteira de ataque fechada.

### A5 · Sem cabeçalhos de segurança

Cinco cabeçalhos escritos à mão em `main.ts`, em vez de trazer o helmet: são cinco linhas
contra uma dependência nova, e cada uma com um motivo que dá para explicar — melhor que um
pacote cujo padrão ninguém leu.

`nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy: no-referrer` ·
`Cross-Origin-Resource-Policy: same-site` · HSTS **só em produção** (ligá-lo em
desenvolvimento trancaria `localhost` no HTTPS).

### A6 · Corpo sem teto explícito

O padrão do Express é 100 KB. Este servidor não recebe nada grande — a maior requisição é
uma lista de apostas de roleta —, então **64 KB**: folgado para o uso real e estreito para
quem tentar entupir a memória.

### A7 · Origem recusada devolvia 500

O `Error` cru do callback de CORS virava 500. Uma regra funcionando parecia servidor
quebrado, enchia o registro de erro falso e escondia um 500 de verdade no meio. Agora
`ForbiddenException` → **403**, que é o que a situação é: entendido e recusado.

---

## O que fica em aberto, e por quê

### B1 · Sessão de 30 dias sem revogação — **média**

`VALIDADE_TOKEN = '30d'` e não existe lista de revogação. Consequências:

- perder o aparelho significa uma sessão válida por até 30 dias na mão de quem o achou;
- "sair de todos os aparelhos" não existe;
- trocar a senha **não invalida** as sessões abertas.

**O que resolve, sem inventar infraestrutura:** um `token_version` inteiro na tabela
`users`, incluído no token e conferido na verificação. Trocar a senha (ou pedir "sair de
todos") incrementa o número e todo token antigo passa a falhar. É uma coluna, um campo no
payload e uma comparação — e não precisa de Redis nem de lista de bloqueio.

**Por que não entrou agora:** mexe no formato do token, o que invalida todas as sessões
abertas no momento da publicação. É uma decisão de produto sobre *quando* fazer, não sobre
*se* fazer. Recomendo fazer antes do primeiro público de verdade, quando o custo é zero.

### B2 · Sem `ValidationPipe` global — **média**

As classes de DTO (`class NewMatchDto { buyIn!: number }`) **não são validadas por nada**:
sem `ValidationPipe` e sem `class-validator`, elas são só tipagem, que desaparece na
compilação. A validação existe e é manual, rota a rota (`if (typeof body.buyIn !== 'number')`).

Isso **não é uma vulnerabilidade aberta hoje**: as rotas que mexem em dinheiro conferem à
mão, e as regras de economia (`problemaComAAposta`, `problemaComAEntrada`) recusam valor
inválido de qualquer jeito. O risco é de **erosão**: a rota nova que esquecer de conferir
não vai falhar em lugar nenhum, e a classe de DTO ao lado dá a impressão de que alguém já
validou.

**O que resolve:** `class-validator` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`
global. O `whitelist` é a parte que mais importa: ele descarta campo que o DTO não declara,
o que fecha a família inteira de ataque de "mandar um campo a mais e ver o que acontece".

**Por que não entrou agora:** é uma dependência nova e toca as ~40 rotas existentes de uma
vez; feito às pressas junto com o resto, o risco de quebrar uma rota em silêncio é maior
que o risco que ele fecha. Fica como o próximo item de segurança, com escopo próprio.

### B3 · Limite de tentativas é por processo — **baixa, e documentado no código**

A janela vive na memória do processo. Com duas instâncias atrás de um balanceador, o limite
efetivo dobra. Para **uma** instância — o caso de hoje — ele vale exatamente o que promete.
Para várias, o lugar certo é um contador compartilhado (Redis) ou o próprio balanceador.

Está escrito no cabeçalho de `limite-de-tentativas.ts` para que ninguém descubra por
acidente. E o mapa **se limpa sozinho**, com teto de chaves: sem isso, quem trocasse de IP
a cada pedido faria a memória crescer até o processo morrer — o limitador viraria a
vulnerabilidade.

---

## A conferência

`npm run verify:seguranca` — 7 blocos, sem precisar de rede:

1. **CORS**: a lista recusa origem de fora, subdomínio parecido e `http` onde se espera
   `https`; aceita a da lista e o pedido sem `Origin`; não aceita credenciais.
2. **Registro**: as chaves proibidas estão na lista, e JWT e chave privada são escondidos
   **por formato** — porque o nome do campo nem sempre denuncia (um token dentro de
   `{ dados: 'eyJhbGci...' }` passaria por qualquer lista de nomes).
3. **SQL**: nenhuma consulta interpola **valor** dentro do SQL. Duas formas de interpolação
   são aceitas por serem seguras e usadas aqui — uma constante em maiúsculas do módulo, e
   um ternário entre dois literais, que escolhe a *forma* da consulta e não o valor.
4. **Segredos**: nenhum literal no código; o servidor não sobe sem `JWT_SECRET`.
5. **Rotas abertas**: a lista de arquivos com `@Publico()` é o combinado, e qualquer coisa
   fora dela reprova — para que uma rota pública nova seja uma decisão e não um
   copiar-e-colar. (Procura o **decorador**, não a palavra: ela aparece em comentário.)
6. **Sessão**: algoritmo fixado na verificação e na assinatura, prazo, scrypt com sal,
   comparação em tempo constante, `userId` do token e não do corpo, socket sem `origin: '*'`.
7. **Limite**: as três portas caras têm limite, o do login conta por e-mail, o limite roda
   antes da autenticação, o corpo tem teto nos **dois** analisadores, e os cabeçalhos estão
   postos.

**Oito mutações deliberadas, oito pegas.** Uma delas achou um buraco na própria
conferência: a versão inicial do teto de corpo procurava `useBodyParser` e `64kb` em
qualquer lugar do arquivo e **passava com um dos dois analisadores solto**. Foi apertada
para exigir os dois.

---

## O que continua fora do alcance desta auditoria

- **Teste de invasão** de verdade, com a rede no ar.
- **Revisão da infraestrutura**: TLS, firewall, quem tem acesso ao banco em produção,
  rotação de segredo.
- **A chave de serviço do Firebase que precisa ser revogada** — está em
  `docs/como-ligar-o-firebase.md`, parte 7, e continua pendente do lado do dono da conta.
  Nenhuma mudança de código substitui essa revogação.
