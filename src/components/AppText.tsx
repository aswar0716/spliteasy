import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { Colors, FontSize, FontWeight } from '../theme';

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label' | 'mono';

const variantStyles: Record<Variant, TextStyle> = {
  h1: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  h2: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  h3: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  body: { fontSize: FontSize.md, fontWeight: FontWeight.regular, color: Colors.textPrimary },
  bodySmall: { fontSize: FontSize.sm, fontWeight: FontWeight.regular, color: Colors.textSecondary },
  caption: { fontSize: FontSize.xs, fontWeight: FontWeight.regular, color: Colors.textMuted },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
  mono: { fontSize: FontSize.md, fontFamily: 'monospace', color: Colors.textPrimary },
};

type Props = {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
};

export default function AppText({ variant = 'body', color, style, children, numberOfLines }: Props) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[variantStyles[variant], color ? { color } : undefined, style]}
    >
      {children}
    </Text>
  );
}
