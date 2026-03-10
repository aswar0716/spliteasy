import React, { useState } from 'react';
import { View, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { AppText, Card, PillButton, SectionHeader } from '../components';
import { Colors, Spacing, Radius, FontSize } from '../theme';

export default function SettingsScreen() {
  const { geminiKey, setGeminiKey } = useStore();
  const [keyInput, setKeyInput] = useState(geminiKey);
  const [visible, setVisible] = useState(false);

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert('Empty key', 'Paste your OpenAI API key first.');
      return;
    }
    setGeminiKey(trimmed);
    Alert.alert('Saved', 'OpenAI API key saved successfully.');
  };

  const handleClear = () => {
    Alert.alert('Remove key', 'Remove the saved API key?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          setGeminiKey('');
          setKeyInput('');
        },
      },
    ]);
  };

  const maskedKey = geminiKey
    ? geminiKey.slice(0, 6) + '••••••••••••' + geminiKey.slice(-4)
    : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg }}>

        <View style={{ paddingTop: Spacing.md }}>
          <AppText variant="h2">Settings</AppText>
        </View>

        {/* Gemini API Key */}
        <Card>
          <SectionHeader title="🤖 AI Receipt Scanning" />
          <View style={{ gap: Spacing.md }}>
            <AppText variant="bodySmall">
              Paste your OpenAI API key to enable receipt photo scanning.
              Get one at{' '}
              <AppText style={{ color: Colors.primary }}>platform.openai.com/api-keys</AppText>
            </AppText>

            {geminiKey ? (
              <View style={{
                backgroundColor: Colors.surface, borderRadius: Radius.md,
                padding: Spacing.md, borderWidth: 1, borderColor: Colors.success + '66',
                flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
              }}>
                <AppText style={{ color: Colors.success, fontSize: FontSize.sm }}>✓</AppText>
                <AppText style={{ color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 }}>
                  {maskedKey}
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
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="Paste OpenAI API key here (sk-...)..."
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
              {geminiKey ? (
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

        {/* About */}
        <Card>
          <SectionHeader title="About" />
          <View style={{ gap: Spacing.xs }}>
            <AppText variant="bodySmall">SplitEasy — personal bill splitter</AppText>
            <AppText variant="caption">Version 1.0.0</AppText>
            <AppText variant="caption" style={{ marginTop: Spacing.xs }}>
              Woolworths splits, restaurant proportional fees, AI receipt scanning.
            </AppText>
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}
