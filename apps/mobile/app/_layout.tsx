/**
 * Root Layout for KPATA AI Mobile App
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth';

export default function RootLayout() {
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#6366F1' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Détails du job' }} />
        <Stack.Screen name="result/[id]" options={{ title: 'Résultat' }} />
        <Stack.Screen name="mannequin" options={{ title: 'Mon Mannequin' }} />
        <Stack.Screen name="support" options={{ title: 'Support' }} />
      </Stack>
    </>
  );
}
