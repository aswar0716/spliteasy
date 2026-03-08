import React, { useState } from 'react';
import {
  View, ScrollView, TextInput, Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { AppText, Card, PillButton, EmptyState, SectionHeader } from '../../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { Friend } from '../../types';

export default function FriendsScreen() {
  const { friends, addFriend, removeFriend, renameFriend } = useStore();
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => {
    const name = input.trim();
    if (!name) return;
    if (friends.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicate', `${name} is already in your list.`);
      return;
    }
    addFriend(name);
    setInput('');
  };

  const handleDelete = (friend: Friend) => {
    Alert.alert('Remove friend', `Remove ${friend.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriend(friend.id) },
    ]);
  };

  const handleEditSave = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    renameFriend(id, name);
    setEditing(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg }}>
        {/* Header */}
        <View style={{ paddingTop: Spacing.md }}>
          <AppText variant="h2">Friends</AppText>
          <AppText variant="bodySmall" style={{ marginTop: 4 }}>
            Manage who you split bills with
          </AppText>
        </View>

        {/* Add friend */}
        <Card>
          <SectionHeader title="Add new friend" />
          <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Friend's name..."
              placeholderTextColor={Colors.textMuted}
              style={{
                flex: 1,
                backgroundColor: Colors.surface,
                borderRadius: Radius.md,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                color: Colors.textPrimary,
                fontSize: FontSize.md,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <PillButton label="Add" onPress={handleAdd} size="md" style={{ minWidth: 70 }} />
          </View>
        </Card>

        {/* Friends list */}
        <View style={{ gap: Spacing.sm }}>
          <SectionHeader title={`${friends.length} friend${friends.length !== 1 ? 's' : ''}`} />
          {friends.length === 0 ? (
            <EmptyState icon="👥" title="No friends yet" subtitle="Add someone above to get started" />
          ) : (
            friends.map(friend => (
              <Card key={friend.id} variant="alt">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  {/* Avatar */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: friend.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText style={{ color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold }}>
                      {friend.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </AppText>
                  </View>

                  {/* Name / edit */}
                  {editing === friend.id ? (
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                      style={{
                        flex: 1,
                        color: Colors.textPrimary,
                        fontSize: FontSize.md,
                        borderBottomWidth: 1,
                        borderBottomColor: friend.color,
                        paddingVertical: 2,
                      }}
                      onSubmitEditing={() => handleEditSave(friend.id)}
                      returnKeyType="done"
                    />
                  ) : (
                    <AppText variant="body" style={{ flex: 1 }}>{friend.name}</AppText>
                  )}

                  {/* Actions */}
                  {editing === friend.id ? (
                    <Pressable onPress={() => handleEditSave(friend.id)} style={{ padding: Spacing.xs }}>
                      <AppText style={{ color: Colors.success, fontWeight: FontWeight.semibold }}>Save</AppText>
                    </Pressable>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      <Pressable
                        onPress={() => { setEditing(friend.id); setEditName(friend.name); }}
                        style={{ padding: Spacing.xs }}
                      >
                        <AppText style={{ color: Colors.primaryLight, fontSize: FontSize.sm }}>Edit</AppText>
                      </Pressable>
                      <Pressable onPress={() => handleDelete(friend)} style={{ padding: Spacing.xs }}>
                        <AppText style={{ color: Colors.danger, fontSize: FontSize.sm }}>Remove</AppText>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
