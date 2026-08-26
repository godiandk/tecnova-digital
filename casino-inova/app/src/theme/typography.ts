/**
 * Poppins (ExtraBold/Bold) para títulos e qualquer coisa "de marca" — geométrica e
 * confiante, como o logotipo. Inter para texto de corpo e números — precisa continuar
 * legível em telas pequenas com muito HUD (saldo, apostas, ranking).
 */
export const fontFamily = {
  displayExtraBold: 'Poppins_800ExtraBold',
  displayBold: 'Poppins_700Bold',
  displaySemiBold: 'Poppins_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  xxl: 34,
} as const;

export const typeScale = {
  hero: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xxl, lineHeight: 38 },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, lineHeight: 30 },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  cardTitle: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, lineHeight: 22 },
  body: { fontFamily: fontFamily.body, fontSize: fontSize.base, lineHeight: 21 },
  bodyStrong: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, lineHeight: 21 },
  caption: { fontFamily: fontFamily.body, fontSize: fontSize.sm, lineHeight: 17 },
  numeric: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, lineHeight: 20 },
};
