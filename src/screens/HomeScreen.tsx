import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { AppText, Card } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { history, friends } = useStore();
  const recentHistory = history.slice(0, 5);

  const totalSplits = history.length;
  const totalAmount = history.reduce((s, h) => s + h.grandTotal, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 40 }}>

        {/* Hero */}
        <View style={{ paddingTop: Spacing.md, gap: Spacing.xs }}>
          <AppText variant="h1">SplitEasy 💸</AppText>
          <AppText variant="bodySmall" style={{ color: Colors.textMuted }}>
            {friends.length} friend{friends.length !== 1 ? 's' : ''} · {totalSplits} split{totalSplits !== 1 ? 's' : ''} · ${totalAmount.toFixed(0)} tracked
          </AppText>
        </View>

        {/* Start Split CTA */}
        <Pressable
          onPress={() => navigation.navigate('Setup')}
          style={({ pressed }) => ({
            borderRadius: Radius.xl,
            overflow: 'hidden',
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <View style={{
            backgroundColor: Colors.primary,
            padding: Spacing.lg,
            borderRadius: Radius.xl,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
          }}>
            <View style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <AppText style={{ fontSize: 26 }}>➕</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.bold }}>
                Start a Split
              </AppText>
              <AppText style={{ color: 'rgba(255,255,255,0.75)', fontSize: FontSize.sm }}>
                Choose who's in, scan or add items
              </AppText>
            </View>
            <AppText style={{ color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xl }}>→</AppText>
          </View>
        </Pressable>

        {/* Quick stats */}
        {totalSplits > 0 && (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {[
              { label: 'Splits', value: String(totalSplits), icon: '🧾' },
              { label: 'Friends', value: String(friends.length), icon: '👥' },
              { label: 'Tracked', value: `$${totalAmount.toFixed(0)}`, icon: '💰' },
            ].map(stat => (
              <Card key={stat.label} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.md }}>
                <AppText style={{ fontSize: 20 }}>{stat.icon}</AppText>
                <AppText style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary }}>
                  {stat.value}
                </AppText>
                <AppText variant="caption">{stat.label}</AppText>
              </Card>
            ))}
          </View>
        )}

        {/* Recent history */}
        {recentHistory.length > 0 && (
          <View style={{ gap: Spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="label">Recent Splits</AppText>
              <Pressable onPress={() => navigation.navigate('History')}>
                <AppText style={{ color: Colors.primary, fontSize: FontSize.sm }}>See all →</AppText>
              </Pressable>
            </View>

            {recentHistory.map(entry => {
              const isWoolworths = entry.type === 'woolworths';
              const accent = isWoolworths ? Colors.info : Colors.orange;
              const myShare = entry.splits.find(s => s.friendId === 'me');

              return (
                <Card
                  key={entry.id}
                  variant="alt"
                  onPress={() => {
                    const result = {
                      type: entry.type, splits: entry.splits,
                      grandTotal: entry.grandTotal, session: { id: entry.id, date: entry.date },
                    };
                    navigation.navigate('Summary', { result: JSON.stringify(result), label: entry.label });
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                        <AppText style={{ fontSize: 14 }}>{isWoolworths ? '🛒' : '🍽️'}</AppText>
                        <AppText style={{ color: accent, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
                          {entry.label}
                        </AppText>
                      </View>
                      <AppText variant="caption">
                        {new Date(entry.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{entry.splits.length} {entry.splits.length === 1 ? 'person' : 'people'}
                      </AppText>
                      {/* Mini person chips */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                        {entry.splits.map(s => (
                          <View key={s.friendId} style={{
                            backgroundColor: Colors.surface, borderRadius: Radius.sm,
                            paddingHorizontal: Spacing.sm, paddingVertical: 2,
                          }}>
                            <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.xs }}>
                              {s.name === 'Me' ? 'You' : s.name}: ${s.total.toFixed(2)}
                            </AppText>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <AppText style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary }}>
                        ${entry.grandTotal.toFixed(2)}
                      </AppText>
                      {myShare && (
                        <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>
                          Your share: ${myShare.total.toFixed(2)}
                        </AppText>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Empty state */}
        {recentHistory.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.md }}>
            <AppText style={{ fontSize: 56 }}>🧾</AppText>
            <AppText variant="h3" style={{ textAlign: 'center' }}>No splits yet</AppText>
            <AppText variant="bodySmall" style={{ textAlign: 'center', color: Colors.textMuted }}>
              Hit "Start a Split" above to get going
            </AppText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
