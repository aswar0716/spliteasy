import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { AppText, Card } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

type ModeCard = {
  label: string;
  subtitle: string;
  icon: string;
  screen: string;
  accent: string;
};

const modes: ModeCard[] = [
  {
    label: 'Woolworths',
    subtitle: 'Discounts, vouchers & item splits',
    icon: '🛒',
    screen: 'Woolworths',
    accent: Colors.info,
  },
  {
    label: 'Restaurant / DoorDash',
    subtitle: 'Proportional fees & shared items',
    icon: '🍽️',
    screen: 'Restaurant',
    accent: Colors.orange,
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { history, friends } = useStore();
  const recentHistory = history.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 40 }}>
        {/* Greeting */}
        <View style={{ paddingTop: Spacing.md, gap: Spacing.xs }}>
          <AppText variant="h1">SplitEasy 💸</AppText>
          <AppText variant="bodySmall">
            {friends.length > 0
              ? `${friends.length} friend${friends.length > 1 ? 's' : ''} · ${history.length} split${history.length !== 1 ? 's' : ''} done`
              : 'Start by adding your friends →'}
          </AppText>
        </View>

        {/* Mode cards */}
        <View style={{ gap: Spacing.sm }}>
          <AppText variant="label" style={{ marginBottom: Spacing.xs }}>New Split</AppText>
          {modes.map(mode => (
            <Pressable
              key={mode.screen}
              onPress={() => navigation.navigate(mode.screen)}
              style={({ pressed }) => ({
                backgroundColor: Colors.card,
                borderRadius: Radius.xl,
                padding: Spacing.lg,
                borderWidth: 1.5,
                borderColor: mode.accent + '66',
                opacity: pressed ? 0.8 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
              })}
            >
              <View style={{
                width: 56,
                height: 56,
                borderRadius: Radius.lg,
                backgroundColor: mode.accent + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <AppText style={{ fontSize: 28 }}>{mode.icon}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: mode.accent }}>
                  {mode.label}
                </AppText>
                <AppText variant="bodySmall">{mode.subtitle}</AppText>
              </View>
              <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xl }}>→</AppText>
            </Pressable>
          ))}
        </View>

        {/* Recent history */}
        {recentHistory.length > 0 && (
          <View style={{ gap: Spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="label">Recent</AppText>
              <Pressable onPress={() => navigation.navigate('History')}>
                <AppText style={{ color: Colors.primary, fontSize: FontSize.sm }}>See all</AppText>
              </Pressable>
            </View>
            {recentHistory.map(entry => {
              const isWoolworths = entry.type === 'woolworths';
              const accent = isWoolworths ? Colors.info : Colors.orange;
              return (
                <Card
                  key={entry.id}
                  variant="alt"
                  onPress={() => {
                    const result = {
                      type: entry.type,
                      splits: entry.splits,
                      grandTotal: entry.grandTotal,
                      session: { id: entry.id, date: entry.date },
                    };
                    navigation.navigate('Summary', { result: JSON.stringify(result), label: entry.label });
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontSize: FontSize.sm, color: accent, fontWeight: FontWeight.semibold }}>
                        {isWoolworths ? '🛒' : '🍽️'} {entry.label}
                      </AppText>
                      <AppText variant="caption">
                        {new Date(entry.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        {' · '}{entry.splits.length} people
                      </AppText>
                    </View>
                    <AppText style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary }}>
                      ${entry.grandTotal.toFixed(2)}
                    </AppText>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
