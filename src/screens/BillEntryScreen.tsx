import React, { useState } from 'react';
import {
  View, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';
import { parseReceiptImage } from '../utils/geminiParser';
import { calculateWoolworthsSplit, calculateRestaurantSplit } from '../utils/splitCalculator';
import { WoolworthsSession, WoolworthsItem, RestaurantSession, RestaurantItem, HistoryEntry } from '../types';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

type BillItem = {
  id: string;
  name: string;
  price: string;
  productDiscount: string;
  assignedTo: string[]; // [] = me only
};

export default function BillEntryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { friends, addHistory, geminiKey } = useStore();

  const participants: string[] = route.params?.participants ?? [];
  const billType: 'woolworths' | 'restaurant' = route.params?.billType ?? 'woolworths';
  const isWoolworths = billType === 'woolworths';
  const accent = isWoolworths ? Colors.info : Colors.orange;

  // All people in this split (me + selected friends)
  const allPeople = [
    { id: 'me', name: 'You', color: Colors.primary },
    ...friends.filter(f => participants.includes(f.id)),
  ];

  const friendMap = Object.fromEntries(friends.map(f => [f.id, f.name]));

  // Items
  const [items, setItems] = useState<BillItem[]>([]);

  // Discounts / fees
  const [storeDiscount, setStoreDiscount] = useState<0 | 5 | 10>(0);
  const [voucher, setVoucher] = useState('0');
  const [extraFees, setExtraFees] = useState('0');

  // Scanning state
  const [scanning, setScanning] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);

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

  const toggleAssignee = (itemId: string, personId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const already = item.assignedTo.includes(personId);
      // 'me' is represented by [] so toggle accordingly
      if (personId === 'me') {
        // If me is selected (assignedTo=[]), deselect: add others; if deselected add me back
        // Simpler: if 'me' toggled while assignedTo includes me-equivalent...
        // We store 'me' explicitly for multi-person selections
        return {
          ...item,
          assignedTo: already
            ? item.assignedTo.filter(x => x !== 'me')
            : [...item.assignedTo, 'me'],
        };
      }
      return {
        ...item,
        assignedTo: already
          ? item.assignedTo.filter(x => x !== personId)
          : [...item.assignedTo, personId],
      };
    }));
  };

  const assignAll = (itemId: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, assignedTo: allPeople.map(p => p.id) }
        : item,
    ));
  };

  // ── Scan receipt ─────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (!geminiKey) {
      Alert.alert(
        'API Key Required',
        'Add your Gemini API key in Settings → AI Key before scanning.',
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
    setScannedImageUri(asset.uri);
    setScanning(true);

    try {
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const parsed = await parseReceiptImage(asset.base64!, mimeType, geminiKey);

      // Populate items
      const newItems: BillItem[] = parsed.items.map(i => ({
        id: genId(),
        name: i.name,
        price: i.price.toFixed(2),
        productDiscount: i.productDiscount > 0 ? String(i.productDiscount) : '0',
        assignedTo: [],
      }));

      setItems(prev => [...prev, ...newItems]);

      // Auto-fill discount fields from parsed receipt
      if (isWoolworths) {
        if (parsed.storeDiscount === 5 || parsed.storeDiscount === 10) {
          setStoreDiscount(parsed.storeDiscount);
        }
        if (parsed.voucher > 0) setVoucher(String(parsed.voucher));
      } else {
        if (parsed.extraFees > 0) setExtraFees(String(parsed.extraFees));
      }

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

  const handleCalculate = () => {
    if (items.length === 0) {
      Alert.alert('No items', 'Add at least one item.');
      return;
    }
    const invalid = items.find(i => !i.name.trim() || isNaN(parseFloat(i.price)) || parseFloat(i.price) <= 0);
    if (invalid) {
      Alert.alert('Invalid item', `"${invalid.name || 'Unnamed'}" has a missing or invalid price.`);
      return;
    }

    const sessionId = genId();
    const date = new Date().toISOString();
    const label = isWoolworths
      ? `Woolworths · ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
      : `Restaurant · ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;

    // Convert BillItem → session items
    // assignedTo=[] means "me only"; if 'me' is in assignedTo alongside others, keep it
    const resolveAssignees = (item: BillItem): string[] => {
      if (item.assignedTo.length === 0) return []; // me only
      // If only 'me' selected
      if (item.assignedTo.length === 1 && item.assignedTo[0] === 'me') return [];
      // Remove 'me' string and replace with proper empty-means-me logic:
      // splitCalculator uses [] for me, friend ids for others
      // For shared with me + friends, we pass friend ids + handle 'me' differently
      const withoutMe = item.assignedTo.filter(x => x !== 'me');
      const includesMe = item.assignedTo.includes('me');
      if (includesMe && withoutMe.length === 0) return [];
      if (includesMe) return ['me', ...withoutMe]; // pass 'me' explicitly for multi
      return withoutMe;
    };

    let result;

    if (isWoolworths) {
      const woolItems: WoolworthsItem[] = items.map(i => ({
        id: i.id,
        name: i.name,
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
    } else {
      const restItems: RestaurantItem[] = items.map(i => ({
        id: i.id,
        name: i.name,
        price: parseFloat(i.price),
        assignedTo: resolveAssignees(i),
      }));
      const session: RestaurantSession = {
        id: sessionId, date, label,
        items: restItems,
        extraFees: parseFloat(extraFees) || 0,
      };
      result = calculateRestaurantSplit(session, friendMap);
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

  const PersonChip = ({ person, selected, onPress }: {
    person: { id: string; name: string; color: string };
    selected: boolean;
    onPress: () => void;
  }) => {
    const initials = person.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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
        }}>{person.id === 'me' ? 'You' : person.name}</AppText>
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
        <View style={{ paddingTop: Spacing.sm, gap: 4 }}>
          <AppText variant="h2" style={{ color: accent }}>
            {isWoolworths ? '🛒 Woolworths' : '🍽️ Restaurant'}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 4 }}>
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
        </View>

        {/* Scan button */}
        <Pressable
          onPress={handleScan}
          disabled={scanning}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg,
            borderWidth: 1.5, borderColor: accent, borderStyle: 'dashed',
            backgroundColor: pressed ? accent + '15' : 'transparent',
            opacity: scanning ? 0.7 : 1,
          })}
        >
          {scanning
            ? <ActivityIndicator color={accent} />
            : <AppText style={{ fontSize: 20 }}>📷</AppText>
          }
          <AppText style={{ color: accent, fontWeight: FontWeight.semibold, fontSize: FontSize.md }}>
            {scanning ? 'Scanning receipt...' : 'Scan Receipt'}
          </AppText>
          {!scanning && (
            <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>tap to upload photo</AppText>
          )}
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

              {/* Product discount (Woolworths only) */}
              {isWoolworths && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>Product discount:</AppText>
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
                  <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>%</AppText>
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
                        onPress={() => {
                          if (isMe) {
                            // Toggle me: if currently only-me (assignedTo=[]), deselect = add 'me' as explicit false
                            if (item.assignedTo.length === 0) {
                              // me was implicit — now explicitly deselect
                              updateItem(item.id, { assignedTo: ['__none__'] });
                            } else {
                              toggleAssignee(item.id, 'me');
                            }
                          } else {
                            toggleAssignee(item.id, p.id);
                          }
                        }}
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

        {/* Discounts / fees */}
        <Card>
          <SectionHeader title={isWoolworths ? 'Discounts & Voucher' : 'Extra Fees'} />
          <View style={{ gap: Spacing.md }}>
            {isWoolworths && (
              <>
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
              </>
            )}

            {!isWoolworths && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 }}>
                  Delivery / Service / Tax
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
  if (assignedTo.length === allPeople.length ||
    (assignedTo.includes('me') && assignedTo.filter(x => x !== 'me').length === allPeople.length - 1)) {
    return 'Everyone splits equally';
  }
  const names = assignedTo.map(id => {
    if (id === 'me') return 'You';
    return allPeople.find(p => p.id === id)?.name ?? id;
  });
  return names.join(' + ');
}
