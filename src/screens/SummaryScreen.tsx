import React, { useState } from 'react';
import { View, ScrollView, Share, Linking, Modal, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../theme';
import { SplitResult, PersonSplit } from '../types';
import { useStore } from '../store';
import {
  getSplitwiseCurrentUser,
  getSplitwiseFriends,
  createSplitwiseExpense,
  matchFriends,
  SplitwiseUser,
  SplitwiseFriend,
} from '../utils/splitwiseApi';

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
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

function PersonCard({
  split, onShare,
}: { split: PersonSplit; onShare: () => void }) {
  const isMe = split.friendId === 'me';
  return (
    <Card variant={isMe ? 'default' : 'alt'} style={{ borderColor: isMe ? Colors.primary : Colors.border }}>
      <View style={{ gap: Spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {isMe && (
              <View style={{
                backgroundColor: Colors.primary, borderRadius: Radius.sm,
                paddingHorizontal: Spacing.sm, paddingVertical: 2,
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

        <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: 4 }}>
          <Row label="Subtotal" value={fmt(split.subtotal)} />
          {split.discount > 0 && (
            <Row label="Item discounts saved" value={`-${fmt(split.discount)}`} valueColor={Colors.success} />
          )}
          {split.voucherSaving > 0 && (
            <Row label="Discount / voucher share" value={`-${fmt(split.voucherSaving)}`} valueColor={Colors.success} />
          )}
          {split.feeShare > 0 && (
            <Row label="Fees (proportional)" value={`+${fmt(split.feeShare)}`} valueColor={Colors.warning} />
          )}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <PillButton
            label={isMe ? 'Share your amount' : `Share ${split.name}'s amount`}
            onPress={onShare}
            variant="secondary"
            size="sm"
          />
        </View>
      </View>
    </Card>
  );
}

// ── Splitwise mapping row ─────────────────────────────────────────────────────

type MappingEntry = {
  split: PersonSplit;
  matched: SplitwiseFriend | SplitwiseUser | null;
  isMe: boolean;
};

export default function SummaryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { splitwiseKey, friends } = useStore();

  const result: SplitResult = JSON.parse(route.params.result);
  const label: string = route.params.label;

  // ── Share helpers ──────────────────────────────────────────────────────────

  const buildShareText = () => [
    `💸 ${label}`,
    '',
    ...result.splits.map(s => `${s.name === 'Me' ? 'You' : s.name}: ${fmt(s.total)}`),
    '',
    `Total: ${fmt(result.grandTotal)}`,
  ].join('\n');

  const shareViaWhatsApp = async (text: string) => {
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      await Share.share({ message: text });
    }
  };

  // ── Splitwise ──────────────────────────────────────────────────────────────

  const [swLoading, setSwLoading] = useState(false);
  const [swModal, setSwModal] = useState(false);
  const [swPosting, setSwPosting] = useState(false);
  const [swCurrentUser, setSwCurrentUser] = useState<SplitwiseUser | null>(null);
  const [swFriendsList, setSwFriendsList] = useState<SplitwiseFriend[]>([]);
  const [mapping, setMapping] = useState<MappingEntry[]>([]);

  const handleOpenSplitwise = async () => {
    if (!splitwiseKey) {
      navigation.navigate('Settings');
      return;
    }
    setSwLoading(true);
    try {
      const [me, swFriends] = await Promise.all([
        getSplitwiseCurrentUser(splitwiseKey),
        getSplitwiseFriends(splitwiseKey),
      ]);
      setSwCurrentUser(me);
      setSwFriendsList(swFriends);

      const entries: MappingEntry[] = result.splits.map(split => {
        if (split.friendId === 'me') {
          return { split, matched: me, isMe: true };
        }
        const friendName = friends.find(f => f.id === split.friendId)?.name ?? split.name;
        const matched = matchFriends(friendName, swFriends);
        return { split, matched, isMe: false };
      });

      setMapping(entries);
      setSwModal(true);
    } catch (e: any) {
      alert(`Splitwise error: ${e.message}`);
    } finally {
      setSwLoading(false);
    }
  };

  const handlePostToSplitwise = async () => {
    if (!swCurrentUser) return;
    setSwPosting(true);
    try {
      // Build entries: me pays full cost, everyone owes their share
      // Unmatched friends → their amount added to "me" owed_share
      let myOwedShare = 0;
      const entries: { userId: number; owedShare: number; paidShare: number }[] = [];

      for (const m of mapping) {
        if (m.isMe) {
          myOwedShare += m.split.total;
        } else if (m.matched) {
          entries.push({ userId: m.matched.id, owedShare: m.split.total, paidShare: 0 });
        } else {
          // Unmatched: add to my share
          myOwedShare += m.split.total;
        }
      }

      // Me: paid everything, owed my share
      entries.unshift({
        userId: swCurrentUser.id,
        paidShare: result.grandTotal,
        owedShare: myOwedShare,
      });

      await createSplitwiseExpense(
        splitwiseKey,
        label,
        result.grandTotal,
        'AUD',
        entries,
      );

      setSwModal(false);
      alert('✅ Added to Splitwise!');
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    } finally {
      setSwPosting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const sorted = [...result.splits].sort((a, b) =>
    a.friendId === 'me' ? -1 : b.friendId === 'me' ? 1 : 0,
  );

  const unmatchedCount = mapping.filter(m => !m.isMe && !m.matched).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 100 }}>

        {/* Header */}
        <View style={{ paddingTop: Spacing.sm, gap: Spacing.xs }}>
          <AppText variant="h2">Split Summary</AppText>
          <AppText variant="bodySmall">{label}</AppText>
        </View>

        {/* Grand total */}
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
              onShare={() => shareViaWhatsApp(
                `💸 ${label}\n${split.name === 'Me' ? 'You' : split.name} owes: ${fmt(split.total)}`,
              )}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <PillButton
              label="Share All"
              onPress={() => shareViaWhatsApp(buildShareText())}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <PillButton
              label="New Split"
              onPress={() => navigation.navigate('Home')}
              style={{ flex: 1 }}
            />
          </View>

          {/* Splitwise button */}
          <Pressable
            onPress={handleOpenSplitwise}
            disabled={swLoading}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: Spacing.sm, paddingVertical: Spacing.md,
              borderRadius: Radius.lg, borderWidth: 1.5,
              borderColor: '#1CC29F',
              backgroundColor: pressed ? '#1CC29F22' : '#1CC29F0E',
              opacity: swLoading ? 0.7 : 1,
            })}
          >
            {swLoading
              ? <ActivityIndicator color="#1CC29F" size="small" />
              : <AppText style={{ fontSize: 18 }}>💚</AppText>
            }
            <AppText style={{ color: '#1CC29F', fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
              {swLoading ? 'Connecting...' : splitwiseKey ? 'Add to Splitwise' : 'Connect Splitwise'}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      {/* Splitwise confirmation modal */}
      <Modal visible={swModal} transparent animationType="slide" onRequestClose={() => setSwModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: Colors.card,
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            padding: Spacing.lg,
            gap: Spacing.md,
            maxHeight: '80%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="h3">Add to Splitwise</AppText>
              <Pressable onPress={() => setSwModal(false)}>
                <AppText style={{ color: Colors.textMuted, fontSize: FontSize.lg }}>✕</AppText>
              </Pressable>
            </View>

            <AppText variant="bodySmall">
              Review how SplitEasy friends map to your Splitwise contacts.
            </AppText>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: Spacing.sm }}>
                {mapping.map(m => (
                  <View
                    key={m.split.friendId}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
                      borderRadius: Radius.md, gap: Spacing.sm,
                      backgroundColor: m.isMe
                        ? Colors.primary + '18'
                        : m.matched
                          ? Colors.success + '18'
                          : Colors.warning + '18',
                      borderWidth: 1,
                      borderColor: m.isMe
                        ? Colors.primary + '44'
                        : m.matched
                          ? Colors.success + '44'
                          : Colors.warning + '44',
                    }}
                  >
                    <AppText style={{ fontSize: 16 }}>
                      {m.isMe ? '🫵' : m.matched ? '✓' : '⚠️'}
                    </AppText>
                    <View style={{ flex: 1 }}>
                      <AppText style={{
                        fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
                        color: Colors.textPrimary,
                      }}>
                        {m.split.name === 'Me' ? 'You' : m.split.name}
                        {' '}
                        <AppText style={{ color: Colors.textMuted, fontWeight: FontWeight.regular }}>
                          → {m.isMe
                            ? `${(swCurrentUser as SplitwiseUser).first_name} (you)`
                            : m.matched
                              ? `${(m.matched as SplitwiseFriend).first_name} ${(m.matched as SplitwiseFriend).last_name}`
                              : 'Not in Splitwise'
                          }
                        </AppText>
                      </AppText>
                      {!m.isMe && !m.matched && (
                        <AppText style={{ fontSize: FontSize.xs, color: Colors.warning, marginTop: 2 }}>
                          Their {fmt(m.split.total)} will be added to your share
                        </AppText>
                      )}
                    </View>
                    <AppText style={{ color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.sm }}>
                      {fmt(m.split.total)}
                    </AppText>
                  </View>
                ))}
              </View>
            </ScrollView>

            {unmatchedCount > 0 && (
              <AppText style={{
                fontSize: FontSize.xs, color: Colors.warning,
                fontStyle: 'italic', textAlign: 'center',
              }}>
                {unmatchedCount} friend{unmatchedCount > 1 ? 's' : ''} not found in Splitwise — their amount added to your share
              </AppText>
            )}

            <View style={{ gap: Spacing.sm }}>
              <Pressable
                onPress={handlePostToSplitwise}
                disabled={swPosting}
                style={({ pressed }) => ({
                  backgroundColor: swPosting ? '#1CC29F88' : '#1CC29F',
                  borderRadius: Radius.lg,
                  paddingVertical: Spacing.md,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: Spacing.sm,
                })}
              >
                {swPosting && <ActivityIndicator color="#fff" size="small" />}
                <AppText style={{ color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
                  {swPosting ? 'Adding...' : 'Confirm & Add to Splitwise'}
                </AppText>
              </Pressable>
              <PillButton
                label="Cancel"
                onPress={() => setSwModal(false)}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
