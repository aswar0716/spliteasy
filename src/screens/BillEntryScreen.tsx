import React, { useState, useMemo, useCallback } from 'react';
import {
  View, ScrollView, TextInput, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';
import { parseReceiptImage } from '../utils/geminiParser';
import { calculateUniversalSplit } from '../utils/splitCalculator';
import { UniversalSession, UniversalItem, HistoryEntry } from '../types';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

type BillItem = {
  id: string;
  name: string;
  price: string;
  productDiscount: string;
  assignedTo: string[]; // [] = me only; ['me', ...friendIds] = explicit
};

export default function BillEntryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { friends, addHistory, geminiKey } = useStore();

  const participants: string[] = route.params?.participants ?? [];

  const allPeople = [
    { id: 'me', name: 'You', color: Colors.primary },
    ...friends.filter(f => participants.includes(f.id)),
  ];

  const friendMap = Object.fromEntries(friends.map(f => [f.id, f.name]));

  const [items, setItems] = useState<BillItem[]>([]);
  const [sessionLabel, setSessionLabel] = useState('');
  const [storeDiscount, setStoreDiscount] = useState<0 | 5 | 10>(0);
  const [voucher, setVoucher] = useState('0');
  const [extraFees, setExtraFees] = useState('0');
  const [scanning, setScanning] = useState(false);

  // ── Item helpers ─────────────────────────────────────────────────────────

  const updateItem = (id: string, patch: Partial<BillItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const addBlankItem = () => {
    setItems(prev => [...prev, {
      id: genId(), name: '', price: '', productDiscount: '0', assignedTo: [],
    }]);
  };

  // When adding a friend to a "me-only" item (assignedTo=[]),
  // convert to ['me', friendId] so "You" stays highlighted
  const toggleAssignee = (itemId: string, personId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;

      if (personId === 'me') {
        const isMeOnly = item.assignedTo.length === 0;
        const hasMeExplicit = item.assignedTo.includes('me');
        if (isMeOnly) {
          const otherIds = allPeople.filter(p => p.id !== 'me').map(p => p.id);
          return { ...item, assignedTo: otherIds.length > 0 ? otherIds : ['__none__'] };
        }
        if (hasMeExplicit) {
          const rest = item.assignedTo.filter(x => x !== 'me');
          return { ...item, assignedTo: rest.length > 0 ? rest : ['__none__'] };
        }
        const rest = item.assignedTo.filter(x => x !== '__none__');
        return { ...item, assignedTo: [...rest, 'me'] };
      }

      const already = item.assignedTo.includes(personId);
      if (already) {
        const rest = item.assignedTo.filter(x => x !== personId);
        return { ...item, assignedTo: rest.length > 0 ? rest : [] };
      } else {
        // Adding friend: if was "me only" (assignedTo=[]), preserve me explicitly
        const base = item.assignedTo.length === 0 ? ['me'] : item.assignedTo.filter(x => x !== '__none__');
        return { ...item, assignedTo: [...base, personId] };
      }
    }));
  };

  const assignAll = (itemId: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, assignedTo: allPeople.map(p => p.id) }
        : item,
    ));
  };

  // ── Live running totals ──────────────────────────────────────────────────

  const runningTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    allPeople.forEach(p => (totals[p.id] = 0));
    items.forEach(item => {
      const price = parseFloat(item.price) || 0;
      if (price === 0) return;
      const assignees = item.assignedTo.length === 0
        ? ['me']
        : item.assignedTo.filter(x => x !== '__none__');
      if (assignees.length === 0) return;
      const share = price / assignees.length;
      assignees.forEach(id => {
        if (totals[id] !== undefined) totals[id] += share;
      });
    });
    return totals;
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bill total preview ───────────────────────────────────────────────────

  const billPreview = useMemo(() => {
    const rawSubtotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
    const itemDiscounts = items.reduce((s, i) => s + (parseFloat(i.productDiscount) || 0), 0);
    const afterItemDisc = rawSubtotal - itemDiscounts;
    const storeDiscAmt = afterItemDisc * (storeDiscount / 100);
    const afterStoreDisc = afterItemDisc - storeDiscAmt;
    const voucherAmt = parseFloat(voucher) || 0;
    const feesAmt = parseFloat(extraFees) || 0;
    const net = Math.max(0, afterStoreDisc - voucherAmt + feesAmt);
    return { rawSubtotal, itemDiscounts, storeDiscAmt, voucherAmt, feesAmt, net };
  }, [items, storeDiscount, voucher, extraFees]);

  // ── Scan receipt ─────────────────────────────────────────────────────────

  const checkApiKey = (): boolean => {
    if (!geminiKey) {
      Alert.alert(
        'API Key Required',
        'Add your OpenAI API key in Settings before scanning.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
        ],
      );
      return false;
    }
    return true;
  };

  const processReceiptAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;
    setScanning(true);
    try {
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const parsed = await parseReceiptImage(asset.base64, mimeType, geminiKey);

      const newItems: BillItem[] = parsed.items.map(i => ({
        id: genId(),
        name: i.name,
        price: i.price.toFixed(2),
        productDiscount: i.productDiscount > 0 ? String(i.productDiscount) : '0',
        assignedTo: [],
      }));

      setItems(prev => [...prev, ...newItems]);

      if (parsed.storeDiscount === 5 || parsed.storeDiscount === 10) setStoreDiscount(parsed.storeDiscount);
      if (parsed.voucher > 0) setVoucher(prev => ((parseFloat(prev) || 0) + parsed.voucher).toFixed(2));
      if (parsed.extraFees > 0) setExtraFees(prev => ((parseFloat(prev) || 0) + parsed.extraFees).toFixed(2));

      Alert.alert('✅ Scanned!', `Found ${newItems.length} items. Assign who ordered what.`);
    } catch (e: any) {
      Alert.alert('Scan failed', e.message ?? 'Try a clearer photo.');
    } finally {
      setScanning(false);
    }
  };

  const handleGallery = async () => {
    if (!checkApiKey()) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], base64: true, quality: 0.85,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets.length) return;

    setScanning(true);
    try {
      // Parse all selected images and collect items from this batch
      let batchItems: BillItem[] = [];
      let batchVoucher = 0;
      let batchFees = 0;
      let batchStoreDiscount: 0 | 5 | 10 = 0;

      for (const asset of result.assets) {
        if (!asset.base64) continue;
        const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const parsed = await parseReceiptImage(asset.base64, mimeType, geminiKey);
        const mapped: BillItem[] = parsed.items.map(i => ({
          id: genId(),
          name: i.name,
          price: i.price.toFixed(2),
          productDiscount: i.productDiscount > 0 ? String(i.productDiscount) : '0',
          assignedTo: [],
        }));
        batchItems = [...batchItems, ...mapped];
        batchVoucher += parsed.voucher ?? 0;
        batchFees += Math.max(0, parsed.extraFees ?? 0);
        if (parsed.storeDiscount === 5 || parsed.storeDiscount === 10) batchStoreDiscount = parsed.storeDiscount;
      }

      // Deduplicate within this batch (overlapping screenshots of the same bill)
      const dedupedBatch: BillItem[] = [];
      for (const item of batchItems) {
        const alreadyInBatch = dedupedBatch.some(
          ex =>
            ex.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
            Math.abs(parseFloat(ex.price) - parseFloat(item.price)) < 0.01,
        );
        if (!alreadyInBatch) dedupedBatch.push(item);
      }

      const skipped = batchItems.length - dedupedBatch.length;
      setItems(prev => [...prev, ...dedupedBatch]);
      if (batchStoreDiscount > 0) setStoreDiscount(batchStoreDiscount);
      if (batchVoucher > 0) setVoucher(prev => ((parseFloat(prev) || 0) + batchVoucher).toFixed(2));
      if (batchFees > 0) setExtraFees(prev => ((parseFloat(prev) || 0) + batchFees).toFixed(2));

      const msg = skipped > 0
        ? `Added ${dedupedBatch.length} items (removed ${skipped} duplicate${skipped > 1 ? 's' : ''} from overlapping screenshots).`
        : `Found ${dedupedBatch.length} items across ${result.assets.length} photo${result.assets.length > 1 ? 's' : ''}.`;
      Alert.alert('✅ Scanned!', msg);
    } catch (e: any) {
      Alert.alert('Scan failed', e.message ?? 'Try a clearer photo.');
    } finally {
      setScanning(false);
    }
  };

  const handleCamera = async () => {
    if (!checkApiKey()) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], base64: true, quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await processReceiptAsset(result.assets[0]);
    }
  };

  // ── Calculate ────────────────────────────────────────────────────────────

  const resolveAssignees = (item: BillItem): string[] => {
    if (item.assignedTo.length === 0) return [];
    if (item.assignedTo.includes('__none__')) return [];
    if (item.assignedTo.length === 1 && item.assignedTo[0] === 'me') return [];
    const withoutMe = item.assignedTo.filter(x => x !== 'me');
    return item.assignedTo.includes('me') ? ['me', ...withoutMe] : withoutMe;
  };

  const handleCalculate = () => {
    if (items.length === 0) { Alert.alert('No items', 'Add at least one item.'); return; }
    const invalid = items.find(
      i => !i.name.trim() || isNaN(parseFloat(i.price)) || parseFloat(i.price) <= 0,
    );
    if (invalid) {
      Alert.alert('Invalid item', `"${invalid.name || 'Unnamed'}" has a missing or invalid price.`);
      return;
    }

    const sessionId = genId();
    const date = new Date().toISOString();
    const dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const label = sessionLabel.trim() || `Split · ${dateStr}`;

    const uItems: UniversalItem[] = items.map(i => {
      const originalPrice = parseFloat(i.price) || 0;
      const discountAmt = parseFloat(i.productDiscount) || 0;
      // Calculator expects productDiscount as a %; convert from dollar amount
      const productDiscountPct = originalPrice > 0 ? (discountAmt / originalPrice) * 100 : 0;
      return {
        id: i.id, name: i.name,
        originalPrice,
        productDiscount: productDiscountPct,
        assignedTo: resolveAssignees(i),
      };
    });

    const session: UniversalSession = {
      id: sessionId, date, label, storeDiscount,
      voucher: parseFloat(voucher) || 0,
      extraFees: parseFloat(extraFees) || 0,
      items: uItems,
    };

    const result = calculateUniversalSplit(session, friendMap);

    const historyEntry: HistoryEntry = {
      id: sessionId, date, label,
      type: 'universal',
      grandTotal: result.grandTotal,
      splits: result.splits,
    };
    addHistory(historyEntry);

    navigation.navigate('Summary', { result: JSON.stringify(result), label });
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const PersonChip = ({
    person, selected, onPress,
  }: { person: { id: string; name: string; color: string }; selected: boolean; onPress: () => void }) => {
    const initials = person.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    return (
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingVertical: 3, paddingHorizontal: Spacing.sm,
          borderRadius: Radius.full, borderWidth: 1.5,
          borderColor: selected ? person.color : Colors.border,
          backgroundColor: selected ? person.color + '22' : 'transparent',
        }}
      >
        <View style={{
          width: 18, height: 18, borderRadius: 9,
          backgroundColor: selected ? person.color : Colors.surface,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AppText style={{ color: selected ? '#fff' : Colors.textMuted, fontSize: 9, fontWeight: FontWeight.bold }}>
            {initials}
          </AppText>
        </View>
        <AppText style={{
          fontSize: FontSize.xs,
          color: selected ? person.color : Colors.textMuted,
          fontWeight: selected ? FontWeight.semibold : FontWeight.regular,
        }}>
          {person.id === 'me' ? 'You' : person.name}
        </AppText>
      </Pressable>
    );
  };

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ paddingTop: Spacing.sm, gap: Spacing.sm }}>
          <AppText variant="h2">Bill Entry</AppText>
          {/* Participants */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
            {allPeople.map(p => (
              <View key={p.id} style={{
                paddingHorizontal: Spacing.sm, paddingVertical: 2,
                borderRadius: Radius.full, backgroundColor: p.color + '33',
              }}>
                <AppText style={{ color: p.color, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                  {p.id === 'me' ? 'You' : p.name}
                </AppText>
              </View>
            ))}
          </View>
          {/* Editable label */}
          <TextInput
            value={sessionLabel}
            onChangeText={setSessionLabel}
            placeholder="Name this split (e.g. DoorDash Friday night…)"
            placeholderTextColor={Colors.textMuted}
            style={{
              color: Colors.textPrimary, fontSize: FontSize.sm,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
              paddingBottom: 4, paddingTop: 2,
            }}
          />
        </View>

        {/* Scan / Upload */}
        {scanning ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg,
            backgroundColor: Colors.primary + '10', borderWidth: 1, borderColor: Colors.primary + '40',
          }}>
            <ActivityIndicator color={Colors.primary} />
            <AppText style={{ color: Colors.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
              Reading receipt…
            </AppText>
          </View>
        ) : (
          <View style={{ gap: Spacing.sm }}>
            <AppText style={{
              color: Colors.textMuted, fontSize: FontSize.xs,
              fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.8,
            }}>
              Scan / Upload Receipt
            </AppText>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Pressable
                onPress={handleCamera}
                style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: Spacing.sm, paddingVertical: Spacing.md,
                  borderRadius: Radius.lg, borderWidth: 1.5,
                  borderColor: Colors.primary, backgroundColor: pressed ? Colors.primary + '20' : Colors.primary + '0C',
                })}
              >
                <AppText style={{ fontSize: 20 }}>📷</AppText>
                <AppText style={{ color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.sm }}>
                  Take Photo
                </AppText>
              </Pressable>
              <Pressable
                onPress={handleGallery}
                style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: Spacing.sm, paddingVertical: Spacing.md,
                  borderRadius: Radius.lg, borderWidth: 1.5,
                  borderColor: Colors.border, backgroundColor: pressed ? Colors.surface : 'transparent',
                })}
              >
                <AppText style={{ fontSize: 20 }}>🖼️</AppText>
                <AppText style={{ color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm }}>
                  Upload
                </AppText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Items */}
        <View style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHeader title={`${items.length} item${items.length !== 1 ? 's' : ''}`} />
            <Pressable onPress={addBlankItem} style={{ paddingVertical: 2 }}>
              <AppText style={{ color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
                + Add manually
              </AppText>
            </Pressable>
          </View>

          {items.map((item, index) => (
            <Card key={item.id} variant="alt" style={{ gap: Spacing.sm }}>
              {/* Name + price + delete */}
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                <TextInput
                  value={item.name}
                  onChangeText={v => updateItem(item.id, { name: v })}
                  placeholder={`Item ${index + 1}`}
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    flex: 1, color: Colors.textPrimary, fontSize: FontSize.md,
                    fontWeight: FontWeight.medium,
                    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 2,
                  }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <AppText style={{ color: Colors.textMuted, fontSize: FontSize.sm }}>$</AppText>
                  <TextInput
                    value={item.price}
                    onChangeText={v => updateItem(item.id, { price: v })}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      color: Colors.textPrimary, fontSize: FontSize.md,
                      fontWeight: FontWeight.semibold, minWidth: 60, textAlign: 'right',
                      borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 2,
                    }}
                  />
                </View>
                <Pressable onPress={() => removeItem(item.id)} style={{ padding: 4 }}>
                  <AppText style={{ color: Colors.danger, fontSize: FontSize.md }}>✕</AppText>
                </Pressable>
              </View>

              {/* Item discount $ */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>Item discount:</AppText>
                <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>-$</AppText>
                <TextInput
                  value={item.productDiscount}
                  onChangeText={v => updateItem(item.id, { productDiscount: v })}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  style={{
                    color: Colors.success, fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
                    minWidth: 50, textAlign: 'center',
                    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 2,
                  }}
                />
                {(() => {
                  const p = parseFloat(item.price) || 0;
                  const d = parseFloat(item.productDiscount) || 0;
                  if (p > 0 && d > 0) {
                    const pct = ((d / p) * 100).toFixed(0);
                    return <AppText style={{ color: Colors.success + 'AA', fontSize: FontSize.xs }}>({pct}% off)</AppText>;
                  }
                  return null;
                })()}
              </View>

              {/* Who's splitting this item */}
              <View style={{ gap: Spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>Who's splitting this?</AppText>
                  <Pressable onPress={() => assignAll(item.id)}>
                    <AppText style={{ color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                      Everyone
                    </AppText>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
                  {allPeople.map(p => {
                    const isMe = p.id === 'me';
                    const selected = isMe
                      ? (item.assignedTo.length === 0 || item.assignedTo.includes('me'))
                      : item.assignedTo.includes(p.id);
                    return (
                      <PersonChip
                        key={p.id}
                        person={p}
                        selected={selected}
                        onPress={() => toggleAssignee(item.id, p.id)}
                      />
                    );
                  })}
                </View>
                <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' }}>
                  {resolveLabel(item, allPeople)}
                </AppText>
              </View>
            </Card>
          ))}
        </View>

        {/* Live running totals */}
        {items.length > 0 && (
          <Card style={{ backgroundColor: Colors.surface }}>
            <AppText style={{
              color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
              letterSpacing: 0.8, marginBottom: Spacing.sm, textTransform: 'uppercase',
            }}>
              Live Preview (items only)
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
              {allPeople.map(p => (
                <View key={p.id} style={{ alignItems: 'center', gap: 2, minWidth: 60 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: p.color + '33', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AppText style={{ color: p.color, fontSize: FontSize.xs, fontWeight: FontWeight.bold }}>
                      {p.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                    </AppText>
                  </View>
                  <AppText style={{ color: Colors.textSecondary, fontSize: 10 }}>
                    {p.id === 'me' ? 'You' : p.name.split(' ')[0]}
                  </AppText>
                  <AppText style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
                    ${(runningTotals[p.id] ?? 0).toFixed(2)}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Discounts & Fees */}
        <Card>
          <SectionHeader title="Discounts & Fees" />
          <View style={{ gap: Spacing.md }}>

            {/* Store discount % with live $ equivalent */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                <AppText variant="label">Store / Member Discount</AppText>
                {storeDiscount > 0 && billPreview.storeDiscAmt > 0 && (
                  <AppText style={{ color: Colors.info, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                    = -${billPreview.storeDiscAmt.toFixed(2)} off
                  </AppText>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {([0, 5, 10] as const).map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setStoreDiscount(d)}
                    style={{
                      flex: 1, paddingVertical: Spacing.sm,
                      borderRadius: Radius.md, borderWidth: 1.5,
                      borderColor: storeDiscount === d ? Colors.info : Colors.border,
                      backgroundColor: storeDiscount === d ? Colors.info + '22' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <AppText style={{
                      color: storeDiscount === d ? Colors.info : Colors.textSecondary,
                      fontWeight: FontWeight.semibold, fontSize: FontSize.sm,
                    }}>
                      {d === 0 ? 'None' : `${d}% off`}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Discounts & Vouchers */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>
                  Discounts & Vouchers
                </AppText>
                <AppText style={{ color: Colors.textMuted, fontSize: 10, marginTop: 2 }}>
                  team/member/promo discounts + vouchers
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppText style={{ color: Colors.textMuted }}>-$</AppText>
                <TextInput
                  value={voucher}
                  onChangeText={setVoucher}
                  keyboardType="decimal-pad"
                  style={{
                    color: Colors.success, fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                    minWidth: 60, textAlign: 'right',
                    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 2,
                  }}
                />
              </View>
            </View>

            {/* Extra fees */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>
                  Delivery / Service / Tax
                </AppText>
                <AppText style={{ color: Colors.textMuted, fontSize: 10, marginTop: 2 }}>
                  net fees added on top of subtotal
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppText style={{ color: Colors.textMuted }}>+$</AppText>
                <TextInput
                  value={extraFees}
                  onChangeText={setExtraFees}
                  keyboardType="decimal-pad"
                  style={{
                    color: Colors.warning, fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                    minWidth: 60, textAlign: 'right',
                    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 2,
                  }}
                />
              </View>
            </View>

          </View>
        </Card>

        {/* Bill total verification card */}
        {items.length > 0 && (
          <Card style={{ backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '40' }}>
            <AppText style={{
              color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
              letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: Spacing.sm,
            }}>
              Detected Bill Total
            </AppText>
            <View style={{ gap: 6 }}>
              <BillRow label="Items subtotal" value={`$${billPreview.rawSubtotal.toFixed(2)}`} />
              {billPreview.itemDiscounts > 0 && (
                <BillRow label="Item discounts" value={`-$${billPreview.itemDiscounts.toFixed(2)}`} valueColor={Colors.success} />
              )}
              {storeDiscount > 0 && (
                <BillRow
                  label={`Store discount (${storeDiscount}%)`}
                  value={`-$${billPreview.storeDiscAmt.toFixed(2)}`}
                  valueColor={Colors.success}
                />
              )}
              {billPreview.voucherAmt > 0 && (
                <BillRow label="Discounts & vouchers" value={`-$${billPreview.voucherAmt.toFixed(2)}`} valueColor={Colors.success} />
              )}
              {billPreview.feesAmt > 0 && (
                <BillRow label="Fees" value={`+$${billPreview.feesAmt.toFixed(2)}`} valueColor={Colors.warning} />
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
                  Net Total
                </AppText>
                <AppText style={{ color: Colors.primary, fontWeight: FontWeight.extrabold, fontSize: FontSize.lg }}>
                  ${billPreview.net.toFixed(2)}
                </AppText>
              </View>
            </View>
            <AppText style={{ color: Colors.textMuted, fontSize: 10, marginTop: Spacing.sm, fontStyle: 'italic' }}>
              Compare this to your receipt total to verify accuracy
            </AppText>
          </Card>
        )}

        <PillButton
          label="Calculate Split →"
          onPress={handleCalculate}
          size="lg"
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function BillRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>{label}</AppText>
      <AppText style={{ color: valueColor ?? Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
        {value}
      </AppText>
    </View>
  );
}

function resolveLabel(
  item: BillItem,
  allPeople: { id: string; name: string; color: string }[],
): string {
  const { assignedTo } = item;
  if (assignedTo.includes('__none__')) return 'No one assigned yet';
  if (assignedTo.length === 0) return 'You only';
  const relevant = assignedTo.filter(x => x !== '__none__');
  if (
    relevant.length === allPeople.length ||
    (relevant.includes('me') && relevant.filter(x => x !== 'me').length === allPeople.length - 1)
  ) return 'Everyone splits equally';
  return relevant.map(id => id === 'me' ? 'You' : allPeople.find(p => p.id === id)?.name ?? id).join(' + ');
}
