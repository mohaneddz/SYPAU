/** "Silence Origami" identity tokens — see .idea/plan.md §8 and .idea/design-guide.png. */
export const Prism = {
  inkBlack: '#05060A',
  deepCharcoal: '#0D111C',
  paperShadow: '#141A2B',
  ashPaper: '#E9ECF2',
  warmPaper: '#F4F1EA',
  cyan: '#34F6D3',
  violet: '#7B5CFF',
  amber: '#FFB86B',
} as const;

export const EDGE_COLOR_HEX: Record<'cyan' | 'violet' | 'amber', string> = {
  cyan: Prism.cyan,
  violet: Prism.violet,
  amber: Prism.amber,
};

export const PrismType = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: 1 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.2 },
};

export const PrismRadii = {
  card: 22,
  button: 18,
  commandRing: 28,
};

export const PrismMotion = {
  breatheMs: 2400,
  enterSweepMs: 600,
  exitDissolveMs: 450,
};
