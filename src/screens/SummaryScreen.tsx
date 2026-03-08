import React from 'react';
import { View, ScrollView, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../theme';
import { SplitResult, PersonSplit } from '../types';
import { useStore } from '../store';

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function PersonCard({ split, isWoolworths }: { split: PersonSplit; isWoolworths: boolean }) {
  const isMe = split.friendId === 'me';
  return (
    <Card variant={isMe ? 'default' : 'alt'} style={{ borderColor: isMe ? Colors.primary : Colors.border }}>
      <View style={{ gap: Spacing.sm }}>
        {/* Name + total */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {isMe && (
              <View style={{
                backgroundColor: Colors.primary,
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.sm,
                paddingVertical: 2,
              }}>
                <AppText style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold }}>YOU</AppText>
              </View>
            )}
            <AppText variant="h3">{split.name}</AppText>
          </View>
          <AppText style={{ fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary }}>
            {fmt(split.total)}
          </AppText>
        </View>

        {/* Breakdown */}
        <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: 4 }}>
          <Row label="Subtotal" value={fmt(split.subtotal)} />
          {isWoolworths && split.discount > 0 && (
            <Row label="Discounts saved" value={`-${fmt(split.discount)}`} valueColor={Colors.success} />
          )}
          {isWoolworths && split.voucherSaving > 0 && (
            <Row label="Voucher share" value={`-${fmt(split.voucherSaving)}`} valueColor={Colors.success} />
          )}
          {!isWoolworths && split.feeShare > 0 && (
            <Row label="Fees (proportional)" value={`+${fmt(split.feeShare)}`} valueColor={Colors.warning} />
          )}
        </View>
      </View>
    </Card>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText variant="bodySmall">{label}</AppText>
      <AppText style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: valueColor ?? Colors.textPrimary }}>
        {value}
      </AppText>
    </View>
  );
}

export default function SummaryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { friends } = useStore();

  const result: SplitResult = JSON.parse(route.params.result);
  const label: string = route.params.label;
  const isWoolworths = result.type === 'woolworths';

  const handleShare = async () => {
    const lines = [
      `📋 ${label}`,
      ``,
      ...result.splits.map(s =>
        `${s.name}: ${fmt(s.total)}`
      ),
      ``,
      `Total: ${fmt(result.grandTotal)}`,
    ];
    await Share.share({ message: lines.join('\n') });
  };

  // Sort: me first
  const sorted = [...result.splits].sort((a, b) =>
    a.friendId === 'me' ? -1 : b.friendId === 'me' ? 1 : 0,
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ paddingTop: Spacing.sm, gap: Spacing.xs }}>
          <AppText variant="h2">Split Summary</AppText>
          <AppText variant="bodySmall">{label}</AppText>
        </View>

        {/* Grand total banner */}
        <Card style={{ backgroundColor: Colors.primary + '22', borderColor: Colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="label">Grand Total</AppText>
            <AppText style={{ fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.primary }}>
              {fmt(result.grandTotal)}
            </AppText>
          </View>
        </Card>

        {/* Person splits */}
        <View style={{ gap: Spacing.sm }}>
          <SectionHeader title="Who pays what" />
          {sorted.map(split => (
            <PersonCard key={split.friendId} split={split} isWoolworths={isWoolworths} />
          ))}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <PillButton label="Share" onPress={handleShare} variant="secondary" style={{ flex: 1 }} />
          <PillButton
            label="New Split"
            onPress={() => navigation.navigate('Home')}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
