import React, { useState } from 'react';
import { View, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, Radius, FontSize } from '../theme';
import { getSplitwiseCurrentUser } from '../utils/splitwiseApi';

function KeyCard({
  title,
  description,
  linkLabel,
  linkUrl,
  placeholder,
  savedKey,
  onSave,
  onClear,
}: {
  title: string;
  description: string;
  linkLabel: string;
  linkUrl: string;
  placeholder: string;
  savedKey: string;
  onSave: (key: string) => void;
  onClear: () => void;
}) {
  const [input, setInput] = useState(savedKey);
  const [visible, setVisible] = useState(false);

  const masked = savedKey
    ? savedKey.slice(0, 6) + '••••••••••••' + savedKey.slice(-4)
    : '';

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) { Alert.alert('Empty key', 'Paste your key first.'); return; }
    onSave(trimmed);
    Alert.alert('Saved ✓', `${title} key saved.`);
  };

  const handleClear = () => {
    Alert.alert('Remove key', `Remove the ${title} key?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { onClear(); setInput(''); } },
    ]);
  };

  return (
    <Card>
      <SectionHeader title={title} />
      <View style={{ gap: Spacing.md }}>
        <AppText variant="bodySmall">
          {description}{' '}
          <AppText
            style={{ color: Colors.primary }}
            onPress={() => Linking.openURL(linkUrl)}
          >
            {linkLabel}
          </AppText>
        </AppText>

        {savedKey ? (
          <View style={{
            backgroundColor: Colors.surface, borderRadius: Radius.md,
            padding: Spacing.md, borderWidth: 1, borderColor: Colors.success + '66',
            flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
          }}>
            <AppText style={{ color: Colors.success, fontSize: FontSize.sm }}>✓</AppText>
            <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 }}>
              {masked}
            </AppText>
          </View>
        ) : (
          <View style={{
            backgroundColor: Colors.surface, borderRadius: Radius.md,
            padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
            flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
          }}>
            <AppText style={{ color: Colors.textMuted }}>🔑</AppText>
            <AppText style={{ color: Colors.textMuted, fontSize: FontSize.sm }}>No key saved</AppText>
          </View>
        )}

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={!visible}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            backgroundColor: Colors.surface, borderRadius: Radius.md,
            paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
            color: Colors.textPrimary, fontSize: FontSize.sm,
            borderWidth: 1, borderColor: Colors.border,
          }}
        />

        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <PillButton
            label={visible ? 'Hide' : 'Show'}
            onPress={() => setVisible(v => !v)}
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
          />
          <PillButton
            label="Save Key"
            onPress={handleSave}
            size="sm"
            style={{ flex: 2 }}
          />
          {savedKey ? (
            <PillButton
              label="Remove"
              onPress={handleClear}
              variant="danger"
              size="sm"
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export default function SettingsScreen() {
  const { geminiKey, setGeminiKey, splitwiseKey, setSplitwiseKey } = useStore();
  const [testingSpliwise, setTestingSplitwise] = useState(false);

  const handleTestSplitwise = async () => {
    if (!splitwiseKey) { Alert.alert('No key', 'Save your Splitwise key first.'); return; }
    setTestingSplitwise(true);
    try {
      const user = await getSplitwiseCurrentUser(splitwiseKey);
      Alert.alert('Connected ✓', `Logged in as ${user.first_name} ${user.last_name}`);
    } catch (e: any) {
      Alert.alert('Connection failed', e.message);
    } finally {
      setTestingSplitwise(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: 60 }}>

        <View style={{ paddingTop: Spacing.md }}>
          <AppText variant="h2">Settings</AppText>
        </View>

        {/* OpenAI Key */}
        <KeyCard
          title="🤖 AI Receipt Scanning"
          description="Paste your OpenAI API key to enable receipt scanning. Get one at"
          linkLabel="platform.openai.com/api-keys"
          linkUrl="https://platform.openai.com/api-keys"
          placeholder="sk-..."
          savedKey={geminiKey}
          onSave={setGeminiKey}
          onClear={() => setGeminiKey('')}
        />

        {/* Splitwise Key */}
        <KeyCard
          title="💚 Splitwise Integration"
          description="Add your Splitwise API key to push splits directly into Splitwise. Get one at"
          linkLabel="splitwise.com/apps/api"
          linkUrl="https://secure.splitwise.com/apps/api"
          placeholder="Paste Splitwise API key here..."
          savedKey={splitwiseKey}
          onSave={setSplitwiseKey}
          onClear={() => setSplitwiseKey('')}
        />

        {splitwiseKey ? (
          <PillButton
            label={testingSpliwise ? 'Connecting...' : 'Test Splitwise Connection'}
            onPress={handleTestSplitwise}
            variant="secondary"
            style={{ marginTop: -Spacing.sm }}
          />
        ) : null}

        {/* About */}
        <Card>
          <SectionHeader title="About" />
          <View style={{ gap: Spacing.xs }}>
            <AppText variant="bodySmall">SplitEasy — personal bill splitter</AppText>
            <AppText variant="caption">Version 1.1.0</AppText>
            <AppText variant="caption" style={{ marginTop: Spacing.xs }}>
              AI receipt scanning · Splitwise integration · Smart splits
            </AppText>
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}
