import React from 'react';
import { View } from 'react-native';
import AppText from './AppText';
import { Colors, Spacing } from '../theme';

type Props = {
  icon: string;
  title: string;
  subtitle?: string;
};

export default function EmptyState({ icon, title, subtitle }: Props) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm }}>
      <AppText style={{ fontSize: 48 }}>{icon}</AppText>
      <AppText variant="h3" style={{ textAlign: 'center' }}>{title}</AppText>
      {subtitle && (
        <AppText variant="bodySmall" style={{ textAlign: 'center', color: Colors.textMuted }}>{subtitle}</AppText>
      )}
    </View>
  );
}
