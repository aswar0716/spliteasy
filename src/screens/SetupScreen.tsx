import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export default function SetupScreen() {
  const navigation = useNavigation<any>();
  const { friends } = useStore();

  const [participants, setParticipants] = useState<string[]>([]);

  const toggleFriend = (id: string) => {
    setParticipants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const meColor = Colors.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 100 }}>

        <View style={{ paddingTop: Spacing.sm }}>
          <AppText variant="h2">New Split</AppText>
          <AppText variant="bodySmall" style={{ marginTop: 4 }}>
            Choose who's splitting this bill
          </AppText>
        </View>

        <Card>
          <SectionHeader title="Who's splitting?" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>

            {/* Me — always included */}
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

            {friends.map(f => {
              const selected = participants.includes(f.id);
              const initials = f.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
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

        <PillButton
          label="Continue →"
          onPress={() => navigation.navigate('BillEntry', { participants, billType: 'universal' })}
          size="lg"
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
