/**
 * Auth Layout for KPATA AI Mobile App
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="email" />
      <Stack.Screen name="callback" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="terms" />
    </Stack>
  );
}
