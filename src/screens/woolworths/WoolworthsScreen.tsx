import React, { useState } from 'react';
import {
  View, ScrollView, TextInput, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import { AppText, Card, PillButton, FriendChip, AmountInput, SectionHeader, EmptyState } from '../../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { WoolworthsItem, WoolworthsSession } from '../../types';
import { calculateWoolworthsSplit } from '../../utils/splitCalculator';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function WoolworthsScreen() {
  const navigation = useNavigation<any>();
  const { friends, addHistory } = useStore();

  const [storeDiscount, setStoreDiscount] = useState<5 | 10>(5);
  const [voucher, setVoucher] = useState('0');
  const [items, setItems] = useState<WoolworthsItem[]>([]);

  // new item form state
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDiscount, setItemDiscount] = useState('0');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  const friendMap = Object.fromEntries(friends.map(f => [f.id, f.name]));

  const toggleFriend = (id: string) => {
    setAssignedTo(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const addItem = () => {
    const name = itemName.trim();
    const price = parseFloat(itemPrice);
    if (!name) { Alert.alert('Name required', 'Please enter an item name.'); return; }
    if (isNaN(price) || price <= 0) { Alert.alert('Invalid price', 'Enter a valid price.'); return; }

    setItems(prev => [
      ...prev,
      {
        id: genId(),
        name,
        originalPrice: price,
        productDiscount: parseFloat(itemDiscount) || 0,
        assignedTo,
      },
    ]);
    setItemName('');
    setItemPrice('');
    setItemDiscount('0');
    setAssignedTo([]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleCalculate = () => {
    if (items.length === 0) {
      Alert.alert('No items', 'Add at least one item before calculating.');
      return;
    }

    const session: WoolworthsSession = {
      id: genId(),
      date: new Date().toISOString(),
      storeDiscount,
      voucher: parseFloat(voucher) || 0,
      items,
    };

    const result = calculateWoolworthsSplit(session, friendMap);

    // Save to history
    const label = `Woolworths · ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
    addHistory({
      id: session.id,
      date: session.date,
      label,
      type: 'woolworths',
      grandTotal: result.grandTotal,
      splits: result.splits,
    });

    navigation.navigate('Summary', { result: JSON.stringify(result), label });
  };

  const assignedLabel = (item: WoolworthsItem) => {
    if (item.assignedTo.length === 0) return 'Me only';
    return item.assignedTo.map(id => friendMap[id] ?? id).join(', ');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ paddingTop: Spacing.sm }}>
          <AppText variant="h2" style={{ color: Colors.info }}>🛒 Woolworths</AppText>
          <AppText variant="bodySmall" style={{ marginTop: 4 }}>
            Add items, assign to people, and calculate
          </AppText>
        </View>

        {/* Store settings */}
        <Card>
          <SectionHeader title="Store Settings" />
          <View style={{ gap: Spacing.md }}>
            {/* Store discount toggle */}
            <View>
              <AppText variant="label" style={{ marginBottom: Spacing.sm }}>Store Discount</AppText>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {([5, 10] as const).map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setStoreDiscount(d)}
                    style={{
                      flex: 1,
                      paddingVertical: Spacing.sm,
                      borderRadius: Radius.md,
                      borderWidth: 1.5,
                      borderColor: storeDiscount === d ? Colors.info : Colors.border,
                      backgroundColor: storeDiscount === d ? Colors.info + '22' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <AppText style={{
                      color: storeDiscount === d ? Colors.info : Colors.textSecondary,
                      fontWeight: FontWeight.semibold,
                      fontSize: FontSize.md,
                    }}>
                      {d}% off
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Voucher */}
            <AmountInput
              label="Voucher / Reward ($)"
              value={voucher}
              onChangeText={setVoucher}
              placeholder="0"
            />
          </View>
        </Card>

        {/* Add item */}
        <Card>
          <SectionHeader title="Add Item" />
          <View style={{ gap: Spacing.md }}>
            {/* Item name */}
            <View>
              <AppText variant="label" style={{ marginBottom: Spacing.xs }}>Item Name</AppText>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g. Chicken breast"
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.md,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  color: Colors.textPrimary,
                  fontSize: FontSize.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              />
            </View>

            {/* Price + product discount */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <AmountInput
                label="Original Price"
                value={itemPrice}
                onChangeText={setItemPrice}
                style={{ flex: 2 }}
              />
              <AmountInput
                label="Product Discount"
                value={itemDiscount}
                onChangeText={setItemDiscount}
                prefix=""
                suffix="%"
                placeholder="0"
                style={{ flex: 1 }}
              />
            </View>

            {/* Assign to */}
            {friends.length > 0 && (
              <View>
                <AppText variant="label" style={{ marginBottom: Spacing.sm }}>
                  Assign To (leave empty = me only)
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
                  {friends.map(f => (
                    <FriendChip
                      key={f.id}
                      name={f.name}
                      color={f.color}
                      selected={assignedTo.includes(f.id)}
                      onPress={() => toggleFriend(f.id)}
                      size="sm"
                    />
                  ))}
                </View>
              </View>
            )}

            <PillButton label="+ Add Item" onPress={addItem} variant="ghost" />
          </View>
        </Card>

        {/* Items list */}
        <View style={{ gap: Spacing.sm }}>
          <SectionHeader title={`${items.length} item${items.length !== 1 ? 's' : ''}`} />
          {items.length === 0 ? (
            <EmptyState icon="🛍️" title="No items yet" subtitle="Add items above" />
          ) : (
            items.map(item => (
              <Card key={item.id} variant="alt">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body">{item.name}</AppText>
                    <AppText variant="bodySmall">
                      ${item.originalPrice.toFixed(2)}
                      {item.productDiscount > 0 ? ` · ${item.productDiscount}% off` : ''}
                    </AppText>
                    <AppText style={{ color: Colors.textMuted, fontSize: FontSize.xs }}>
                      → {assignedLabel(item)}
                    </AppText>
                  </View>
                  <Pressable onPress={() => removeItem(item.id)} style={{ padding: Spacing.xs }}>
                    <AppText style={{ color: Colors.danger, fontSize: FontSize.sm }}>✕</AppText>
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Calculate button */}
        <PillButton
          label="Calculate Split"
          onPress={handleCalculate}
          size="lg"
          style={{ marginTop: Spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
