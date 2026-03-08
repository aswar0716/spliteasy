import React, { useState } from 'react';
import {
  View, ScrollView, TextInput, Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { AppText, Card, PillButton, SectionHeader, EmptyState } from '../../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { JournalEntry } from '../../types';

export default function JournalScreen() {
  const { journal, addJournalEntry, removeJournalEntry } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'dev' | 'personal'>('dev');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!body.trim()) { Alert.alert('Body required'); return; }
    addJournalEntry({ title: title.trim(), body: body.trim(), type });
    setTitle('');
    setBody('');
    setShowForm(false);
  };

  const handleDelete = (entry: JournalEntry) => {
    Alert.alert('Delete entry', `Delete "${entry.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeJournalEntry(entry.id) },
    ]);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const devEntries = journal.filter(j => j.type === 'dev');
  const personalEntries = journal.filter(j => j.type === 'personal');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ paddingTop: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <AppText variant="h2">Journal</AppText>
            <AppText variant="bodySmall" style={{ marginTop: 4 }}>Dev log & personal notes</AppText>
          </View>
          <PillButton
            label={showForm ? 'Cancel' : '+ New Entry'}
            onPress={() => setShowForm(v => !v)}
            variant={showForm ? 'secondary' : 'primary'}
            size="sm"
          />
        </View>

        {/* New entry form */}
        {showForm && (
          <Card>
            <View style={{ gap: Spacing.md }}>
              {/* Type toggle */}
              <View>
                <AppText variant="label" style={{ marginBottom: Spacing.sm }}>Entry Type</AppText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  {(['dev', 'personal'] as const).map(t => (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={{
                        flex: 1,
                        paddingVertical: Spacing.sm,
                        borderRadius: Radius.md,
                        borderWidth: 1.5,
                        borderColor: type === t ? Colors.primary : Colors.border,
                        backgroundColor: type === t ? Colors.primary + '22' : 'transparent',
                        alignItems: 'center',
                      }}
                    >
                      <AppText style={{
                        color: type === t ? Colors.primary : Colors.textSecondary,
                        fontWeight: FontWeight.semibold,
                        fontSize: FontSize.sm,
                      }}>
                        {t === 'dev' ? '💻 Dev Log' : '📝 Personal'}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Title */}
              <View>
                <AppText variant="label" style={{ marginBottom: Spacing.xs }}>Title</AppText>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Entry title..."
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

              {/* Body */}
              <View>
                <AppText variant="label" style={{ marginBottom: Spacing.xs }}>Notes</AppText>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Write your notes here..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: Radius.md,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    color: Colors.textPrimary,
                    fontSize: FontSize.md,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    minHeight: 120,
                  }}
                />
              </View>

              <PillButton label="Save Entry" onPress={handleSave} />
            </View>
          </Card>
        )}

        {/* Dev log entries */}
        <JournalSection
          title="Dev Log"
          icon="💻"
          entries={devEntries}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          onDelete={handleDelete}
          formatDate={formatDate}
          accentColor={Colors.primary}
        />

        {/* Personal entries */}
        <JournalSection
          title="Personal Notes"
          icon="📝"
          entries={personalEntries}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          onDelete={handleDelete}
          formatDate={formatDate}
          accentColor={Colors.success}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function JournalSection({
  title, icon, entries, expandedId, setExpandedId, onDelete, formatDate, accentColor,
}: {
  title: string;
  icon: string;
  entries: JournalEntry[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onDelete: (e: JournalEntry) => void;
  formatDate: (s: string) => string;
  accentColor: string;
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <SectionHeader title={`${icon} ${title} (${entries.length})`} />
      {entries.length === 0 ? (
        <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} subtitle="Tap '+ New Entry' above" />
      ) : (
        entries.map(entry => {
          const expanded = expandedId === entry.id;
          return (
            <Pressable
              key={entry.id}
              onPress={() => setExpandedId(expanded ? null : entry.id)}
            >
              <Card variant="alt" style={{ borderColor: expanded ? accentColor : Colors.border }}>
                <View style={{ gap: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body">{entry.title}</AppText>
                      <AppText variant="caption">{formatDate(entry.date)}</AppText>
                    </View>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                      <AppText style={{ color: Colors.textMuted, fontSize: FontSize.sm }}>
                        {expanded ? '▲' : '▼'}
                      </AppText>
                      <Pressable onPress={() => onDelete(entry)} style={{ padding: Spacing.xs }}>
                        <AppText style={{ color: Colors.danger, fontSize: FontSize.xs }}>Delete</AppText>
                      </Pressable>
                    </View>
                  </View>
                  {expanded && (
                    <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm }}>
                      <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 22 }}>
                        {entry.body}
                      </AppText>
                    </View>
                  )}
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
