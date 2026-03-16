import React, { useState } from 'react';
import {
  View, ScrollView, Pressable, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { AppText, Card, SectionHeader } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function SetupScreen() {
  const navigation = useNavigation<any>();
  const { friends, groups, saveGroup, removeGroup } = useStore();

  const [participants, setParticipants] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');

  const toggleFriend = (id: string) => {
    setParticipants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const selectGroup = (memberIds: string[]) => {
    setParticipants(memberIds);
  };

  const handleSaveGroup = () => {
    const name = groupName.trim();
    if (!name) { Alert.alert('Enter a group name'); return; }
    if (participants.length === 0) { Alert.alert('Select at least one friend first'); return; }
    saveGroup(name, participants);
    setGroupName('');
    setSavingGroup(false);
    Alert.alert('✅ Group saved', `"${name}" saved for quick use next time.`);
  };

  const confirmRemoveGroup = (id: string, name: string) => {
    Alert.alert('Remove Group', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeGroup(id) },
    ]);
  };

  const canContinue = true; // me is always included

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, paddingBottom: 120, gap: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ gap: 4 }}>
          <AppText style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary }}>
            New Split
          </AppText>
          <AppText style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>
            Who's splitting this bill?
          </AppText>
        </View>

        {/* Quick Groups */}
        {groups.length > 0 && (
          <View style={{ gap: Spacing.sm }}>
            <SectionHeader title="Quick Groups" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              {groups.map(g => {
                const isActive = JSON.stringify([...g.memberIds].sort()) === JSON.stringify([...participants].sort());
                const memberNames = g.memberIds
                  .map(id => friends.find(f => f.id === id)?.name)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(', ');
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => selectGroup(g.memberIds)}
                    onLongPress={() => confirmRemoveGroup(g.id, g.name)}
                    style={({ pressed }) => ({
                      paddingVertical: Spacing.sm,
                      paddingHorizontal: Spacing.md,
                      borderRadius: Radius.lg,
                      borderWidth: 1.5,
                      borderColor: isActive ? Colors.primary : Colors.border,
                      backgroundColor: isActive ? Colors.primary + '18' : Colors.cardAlt,
                      opacity: pressed ? 0.75 : 1,
                      gap: 2,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                      <AppText style={{
                        fontSize: FontSize.sm, fontWeight: FontWeight.bold,
                        color: isActive ? Colors.primary : Colors.textPrimary,
                      }}>
                        {g.name}
                      </AppText>
                      {isActive && (
                        <View style={{
                          width: 6, height: 6, borderRadius: 3,
                          backgroundColor: Colors.primary,
                        }} />
                      )}
                    </View>
                    <AppText style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>
                      You + {memberNames || `${g.memberIds.length} friends`}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* People selection */}
        <View style={{ gap: Spacing.sm }}>
          <SectionHeader title="Select People" />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {/* Me — always included, not toggleable */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
              paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md,
              borderRadius: Radius.full, borderWidth: 1.5,
              borderColor: Colors.primary, backgroundColor: Colors.primary + '20',
            }}>
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: Colors.primary,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <AppText style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.extrabold }}>
                  ME
                </AppText>
              </View>
              <AppText style={{ color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.sm }}>
                You
              </AppText>
              <AppText style={{ color: Colors.primary + '99', fontSize: 10 }}>✓</AppText>
            </View>

            {/* Friends */}
            {friends.map(f => {
              const selected = participants.includes(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggleFriend(f.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
                    paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md,
                    borderRadius: Radius.full, borderWidth: 1.5,
                    borderColor: selected ? f.color : Colors.border,
                    backgroundColor: selected ? f.color + '20' : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: selected ? f.color : Colors.surface,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AppText style={{
                      color: selected ? '#fff' : Colors.textMuted,
                      fontSize: FontSize.xs, fontWeight: FontWeight.extrabold,
                    }}>
                      {initials(f.name)}
                    </AppText>
                  </View>
                  <AppText style={{
                    color: selected ? f.color : Colors.textSecondary,
                    fontWeight: selected ? FontWeight.bold : FontWeight.regular,
                    fontSize: FontSize.sm,
                  }}>
                    {f.name}
                  </AppText>
                  {selected && (
                    <AppText style={{ color: f.color + '99', fontSize: 10 }}>✓</AppText>
                  )}
                </Pressable>
              );
            })}

            {friends.length === 0 && (
              <AppText style={{ color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic' }}>
                No friends yet — add some in the Friends tab
              </AppText>
            )}
          </View>

          {/* Save as Group */}
          {participants.length > 0 && !savingGroup && (
            <Pressable
              onPress={() => setSavingGroup(true)}
              style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
            >
              <AppText style={{ color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                + Save as group
              </AppText>
            </Pressable>
          )}

          {savingGroup && (
            <View style={{
              flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
              backgroundColor: Colors.cardAlt, borderRadius: Radius.md,
              padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
            }}>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Group name…"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                style={{
                  flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm,
                  fontWeight: FontWeight.medium,
                }}
              />
              <Pressable onPress={handleSaveGroup} style={{
                backgroundColor: Colors.primary, borderRadius: Radius.sm,
                paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
              }}>
                <AppText style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold }}>Save</AppText>
              </Pressable>
              <Pressable onPress={() => { setSavingGroup(false); setGroupName(''); }}>
                <AppText style={{ color: Colors.textMuted, fontSize: FontSize.md }}>✕</AppText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Selected summary */}
        {participants.length > 0 && (
          <View style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs,
            paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
            backgroundColor: Colors.primary + '10',
            borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary + '30',
          }}>
            <AppText style={{ color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
              Splitting with:
            </AppText>
            <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.xs }}>
              You{participants.map(id => {
                const f = friends.find(x => x.id === id);
                return f ? ` · ${f.name}` : '';
              }).join('')}
            </AppText>
          </View>
        )}

        {/* Continue button */}
        <Pressable
          onPress={() => navigation.navigate('BillEntry', { participants })}
          disabled={!canContinue}
          style={({ pressed }) => ({
            backgroundColor: Colors.primary,
            borderRadius: Radius.lg,
            paddingVertical: Spacing.md + 2,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          })}
        >
          <AppText style={{
            color: '#fff', fontSize: FontSize.md,
            fontWeight: FontWeight.bold, letterSpacing: 0.3,
          }}>
            Continue →
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
