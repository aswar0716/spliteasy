export const Colors = {
  // backgrounds
  bg: '#0F0F14',
  surface: '#1A1A24',
  card: '#22223A',
  cardAlt: '#1E1E2E',

  // accents
  primary: '#7B61FF',      // purple
  primaryLight: '#A594F9',
  success: '#4ADE80',      // green for savings
  warning: '#FACC15',      // yellow for fees
  danger: '#F87171',       // red for errors
  info: '#38BDF8',         // blue for woolworths mode
  orange: '#FB923C',       // restaurant/doordash mode

  // text
  textPrimary: '#F0F0FF',
  textSecondary: '#9090B0',
  textMuted: '#5A5A7A',

  // borders
  border: '#2E2E46',
  borderLight: '#3A3A56',

  // friend avatar colors
  friendColors: [
    '#7B61FF', '#4ADE80', '#FB923C', '#38BDF8',
    '#F472B6', '#FACC15', '#34D399', '#F87171',
  ],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
