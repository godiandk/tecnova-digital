import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { diaDoServidor } from '../../comum/dia-do-servidor';
import { CONFIGURACAO_DO_CODIGO, type ConfiguracaoDaRecompensa } from './calendario';
import { registro } from '../../observabilidade/registro';

/**
 * A CONFIGURAÇÃO DA RECOMPENSA QUE ESTÁ EM VIGOR HOJE.
 *
 * O ESQUEMA JÁ PROMETIA ISTO e ninguém cumpria. O comentário de
 * `daily_reward_config` diz, com todas as letras, que a tabela "existe pra dar pra
 * corrigir um número sem soltar versão nova do servidor" — e a tabela existia, vazia, sem
 * uma única linha de código que a lesse. Promessa escrita no banco e não cumprida no
 * código é pior que promessa nenhuma: alguém um dia insere a linha, vê que nada muda, e
 * não tem como saber se errou a linha ou se a leitura não existe.
 *
 * A REGRA, que é a do próprio esquema: vale a linha de MAIOR `versao` entre as que já
 * começaram (`valida_de <= hoje`). Sem linha, valem os valores do código — que são os
 * aprovados em `docs/economia.md`, e continuam sendo o padrão de propósito: o banco
 * CORRIGE; ele não é onde os números moram escondidos de quem lê a regra.
 *
 * NUNCA `CURRENT_DATE`: o dia é o do servidor (`comum/dia-do-servidor.ts`), a mesma régua
 * de tudo que conta dia neste projeto.
 */
@Injectable()
export class ConfiguracaoEmVigor {
  constructor(private readonly db: DatabaseService) {}

  async de(dia = diaDoServidor()): Promise<ConfiguracaoDaRecompensa> {
    let linha: LinhaDaConfiguracao | undefined;
    try {
      linha = await this.db.queryOne<LinhaDaConfiguracao>(
        `SELECT ancora, marcos, marco_fim_mes, teto_do_bonus
           FROM daily_reward_config
          WHERE valida_de <= $1::date
          ORDER BY versao DESC
          LIMIT 1`,
        [dia],
      );
    } catch (erro) {
      /*
       * BANCO FORA DO AR NÃO PODE TIRAR A RECOMPENSA DO AR. Sem a linha, os valores do
       * código valem — e eles são os aprovados. Cair pro padrão é a resposta certa aqui,
       * não um erro que sobe.
       */
      registro.erro('recompensa', 'não deu pra ler a configuração em vigor', {
        erro: (erro as Error).message,
      });
      return CONFIGURACAO_DO_CODIGO;
    }
    if (!linha) return CONFIGURACAO_DO_CODIGO;

    /*
     * UMA LINHA QUEBRADA TAMBÉM CAI PRO PADRÃO, e com registro.
     *
     * `marcos` é JSONB: nada impede alguém de gravar `{"sete": "muito"}`. Uma recompensa
     * que paga `NaN` é pior que uma recompensa desatualizada, e o padrão está sempre
     * disponível — então o valor inválido é descartado, dito em voz alta, e a casa
     * continua pagando o que a regra publicada diz.
     */
    const config = {
      ancora: Number(linha.ancora),
      marcos: marcosValidos(linha.marcos),
      marcoDoFimDoMes: Number(linha.marco_fim_mes),
      tetoDoBonus: Number(linha.teto_do_bonus),
    };
    const problema = oQueHaDeErrado(config);
    if (problema) {
      registro.erro('recompensa', 'a configuração no banco está inválida — vale a do código', {
        problema,
        dia,
      });
      return CONFIGURACAO_DO_CODIGO;
    }
    return config;
  }
}

interface LinhaDaConfiguracao {
  ancora: number | string;
  marcos: unknown;
  marco_fim_mes: number | string;
  teto_do_bonus: number | string;
}

/** Só os pares dia→múltiplo que são dois números positivos. O resto é descartado. */
function marcosValidos(bruto: unknown): Record<number, number> {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
  const limpos: Record<number, number> = {};
  for (const [chave, valor] of Object.entries(bruto as Record<string, unknown>)) {
    const dia = Number(chave);
    const multiplo = Number(valor);
    if (Number.isInteger(dia) && dia >= 1 && dia <= 31 && Number.isFinite(multiplo) && multiplo > 0) {
      limpos[dia] = multiplo;
    }
  }
  return limpos;
}

/** O que impede esta configuração de pagar, ou `null` quando ela serve. */
function oQueHaDeErrado(config: ConfiguracaoDaRecompensa): string | null {
  if (!Number.isSafeInteger(config.ancora) || config.ancora <= 0) return `âncora ${config.ancora}`;
  if (!Number.isFinite(config.marcoDoFimDoMes) || config.marcoDoFimDoMes <= 0) {
    return `marco de fim de mês ${config.marcoDoFimDoMes}`;
  }
  if (!Number.isFinite(config.tetoDoBonus) || config.tetoDoBonus < 1) {
    return `teto do bônus ${config.tetoDoBonus}`;
  }
  return null;
}
