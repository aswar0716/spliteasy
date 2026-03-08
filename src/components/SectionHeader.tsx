import React from 'react';
import { View } from 'react-native';
import AppText from './AppText';
import { Spacing } from '../theme';

type Props = {
  title: string;
  right?: React.ReactNode;
};

export default function SectionHeader({ title, right }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
      <AppText variant="label">{title}</AppText>
      {right}
    </View>
  );
}
