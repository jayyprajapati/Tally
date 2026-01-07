import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeDatabase } from '@/lib/db/subscriptions';
import { colors } from '@/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accentPrimary,
    background: colors.backgroundSecondary,
    card: colors.backgroundPrimary,
    text: colors.textPrimary,
    border: colors.borderSubtle,
    notification: colors.accentPrimary,
  },
};

export default function RootLayout() {
  useEffect(() => {
    initializeDatabase().catch((error) => {
      console.warn('Failed to initialize database', error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={LightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-subscription" options={{ title: 'Add Subscription', presentation: 'modal' }} />
          <Stack.Screen name="linked-accounts" options={{ title: 'Linked Accounts' }} />
          <Stack.Screen name="linked-cards" options={{ title: 'Linked Cards' }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
