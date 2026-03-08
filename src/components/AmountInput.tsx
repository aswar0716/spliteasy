import React from 'react';
import { View, TextInput, StyleProp, ViewStyle } from 'react-native';
import AppText from './AppText';
import { Colors, Radius, Spacing, FontSize, FontWeight } from '../theme';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  label?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
};

export default function AmountInput({
  value, onChangeText, label, placeholder = '0.00', prefix = '$', suffix, style, autoFocus,
}: Props) {
  return (
    <View style={[{ gap: Spacing.xs }, style]}>
      {label && <AppText variant="label">{label}</AppText>}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: Colors.border,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          gap: Spacing.xs,
        }}
      >
        {prefix && (
          <AppText style={{ color: Colors.textMuted, fontSize: FontSize.lg, fontWeight: FontWeight.semibold }}>
            {prefix}
          </AppText>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          style={{
            flex: 1,
            color: Colors.textPrimary,
            fontSize: FontSize.lg,
            fontWeight: FontWeight.semibold,
            padding: 0,
          }}
        />
        {suffix && (
          <AppText style={{ color: Colors.textMuted, fontSize: FontSize.sm }}>{suffix}</AppText>
        )}
      </View>
    </View>
  );
}
