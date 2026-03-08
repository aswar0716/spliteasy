import React from 'react';
import { Pressable, View, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import AppText from './AppText';
import { Colors, Radius, Spacing, FontSize, FontWeight } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

const variantMap: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: Colors.primary, text: '#fff' },
  secondary: { bg: Colors.card, text: Colors.textPrimary, border: Colors.borderLight },
  danger: { bg: Colors.danger, text: '#fff' },
  ghost: { bg: 'transparent', text: Colors.primary, border: Colors.primary },
  success: { bg: Colors.success, text: '#000' },
};

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

export default function PillButton({
  label, onPress, variant = 'primary', style, loading, disabled, icon, size = 'md',
}: Props) {
  const v = variantMap[variant];
  const paddingV = size === 'sm' ? Spacing.xs : size === 'lg' ? Spacing.md : Spacing.sm;
  const paddingH = size === 'sm' ? Spacing.sm : size === 'lg' ? Spacing.xl : Spacing.md;
  const fs = size === 'sm' ? FontSize.sm : size === 'lg' ? FontSize.lg : FontSize.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          borderRadius: Radius.full,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: pressed || disabled ? 0.7 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.xs,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <AppText style={{ color: v.text, fontSize: fs, fontWeight: FontWeight.semibold }}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}
