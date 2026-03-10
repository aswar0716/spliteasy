import React from 'react';
import { View, ScrollView, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../theme';
import { SplitResult, PersonSplit } from '../types';

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function PersonCard({
  split,
  type,
  onShare,
}: {
  split: PersonSplit;
  type: 'woolworths' | 'restaurant' | 'universal';
  onShare: () => void;
}) {
  const isMe = split.friendId === 'me';
  const isWoolworths = type === 'woolworths';
  const showDiscount = split.discount > 0;
  const showVoucher = split.voucherSaving > 0;
  const showFees = split.feeShare > 0;

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
          {showDiscount && (
            <Row label="Item discounts saved" value={`-${fmt(split.discount)}`} valueColor={Colors.success} />
          )}
          {showVoucher && (
            <Row label="Voucher share" value={`-${fmt(split.voucherSaving)}`} valueColor={Colors.success} />
          )}
          {showFees && (
            <Row label="Fees (proportional)" value={`+${fmt(split.feeShare)}`} valueColor={Colors.warning} />
          )}
        </View>

        {/* Share this person's amount */}
        <View style={{ alignItems: 'flex-end' }}>
          <PillButton
            label={`Share ${isMe ? 'your' : split.name + "'s"} amount`}
            onPress={onShare}
            variant="secondary"
            size="sm"
          />
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

  const result: SplitResult = JSON.parse(route.params.result);
  const label: string = route.params.label;

  const handleShareAll = async () => {
    const lines = [
      `📋 ${label}`,
      ``,
      ...result.splits.map(s => `${s.name}: ${fmt(s.total)}`),
      ``,
      `Total: ${fmt(result.grandTotal)}`,
    ];
    await Share.share({ message: lines.join('\n') });
  };

  const handleSharePerson = async (split: PersonSplit) => {
    await Share.share({
      message: `📋 ${label}\n${split.name} owes: ${fmt(split.total)}`,
    });
  };

  // Sort: me first
  const sorted = [...result.splits].sort((a, b) =>
    a.friendId === 'me' ? -1 : b.friendId === 'me' ? 1 : 0,
  );

  const typeIcon =
    result.type === 'woolworths' ? '🛒' :
    result.type === 'restaurant' ? '🍽️' : '🧠';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ paddingTop: Spacing.sm, gap: Spacing.xs }}>
          <AppText variant="h2">Split Summary</AppText>
          <AppText variant="bodySmall">{typeIcon} {label}</AppText>
        </View>

        {/* Grand total banner */}
        <Card style={{ backgroundColor: Colors.primary + '22', borderColor: Colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <AppText variant="label">Grand Total</AppText>
              <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 }}>
                {result.splits.length} {result.splits.length === 1 ? 'person' : 'people'}
              </AppText>
            </View>
            <AppText style={{ fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.primary }}>
              {fmt(result.grandTotal)}
            </AppText>
          </View>
        </Card>

        {/* Person splits */}
        <View style={{ gap: Spacing.sm }}>
          <SectionHeader title="Who pays what" />
          {sorted.map(split => (
            <PersonCard
              key={split.friendId}
              split={split}
              type={result.type}
              onShare={() => handleSharePerson(split)}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <PillButton
            label="Share All"
            onPress={handleShareAll}
            variant="secondary"
            style={{ flex: 1 }}
          />
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
