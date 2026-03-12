import React from 'react';
import { View, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import { AppText, Card, EmptyState, SectionHeader } from '../../components';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../theme';
import { HistoryEntry } from '../../types';

function fmt(n: number) { return `$${n.toFixed(2)}`; }

function HistoryCard({ entry, onPress, onDelete }: {
  entry: HistoryEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  const accent = Colors.primary;
  const date = new Date(entry.date).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <Card onPress={onPress} variant="alt">
      <View style={{ gap: Spacing.sm }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={{
                backgroundColor: accent + '22',
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.sm,
                paddingVertical: 2,
              }}>
                <AppText style={{ color: accent, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                  💸 Split
                </AppText>
              </View>
            </View>
            <AppText variant="body" style={{ marginTop: 2 }}>{entry.label}</AppText>
            <AppText variant="caption">{date}</AppText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <AppText style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary }}>
              {fmt(entry.grandTotal)}
            </AppText>
            <Pressable onPress={onDelete}>
              <AppText style={{ color: Colors.danger, fontSize: FontSize.xs }}>Delete</AppText>
            </Pressable>
          </View>
        </View>

        {/* Mini split summary */}
        <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
            {entry.splits.map(s => (
              <View
                key={s.friendId}
                style={{
                  flexDirection: 'row',
                  gap: 4,
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.sm,
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: 3,
                }}
              >
                <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.xs }}>
                  {s.name === 'Me' ? 'You' : s.name}:
                </AppText>
                <AppText style={{ color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                  {fmt(s.total)}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { history, removeHistory } = useStore();

  const handleDelete = (entry: HistoryEntry) => {
    Alert.alert('Delete entry', `Remove "${entry.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeHistory(entry.id) },
    ]);
  };

  const handleView = (entry: HistoryEntry) => {
    // Reconstruct a minimal SplitResult from history for viewing
    const result = {
      type: entry.type,
      splits: entry.splits,
      grandTotal: entry.grandTotal,
      session: { id: entry.id, date: entry.date },
    };
    navigation.navigate('Summary', { result: JSON.stringify(result), label: entry.label });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 40 }}>
        <View style={{ paddingTop: Spacing.md }}>
          <AppText variant="h2">History</AppText>
          <AppText variant="bodySmall" style={{ marginTop: 4 }}>
            All your past splits
          </AppText>
        </View>

        <View style={{ gap: Spacing.sm }}>
          <SectionHeader title={`${history.length} session${history.length !== 1 ? 's' : ''}`} />
          {history.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No history yet"
              subtitle="Your calculated splits will appear here"
            />
          ) : (
            history.map(entry => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                onPress={() => handleView(entry)}
                onDelete={() => handleDelete(entry)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
