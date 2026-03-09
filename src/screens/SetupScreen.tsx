import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

type BillType = 'woolworths' | 'restaurant';

export default function SetupScreen() {
  const navigation = useNavigation<any>();
  const { friends } = useStore();

  const [participants, setParticipants] = useState<string[]>([]);
  const [billType, setBillType] = useState<BillType>('woolworths');

  const toggleFriend = (id: string) => {
    setParticipants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleNext = () => {
    navigation.navigate('BillEntry', { participants, billType });
  };

  const meColor = Colors.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 100 }}>

        <View style={{ paddingTop: Spacing.sm }}>
          <AppText variant="h2">New Split</AppText>
          <AppText variant="bodySmall" style={{ marginTop: 4 }}>Set up who's in and what type of bill</AppText>
        </View>

        {/* Who's splitting */}
        <Card>
          <SectionHeader title="Who's splitting?" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>

            {/* Me — always shown, always included */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
              paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
              borderRadius: Radius.full, borderWidth: 1.5,
              borderColor: meColor, backgroundColor: meColor + '22',
            }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: meColor, alignItems: 'center', justifyContent: 'center',
              }}>
                <AppText style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold }}>ME</AppText>
              </View>
              <AppText style={{ color: meColor, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
                You
              </AppText>
            </View>

            {/* Friends */}
            {friends.map(f => {
              const selected = participants.includes(f.id);
              const initials = f.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggleFriend(f.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
                    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
                    borderRadius: Radius.full, borderWidth: 1.5,
                    borderColor: selected ? f.color : Colors.border,
                    backgroundColor: selected ? f.color + '22' : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: selected ? f.color : Colors.surface,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AppText style={{
                      color: selected ? '#fff' : Colors.textMuted,
                      fontSize: FontSize.xs, fontWeight: FontWeight.bold,
                    }}>{initials}</AppText>
                  </View>
                  <AppText style={{
                    color: selected ? f.color : Colors.textSecondary,
                    fontWeight: selected ? FontWeight.semibold : FontWeight.regular,
                    fontSize: FontSize.sm,
                  }}>{f.name}</AppText>
                </Pressable>
              );
            })}

            {friends.length === 0 && (
              <AppText variant="bodySmall" style={{ color: Colors.textMuted }}>
                No friends yet — go to Friends tab to add some
              </AppText>
            )}
          </View>
        </Card>

        {/* Bill type */}
        <Card>
          <SectionHeader title="Type of bill" />
          <View style={{ gap: Spacing.sm }}>
            {([
              { type: 'woolworths', icon: '🛒', label: 'Woolworths', sub: 'Store & product discounts, vouchers', accent: Colors.info },
              { type: 'restaurant', icon: '🍽️', label: 'Restaurant / DoorDash', sub: 'Proportional delivery & service fees', accent: Colors.orange },
            ] as const).map(opt => (
              <Pressable
                key={opt.type}
                onPress={() => setBillType(opt.type)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                  padding: Spacing.md, borderRadius: Radius.lg,
                  borderWidth: 1.5,
                  borderColor: billType === opt.type ? opt.accent : Colors.border,
                  backgroundColor: billType === opt.type ? opt.accent + '15' : Colors.cardAlt,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <AppText style={{ fontSize: 28 }}>{opt.icon}</AppText>
                <View style={{ flex: 1 }}>
                  <AppText style={{
                    color: billType === opt.type ? opt.accent : Colors.textPrimary,
                    fontWeight: FontWeight.semibold, fontSize: FontSize.md,
                  }}>{opt.label}</AppText>
                  <AppText variant="bodySmall">{opt.sub}</AppText>
                </View>
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  borderWidth: 2, borderColor: billType === opt.type ? opt.accent : Colors.border,
                  backgroundColor: billType === opt.type ? opt.accent : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {billType === opt.type && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </Card>

        <PillButton
          label={`Continue →`}
          onPress={handleNext}
          size="lg"
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
