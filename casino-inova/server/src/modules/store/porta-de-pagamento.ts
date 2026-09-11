/**
 * A PORTA DE PAGAMENTO — por onde o dinheiro entra, seja qual for o caminho.
 *
 * POR QUE UMA PORTA E NÃO QUATRO INTEGRAÇÕES SOLTAS. O produto pediu Pix, Apple Pay,
 * Google Pay e cartão. São quatro caminhos com regras próprias, mas o que o resto do
 * sistema precisa saber é sempre o mesmo: *entrou dinheiro de fulano, referente ao pacote
 * tal, e este é o identificador único desse evento*. Sem uma porta, cada integração
 * acabaria creditando ficha do seu jeito — e "creditar ficha" é o único lugar do sistema
 * onde um erro cria dinheiro do nada.
 *
 * A REGRA QUE ATRAVESSA TODAS: O SERVIDOR NUNCA ACREDITA NO CLIENTE. Nenhuma
 * implementação pode aceitar "paguei, pode creditar" vindo do aplicativo. O que vale é a
 * confirmação do provedor, conferida por assinatura (HMAC, certificado, ou consulta de
 * volta à API dele). O aplicativo só inicia a compra; quem diz que ela aconteceu é quem
 * recebeu o dinheiro.
 *
 * E O VALOR DAS FICHAS NUNCA VEM DO EVENTO. O provedor diz QUAL PACOTE foi comprado; a
 * quantidade de fichas é calculada aqui, a partir do degrau e do nível de quem comprou.
 * Aceitar um `chips` vindo de fora seria aceitar um valor calculado do lado de lá — que é
 * exatamente a porta que este projeto fecha em todo lugar.
 *
 * O ESTADO DE HOJE, dito sem maquiagem:
 *
 *   revenuecat — implementado e no ar. Cobre Apple Pay e Google Pay, porque nas lojas de
 *                aplicativo a compra de ficha é compra dentro do aplicativo e TEM que
 *                passar por elas. A RevenueCat valida o recibo com a loja e chama o
 *                webhook, que confere o HMAC.
 *   pix        — a porta existe, a implementação NÃO. Pix não passa pela loja de
 *                aplicativo (é pagamento fora dela), então precisa de um adquirente e de
 *                uma decisão sobre as regras da Apple para bens digitais. Está declarado
 *                aqui para que o dia em que existir não vire uma quinta forma de creditar
 *                ficha escrita num canto.
 *   cartao     — mesma situação do Pix.
 *
 * NADA DE NFT NEM CRIPTO, por decisão de produto registrada. Não há porta prevista, e
 * acrescentar uma seria mudar a decisão, não estender a arquitetura.
 */

/** Os caminhos pelos quais dinheiro pode entrar. */
export const PORTAS = ['revenuecat', 'pix', 'cartao'] as const;
export type NomeDaPorta = (typeof PORTAS)[number];

/**
 * O que toda porta entrega ao resto do sistema quando um pagamento é confirmado.
 *
 * Note o que NÃO está aqui: a quantidade de fichas. Ela é calculada pelo servidor a partir
 * do pacote, do degrau e do nível — nunca lida do evento.
 */
export interface PagamentoConfirmado {
  /**
   * O identificador do evento NO PROVEDOR. É a chave de idempotência, e é por ela que uma
   * reentrega (normal quando o provedor não recebe o 200) não credita duas vezes.
   */
  eventoId: string;
  userId: string;
  pacoteId: string;
  /** Quanto foi cobrado, em centavos inteiros, e em qual moeda. Para o registro. */
  precoEmCentavos: number;
  moeda: string;
  porta: NomeDaPorta;
}

/** Um estorno confirmado pelo provedor. */
export interface EstornoConfirmado {
  eventoId: string;
  userId: string;
  porta: NomeDaPorta;
}

export type EventoDePagamento =
  | { tipo: 'compra'; dados: PagamentoConfirmado }
  | { tipo: 'estorno'; dados: EstornoConfirmado }
  | { tipo: 'ignorado'; porque: string };

/**
 * Uma porta de pagamento.
 *
 * `interpretar` recebe o corpo e os cabeçalhos crus do webhook e devolve o que aconteceu —
 * ou lança, se a assinatura não conferir. É ela que contém tudo que é específico do
 * provedor, e é por isso que a interface é pequena: o que sai daqui já é a linguagem do
 * sistema, não a do provedor.
 */
export interface PortaDePagamento {
  readonly nome: NomeDaPorta;
  /** Está configurada neste servidor? Sem segredo, a porta não abre. */
  configurada(): boolean;
  interpretar(corpo: unknown, cabecalhos: Record<string, string | undefined>): EventoDePagamento;
}
