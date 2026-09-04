/**
 * A conferência de idade.
 *
 * DEZOITO ANOS É EXIGÊNCIA, não escolha de produto. Um aplicativo com mesa de aposta —
 * mesmo com ficha que não vira dinheiro — é classificado como conteúdo adulto pela App
 * Store e pelo Google Play, e um cadastro que não pergunta a idade não passa na revisão
 * dos dois. Fora isso, é o mínimo decente: jogo de azar não é lugar de criança, e "ficha
 * de mentira" não muda o hábito que se aprende.
 *
 * A DATA É GUARDADA, A IDADE É CALCULADA. Guardar "tem 24 anos" seria guardar um número
 * que fica errado sozinho no aniversário seguinte. Guardando a data, a idade é sempre a
 * de hoje.
 *
 * E A CONTA É FEITA NO SERVIDOR. Se o aplicativo calculasse, bastaria mudar o relógio do
 * telefone — ou mandar outro número na requisição. O aplicativo mostra o aviso antes pra
 * a pessoa não preencher o resto à toa; quem recusa é aqui.
 */
export const IDADE_MINIMA = 18;

/** Idade em anos completos, na data de hoje. */
export function idadeEm(nascimento: Date, hoje = new Date()): number {
  let anos = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const mes = hoje.getUTCMonth() - nascimento.getUTCMonth();
  const dia = hoje.getUTCDate() - nascimento.getUTCDate();
  // Ainda não fez aniversário este ano: tira um.
  if (mes < 0 || (mes === 0 && dia < 0)) anos -= 1;
  return anos;
}

/**
 * Lê uma data de nascimento vinda da rede, ou devolve o motivo de não servir.
 *
 * Aceita só o formato `AAAA-MM-DD`. Aceitar "10/03/1990" traria a pergunta insolúvel de
 * ser 10 de março ou 3 de outubro, e a resposta errada muda a idade de alguém em meses.
 */
export function lerNascimento(valor: unknown): { data: Date } | { erro: string } {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return { erro: 'Informe a data de nascimento no formato AAAA-MM-DD.' };
  }

  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return { erro: 'Essa data não existe.' };
  // `new Date` aceita 31 de fevereiro e escorrega pra 3 de março; comparar de volta pega isso.
  if (data.toISOString().slice(0, 10) !== valor) return { erro: 'Essa data não existe.' };

  const hoje = new Date();
  if (data.getTime() > hoje.getTime()) return { erro: 'A data de nascimento não pode ser no futuro.' };

  const anos = idadeEm(data, hoje);
  if (anos > 120) return { erro: 'Confira a data de nascimento.' };
  if (anos < IDADE_MINIMA) {
    return { erro: `É preciso ter ${IDADE_MINIMA} anos ou mais pra criar uma conta aqui.` };
  }

  return { data };
}
