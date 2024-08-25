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
