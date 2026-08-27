import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BeadCell, BigRoadCell, DerivedMark, Roadmap } from '../api/roadmap';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

/**
 * Placar de histórico da mesa — as cinco estradas do bacará/bac bo.
 *
 * Os marcadores são desenhados aqui em View/borda, não em imagem: eles mudam a cada
 * rodada e precisam ficar nítidos em qualquer tamanho de tela. A moldura de painel
 * (placar-painel-*.png) é o fundo, quando existir.
 *
 * Vale lembrar o que está escrito no servidor: o placar não prevê nada. Cada rodada é
 * independente. Ele existe porque é parte da mesa real e o jogador quer ver o
 * histórico — não como ferramenta de aposta.
 */

const CELL = 18;
const GAP = 2;
const ROWS = 6;

/** Convenção de cassino: banca é vermelha, jogador é azul, empate é verde. */
const OUTCOME_COLOR: Record<string, string> = {
  banca: colors.ruby,
  jogador: colors.sapphire,
  empate: colors.success,
};

function BeadPlate({ columns }: { columns: BeadCell[][] }) {
  return (
    <View style={styles.grid}>
      {columns.map((column, columnIndex) => (
        <View key={columnIndex} style={styles.column}>
          {Array.from({ length: ROWS }).map((_, rowIndex) => {
            const cell = column[rowIndex];
            return (
              <View key={rowIndex} style={styles.slot}>
                {cell && <View style={[styles.bead, { backgroundColor: OUTCOME_COLOR[cell.outcome] }]} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function BigRoad({ layout }: { layout: Roadmap['bigRoadLayout'] }) {
  // A cauda do dragão pode empurrar células pra colunas além do número de sequências.
  const columnCount = layout.reduce((max, item) => Math.max(max, item.column + 1), 0);
  const byPosition = new Map<string, BigRoadCell>();
  for (const item of layout) {
    byPosition.set(`${item.column}-${item.row}`, item.cell);
  }

  return (
    <View style={styles.grid}>
      {Array.from({ length: columnCount }).map((_, columnIndex) => (
        <View key={columnIndex} style={styles.column}>
          {Array.from({ length: ROWS }).map((_, rowIndex) => {
            const cell = byPosition.get(`${columnIndex}-${rowIndex}`);
            return (
              <View key={rowIndex} style={styles.slot}>
                {cell && (
                  <View style={[styles.ring, { borderColor: OUTCOME_COLOR[cell.outcome] }]}>
                    {/* Empate risca a célula — um traço verde por empate, até 2 pra não poluir. */}
                    {cell.ties > 0 && <View style={styles.tieSlash} />}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DerivedRoad({ columns }: { columns: DerivedMark[][] }) {
  return (
    <View style={styles.grid}>
      {columns.map((column, columnIndex) => (
        <View key={columnIndex} style={styles.column}>
          {Array.from({ length: ROWS }).map((_, rowIndex) => {
            const mark = column[rowIndex];
            return (
              <View key={rowIndex} style={styles.slotSmall}>
                {mark && (
                  <View
                    style={[
                      styles.derivedDot,
                      { borderColor: mark === 'vermelho' ? colors.ruby : colors.sapphire },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function RoadmapPanel({ roadmap }: { roadmap: Roadmap }) {
  const { totals } = roadmap;

  return (
    <View style={styles.panel}>
      <View style={styles.legend}>
        <Legend label="Banca" value={totals.banca} color={OUTCOME_COLOR.banca} />
        <Legend label="Jogador" value={totals.jogador} color={OUTCOME_COLOR.jogador} />
        <Legend label="Empate" value={totals.empate} color={OUTCOME_COLOR.empate} />
        <Legend label="Total" value={totals.total} color={colors.textFaint} />
      </View>

      <Text style={styles.roadLabel}>Histórico (bead plate)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BeadPlate columns={roadmap.beadPlate} />
      </ScrollView>

      <Text style={styles.roadLabel}>Big road</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BigRoad layout={roadmap.bigRoadLayout} />
      </ScrollView>

      <Text style={styles.roadLabel}>Tendência · vermelho repete, azul pica</Text>
      <View style={styles.derivedRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.derivedBox}>
          <DerivedRoad columns={roadmap.bigEyeBoy} />
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.derivedBox}>
          <DerivedRoad columns={roadmap.smallRoad} />
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.derivedBox}>
          <DerivedRoad columns={roadmap.cockroachPig} />
        </ScrollView>
      </View>

      <Text style={styles.disclaimer}>
        O placar mostra o que já saiu. Cada rodada é sorteada do zero — o histórico não muda a chance da próxima.
      </Text>
    </View>
  );
}

function Legend({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  legendValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.textPrimary },
  roadLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: spacing.xs,
  },
  grid: { flexDirection: 'row', gap: GAP },
  column: { gap: GAP },
  slot: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  slotSmall: { width: CELL * 0.6, height: CELL * 0.6, alignItems: 'center', justifyContent: 'center' },
  bead: { width: CELL - 4, height: CELL - 4, borderRadius: (CELL - 4) / 2 },
  ring: {
    width: CELL - 3,
    height: CELL - 3,
    borderRadius: (CELL - 3) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tieSlash: {
    position: 'absolute',
    width: CELL,
    height: 2,
    backgroundColor: colors.success,
    transform: [{ rotate: '-45deg' }],
  },
  derivedRow: { flexDirection: 'row', gap: spacing.xs },
  derivedBox: { flex: 1 },
  derivedDot: { width: CELL * 0.45, height: CELL * 0.45, borderRadius: CELL * 0.225, borderWidth: 1.5 },
  disclaimer: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});
