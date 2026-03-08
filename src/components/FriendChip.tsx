import React from 'react';
import { Pressable, View } from 'react-native';
import AppText from './AppText';
import { Colors, Radius, Spacing, FontSize, FontWeight } from '../theme';

type Props = {
  name: string;
  color: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
};

export default function FriendChip({ name, color, selected = false, onPress, size = 'md' }: Props) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarSize = size === 'sm' ? 26 : 32;
  const fs = size === 'sm' ? FontSize.xs : FontSize.sm;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.xs,
        paddingHorizontal: size === 'sm' ? Spacing.sm : Spacing.md,
        borderRadius: Radius.full,
        borderWidth: 1.5,
        borderColor: selected ? color : Colors.border,
        backgroundColor: selected ? color + '22' : 'transparent',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText style={{ color: '#fff', fontSize: fs, fontWeight: FontWeight.bold }}>
          {initials}
        </AppText>
      </View>
      <AppText
        style={{
          color: selected ? color : Colors.textSecondary,
          fontSize: fs,
          fontWeight: selected ? FontWeight.semibold : FontWeight.regular,
        }}
      >
        {name}
      </AppText>
    </Pressable>
  );
}
