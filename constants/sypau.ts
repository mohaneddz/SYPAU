/**
 * SYPAU identity tokens, derived from the reference screens in `design/`.
 *
 * Colours were sampled from those images: the artwork is textured, so the
 * sampled values read darker than the intended flat colour. The tokens below
 * are the flat colours the textures were painted over — textures are applied
 * as overlays on top, not baked into these.
 */

export const SypauColor = {
  /** Page background. Near-black, never pure #000 except behind the nav. */
  ink: '#0D0D0D',
  inkDeep: '#070707',
  /** Thin outlined dark cards. */
  surface: '#141414',
  surfaceRaised: '#1A1A1A',
  hairline: '#2A2A2A',

  /** Torn-paper card stock. */
  paper: '#DDD9D6',
  paperEdge: '#C4BFBA',
  paperInk: '#141412',

  /** Off-white type. Deliberately not pure white. */
  bone: '#ECEAE6',
  boneMuted: '#9C9894',
  boneFaint: '#6B6865',

  /** SYPAU red: identity, destructive actions, the centre button. */
  red: '#C81E1E',
  redBright: '#E23A3A',
  redDeep: '#8B1414',

  /** Geolocation cyan: boundaries, the live position, "inside" states. */
  cyan: '#45C7C4',
  cyanDim: '#2E8C8A',
  cyanFill: 'rgba(69, 199, 196, 0.28)',

  /** Status. */
  green: '#4ADE80',
  amber: '#F5A623',
} as const;

/**
 * Anton stands in for the condensed poster face on SYPAU/MY ZONES/GPS DEBUG,
 * Caveat for the hand-drawn taglines, Oswald for labels and nav, Inter for
 * body copy. All four are OFL-licensed.
 */
export const SypauFont = {
  display: 'Anton_400Regular',
  label: 'Oswald_500Medium',
  labelBold: 'Oswald_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
  hand: 'Caveat_700Bold',
} as const;

export const SypauType = {
  /** Screen titles: MY ZONES, GPS DEBUG. */
  display: { fontFamily: SypauFont.display, fontSize: 44, lineHeight: 46, letterSpacing: 0.5 },
  displaySm: { fontFamily: SypauFont.display, fontSize: 32, lineHeight: 34, letterSpacing: 0.5 },
  /** The huge ACTIVE on the home hero. */
  hero: { fontFamily: SypauFont.display, fontSize: 52, lineHeight: 54, letterSpacing: 1 },
  /** Card titles: HOME, CAMPUS. */
  cardTitle: { fontFamily: SypauFont.labelBold, fontSize: 22, lineHeight: 26, letterSpacing: 1.2 },
  /** Section headers: CONTROL, DATA, PREFERENCES. */
  section: { fontFamily: SypauFont.label, fontSize: 12, lineHeight: 16, letterSpacing: 3 },
  /** Row labels and nav. */
  label: { fontFamily: SypauFont.label, fontSize: 14, lineHeight: 18, letterSpacing: 1 },
  labelSm: { fontFamily: SypauFont.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  body: { fontFamily: SypauFont.body, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: SypauFont.body, fontSize: 13, lineHeight: 18 },
  /** Handwritten accents: taglines, "YOU ARE INSIDE THIS ZONE". */
  hand: { fontFamily: SypauFont.hand, fontSize: 22, lineHeight: 26 },
  handSm: { fontFamily: SypauFont.hand, fontSize: 17, lineHeight: 20 },
  mono: { fontFamily: 'monospace', fontSize: 13, lineHeight: 18 },
} as const;

export const SypauSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** Horizontal page gutter. */
  gutter: 18,
} as const;

export const SypauRadius = {
  card: 10,
  chip: 6,
  button: 8,
  pill: 999,
} as const;

export const SypauMotion = {
  coverFadeMs: 900,
  coverHoldMs: 1200,
  pulseMs: 2200,
  transitionMs: 260,
} as const;

export const SypauAsset = {
  emblem: require('@/assets/brand/icon_no_bg.webp'),
  cover: require('@/assets/brand/cover.webp'),
  navbarTop: require('@/assets/brand/navbar-top.webp'),
  foldedMap: require('@/assets/brand/map.webp'),
} as const;

export const SypauTexture = {
  /** Tileable speckle laid over dark surfaces at low opacity. */
  grain: require('@/assets/brand/grain.png'),
  /** Coarser fibre for torn-paper card stock. */
  paperGrain: require('@/assets/brand/paper-grain.png'),
} as const;
