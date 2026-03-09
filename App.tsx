import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import HomeScreen from './src/screens/HomeScreen';
import SetupScreen from './src/screens/SetupScreen';
import BillEntryScreen from './src/screens/BillEntryScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import HistoryScreen from './src/screens/history/HistoryScreen';
import FriendsScreen from './src/screens/friends/FriendsScreen';
import JournalScreen from './src/screens/journal/JournalScreen';
import SettingsScreen from './src/screens/SettingsScreen';

import { useStore } from './src/store';
import { Colors, FontSize } from './src/theme';
import { AppText } from './src/components';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Friends: '👥',
  History: '📜',
  Journal: '📓',
  Settings: '⚙️',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabel: ({ color }) => (
          <AppText style={{ color, fontSize: FontSize.xs }}>{route.name}</AppText>
        ),
        tabBarIcon: () => (
          <AppText style={{ fontSize: 22 }}>{TAB_ICONS[route.name] ?? '•'}</AppText>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: '',
        cardStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Stack.Screen name="Home" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Setup" component={SetupScreen} options={{ title: 'New Split' }} />
      <Stack.Screen name="BillEntry" component={BillEntryScreen} options={{ title: 'Add Items' }} />
      <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Split Summary' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const hydrate = useStore(s => s.hydrate);
  const hydrated = useStore(s => s.hydrated);

  useEffect(() => { hydrate(); }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <AppText style={{ fontSize: 48 }}>💸</AppText>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
