import React, { useState } from 'react';
import {
  View, ScrollView, TextInput, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import { AppText, Card, PillButton, FriendChip, AmountInput, SectionHeader, EmptyState } from '../../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { RestaurantItem, RestaurantSession } from '../../types';
import { calculateRestaurantSplit } from '../../utils/splitCalculator';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function RestaurantScreen() {
  const navigation = useNavigation<any>();
  const { friends, addHistory } = useStore();

  const [sessionLabel, setSessionLabel] = useState('');
  const [extraFees, setExtraFees] = useState('0');
  const [items, setItems] = useState<RestaurantItem[]>([]);

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
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
    if (!name) { Alert.alert('Name required'); return; }
    if (isNaN(price) || price <= 0) { Alert.alert('Invalid price'); return; }

    setItems(prev => [
      ...prev,
      { id: genId(), name, price, assignedTo },
    ]);
    setItemName('');
    setItemPrice('');
    setAssignedTo([]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const handleCalculate = () => {
    if (items.length === 0) {
      Alert.alert('No items', 'Add at least one item first.');
      return;
    }

    const label = sessionLabel.trim() || `Restaurant · ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;

    const session: RestaurantSession = {
      id: genId(),
      date: new Date().toISOString(),
      label,
      items,
      extraFees: parseFloat(extraFees) || 0,
    };

    const result = calculateRestaurantSplit(session, friendMap);

    addHistory({
      id: session.id,
      date: session.date,
      label,
      type: 'restaurant',
      grandTotal: result.grandTotal,
      splits: result.splits,
    });

    navigation.navigate('Summary', { result: JSON.stringify(result), label });
  };

  const assignedLabel = (item: RestaurantItem) => {
    if (item.assignedTo.length === 0) return 'Me only';
    if (item.assignedTo.length > 1) return `Shared (${item.assignedTo.map(id => friendMap[id] ?? id).join(', ')})`;
    return friendMap[item.assignedTo[0]] ?? item.assignedTo[0];
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingTop: Spacing.sm }}>
          <AppText variant="h2" style={{ color: Colors.orange }}>🍽️ Restaurant / DoorDash</AppText>
          <AppText variant="bodySmall" style={{ marginTop: 4 }}>
            Extra fees are split proportionally by item cost
          </AppText>
        </View>

        {/* Session info */}
        <Card>
          <SectionHeader title="Session" />
          <View style={{ gap: Spacing.md }}>
            <View>
              <AppText variant="label" style={{ marginBottom: Spacing.xs }}>Label (optional)</AppText>
              <TextInput
                value={sessionLabel}
                onChangeText={setSessionLabel}
                placeholder="e.g. Dinner at Nando's"
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
            <AmountInput
              label="Extra Fees (delivery / service / tax)"
              value={extraFees}
              onChangeText={setExtraFees}
              placeholder="0"
            />
          </View>
        </Card>

        {/* Add item */}
        <Card>
          <SectionHeader title="Add Item" />
          <View style={{ gap: Spacing.md }}>
            <View>
              <AppText variant="label" style={{ marginBottom: Spacing.xs }}>Item Name</AppText>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g. Burger, Fries..."
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

            <AmountInput
              label="Price"
              value={itemPrice}
              onChangeText={setItemPrice}
            />

            {friends.length > 0 && (
              <View>
                <AppText variant="label" style={{ marginBottom: Spacing.sm }}>
                  Who ordered this? (leave empty = me only)
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

            <PillButton label="+ Add Item" onPress={addItem} variant="ghost" style={{ borderColor: Colors.orange }} />
          </View>
        </Card>

        {/* Items list */}
        <View style={{ gap: Spacing.sm }}>
          <SectionHeader title={`${items.length} item${items.length !== 1 ? 's' : ''}`} />
          {items.length === 0 ? (
            <EmptyState icon="🍴" title="No items yet" subtitle="Add what everyone ordered" />
          ) : (
            items.map(item => (
              <Card key={item.id} variant="alt">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body">{item.name}</AppText>
                    <AppText variant="bodySmall">${item.price.toFixed(2)}</AppText>
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

        <PillButton
          label="Calculate Split"
          onPress={handleCalculate}
          size="lg"
          style={{ marginTop: Spacing.md, borderColor: Colors.orange }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
