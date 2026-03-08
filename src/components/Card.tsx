import React from 'react';
import { View, ViewStyle, StyleProp, Pressable } from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'alt';
};

export default function Card({ children, style, onPress, variant = 'default' }: Props) {
  const bg = variant === 'alt' ? Colors.cardAlt : Colors.card;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            backgroundColor: bg,
            borderRadius: Radius.lg,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: pressed ? 0.8 : 1,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: Radius.lg,
          padding: Spacing.md,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
