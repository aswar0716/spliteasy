import React, { useState, useMemo } from 'react';
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
import {
  calculateWoolworthsSplit,
  calculateRestaurantSplit,
  calculateUniversalSplit,
} from '../utils/splitCalculator';
import {
  WoolworthsSession, WoolworthsItem,
  RestaurantSession, RestaurantItem,
  UniversalSession, UniversalItem,
  HistoryEntry,
} from '../types';

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

type BillType = 'woolworths' | 'restaurant' | 'universal';

export default function BillEntryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { friends, addHistory, geminiKey } = useStore();

  const participants: string[] = route.params?.participants ?? [];
  const billType: BillType = route.params?.billType ?? 'universal';

  const isWoolworths = billType === 'woolworths';
  const isRestaurant = billType === 'restaurant';
  const isUniversal = billType === 'universal';

  const accent =
    isWoolworths ? Colors.info :
    isRestaurant ? Colors.orange :
    Colors.primary;

  const headerIcon = isWoolworths ? '🛒' : isRestaurant ? '🍽️' : '🧠';
  const headerLabel = isWoolworths ? 'Woolworths' : isRestaurant ? 'Restaurant' : 'Smart Split';

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

  // Fix: when adding a friend to a "me-only" item (assignedTo=[]),
  // convert to ['me', friendId] so "You" stays highlighted
  const toggleAssignee = (itemId: string, personId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;

      if (personId === 'me') {
        const isMeOnly = item.assignedTo.length === 0;
        const hasMeExplicit = item.assignedTo.includes('me');
        if (isMeOnly) {
          // me was implicit (default) — explicitly deselect
          const otherIds = allPeople.filter(p => p.id !== 'me').map(p => p.id);
          return { ...item, assignedTo: otherIds.length > 0 ? otherIds : ['__none__'] };
        }
        if (hasMeExplicit) {
          // remove me from explicit list
          const rest = item.assignedTo.filter(x => x !== 'me');
          return { ...item, assignedTo: rest.length > 0 ? rest : ['__none__'] };
        }
        // me not in list, add me back
        const rest = item.assignedTo.filter(x => x !== '__none__');
        return { ...item, assignedTo: [...rest, 'me'] };
      }

      // Toggling a friend
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
  }, [items]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scan receipt ─────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (!geminiKey) {
      Alert.alert(
        'API Key Required',
        'Add your OpenAI API key in Settings before scanning.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0].base64) return;

    const asset = result.assets[0];
    setScanning(true);

    try {
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const parsed = await parseReceiptImage(asset.base64!, mimeType, geminiKey);

      const newItems: BillItem[] = parsed.items.map(i => ({
        id: genId(),
        name: i.name,
        price: i.price.toFixed(2),
        productDiscount: i.productDiscount > 0 ? String(i.productDiscount) : '0',
        assignedTo: [],
      }));

      setItems(prev => [...prev, ...newItems]);

      // Auto-fill discount/fee fields from parsed receipt
      if (parsed.storeDiscount === 5 || parsed.storeDiscount === 10) {
        setStoreDiscount(parsed.storeDiscount);
      }
      if (parsed.voucher > 0) setVoucher(String(parsed.voucher));
      if (parsed.extraFees > 0) setExtraFees(String(parsed.extraFees));

      Alert.alert(
        '✅ Scanned!',
        `Found ${newItems.length} items. Review and assign who ordered what.`,
      );
    } catch (e: any) {
      Alert.alert('Scan failed', e.message ?? 'Try a clearer photo.');
    } finally {
      setScanning(false);
    }
  };

  // ── Calculate ────────────────────────────────────────────────────────────

  const resolveAssignees = (item: BillItem): string[] => {
    if (item.assignedTo.length === 0) return []; // implicit me only
    if (item.assignedTo.includes('__none__')) return []; // treat as me only
    if (item.assignedTo.length === 1 && item.assignedTo[0] === 'me') return []; // explicit me only
    const withoutMe = item.assignedTo.filter(x => x !== 'me');
    const includesMe = item.assignedTo.includes('me');
    return includesMe ? ['me', ...withoutMe] : withoutMe;
  };

  const handleCalculate = () => {
    if (items.length === 0) {
      Alert.alert('No items', 'Add at least one item.');
      return;
    }
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
    const defaultLabel = isWoolworths
      ? `Woolworths · ${dateStr}`
      : isRestaurant
        ? `Restaurant · ${dateStr}`
        : `Smart Split · ${dateStr}`;
    const label = sessionLabel.trim() || defaultLabel;

    let result;

    if (isWoolworths) {
      const woolItems: WoolworthsItem[] = items.map(i => ({
        id: i.id, name: i.name,
        originalPrice: parseFloat(i.price),
        productDiscount: parseFloat(i.productDiscount) || 0,
        assignedTo: resolveAssignees(i),
      }));
      const session: WoolworthsSession = {
        id: sessionId, date, storeDiscount,
        voucher: parseFloat(voucher) || 0,
        items: woolItems,
      };
      result = calculateWoolworthsSplit(session, friendMap);
    } else if (isRestaurant) {
      const restItems: RestaurantItem[] = items.map(i => ({
        id: i.id, name: i.name,
        price: parseFloat(i.price),
        assignedTo: resolveAssignees(i),
      }));
      const session: RestaurantSession = {
        id: sessionId, date, label,
        items: restItems,
        extraFees: parseFloat(extraFees) || 0,
      };
      result = calculateRestaurantSplit(session, friendMap);
    } else {
      // Universal
      const uItems: UniversalItem[] = items.map(i => ({
        id: i.id, name: i.name,
        originalPrice: parseFloat(i.price),
        productDiscount: parseFloat(i.productDiscount) || 0,
        assignedTo: resolveAssignees(i),
      }));
      const session: UniversalSession = {
        id: sessionId, date, label,
        storeDiscount,
        voucher: parseFloat(voucher) || 0,
        extraFees: parseFloat(extraFees) || 0,
        items: uItems,
      };
      result = calculateUniversalSplit(session, friendMap);
    }

    const historyEntry: HistoryEntry = {
      id: sessionId, date, label,
      type: billType,
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
          <AppText style={{
            color: selected ? '#fff' : Colors.textMuted,
            fontSize: 9, fontWeight: FontWeight.bold,
          }}>
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

  const showStoreDiscount = isWoolworths || isUniversal;
  const showVoucher = isWoolworths || isUniversal;
  const showExtraFees = isRestaurant || isUniversal;
  const showProductDiscount = isWoolworths || isUniversal;

  const hasFinancialFields =
    (parseFloat(voucher) || 0) > 0 ||
    (parseFloat(extraFees) || 0) > 0 ||
    storeDiscount > 0;

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ paddingTop: Spacing.sm, gap: Spacing.sm }}>
          <AppText variant="h2" style={{ color: accent }}>
            {headerIcon} {headerLabel}
          </AppText>
          {/* Participants row */}
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
          {/* Editable session label */}
          <TextInput
            value={sessionLabel}
            onChangeText={setSessionLabel}
            placeholder={
              isWoolworths ? 'e.g. Woolworths weekly shop…'
              : isRestaurant ? 'e.g. Dinner at Nando\'s…'
              : 'e.g. DoorDash Friday night…'
            }
            placeholderTextColor={Colors.textMuted}
            style={{
              color: Colors.textPrimary, fontSize: FontSize.sm,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
              paddingBottom: 4, paddingTop: 2,
            }}
          />
        </View>

        {/* Scan button */}
        <Pressable
          onPress={handleScan}
          disabled={scanning}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg,
            borderWidth: 1.5, borderColor: accent, borderStyle: 'dashed',
            backgroundColor: pressed ? accent + '15' : accent + '08',
            opacity: scanning ? 0.7 : 1,
          })}
        >
          {scanning
            ? <ActivityIndicator color={accent} />
            : <AppText style={{ fontSize: 22 }}>📷</AppText>
          }
          <View>
            <AppText style={{ color: accent, fontWeight: FontWeight.semibold, fontSize: FontSize.md }}>
              {scanning ? 'Scanning receipt...' : 'Scan Receipt with AI'}
            </AppText>
            {!scanning && (
              <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>
                Auto-detects items, discounts & fees
              </AppText>
            )}
          </View>
        </Pressable>

        {/* Items */}
        <View style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHeader title={`${items.length} item${items.length !== 1 ? 's' : ''}`} />
            <Pressable
              onPress={addBlankItem}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}
            >
              <AppText style={{ color: accent, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
                + Add manually
              </AppText>
            </Pressable>
          </View>

          {items.map((item, index) => (
            <Card key={item.id} variant="alt" style={{ gap: Spacing.sm }}>
              {/* Row 1: name + price + delete */}
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

              {/* Product discount (Woolworths / Universal) */}
              {showProductDiscount && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>Item discount:</AppText>
                  <TextInput
                    value={item.productDiscount}
                    onChangeText={v => updateItem(item.id, { productDiscount: v })}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      color: Colors.success, fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
                      minWidth: 32, textAlign: 'center',
                      borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 2,
                    }}
                  />
                  <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>% off</AppText>
                </View>
              )}

              {/* Who's splitting this item */}
              <View style={{ gap: Spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>Who's splitting this?</AppText>
                  <Pressable onPress={() => assignAll(item.id)}>
                    <AppText style={{ color: accent, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
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
              color: Colors.textMuted, fontSize: FontSize.xs,
              fontWeight: FontWeight.semibold, letterSpacing: 0.8,
              marginBottom: Spacing.sm, textTransform: 'uppercase',
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
                  <AppText style={{
                    color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md,
                  }}>
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

            {showStoreDiscount && (
              <View>
                <AppText variant="label" style={{ marginBottom: Spacing.sm }}>Store Discount</AppText>
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
            )}

            {showVoucher && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 }}>
                  Voucher / Reward
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppText style={{ color: Colors.textMuted }}>$</AppText>
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
            )}

            {showExtraFees && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 }}>
                  Delivery / Service / Tax / Surcharge
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppText style={{ color: Colors.textMuted }}>$</AppText>
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
            )}

            {!hasFinancialFields && (
              <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' }}>
                No extra discounts or fees — all zero
              </AppText>
            )}
          </View>
        </Card>

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
  const names = relevant.map(id =>
    id === 'me' ? 'You' : allPeople.find(p => p.id === id)?.name ?? id,
  );
  return names.join(' + ');
}
