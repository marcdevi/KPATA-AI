import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/auth';
import { authBootstrap, getProfile } from '../../src/services/api';

export default function CallbackScreen() {
  const url = Linking.useURL();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        if (!url) return;

        const parsed = Linking.parse(url);
        const code = (parsed.queryParams?.code as string | undefined) || undefined;
        const hash = url.includes('#') ? url.split('#')[1] : '';
        const hashParams = new URLSearchParams(hash);

        let sessionData:
          | { session: null; user: null }
          | { session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>; user: any };

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.session) {
            throw new Error(error?.message || 'Session invalide');
          }
          sessionData = { session: data.session, user: data.session.user };
        } else {
          const access_token =
            (parsed.queryParams?.access_token as string | undefined) ||
            hashParams.get('access_token') ||
            undefined;
          const refresh_token =
            (parsed.queryParams?.refresh_token as string | undefined) ||
            hashParams.get('refresh_token') ||
            undefined;

          if (!access_token || !refresh_token) {
            throw new Error('Tokens manquants dans le lien de connexion');
          }

          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error || !data.session) {
            throw new Error(error?.message || 'Session invalide');
          }

          sessionData = { session: data.session, user: data.session.user };
        }

        const token = sessionData.session.access_token;

        // Set token early so API calls include Authorization header
        useAuthStore.getState().setAuth({
          profileId: sessionData.user.id,
          phoneE164: null,
          role: null,
          hasAcceptedTerms: false,
          token,
        });

        const boot = await authBootstrap();
        if (boot.error) {
          throw new Error(boot.error.message);
        }

        const me = await getProfile();
        if (me.error || !me.data) {
          throw new Error(me.error?.message || 'Impossible de charger le profil');
        }

        const hasAcceptedTerms = !!me.data.profile.termsAcceptedAt;

        useAuthStore.getState().setAuth({
          profileId: me.data.profile.id,
          phoneE164: me.data.profile.phone ?? null,
          role: me.data.profile.role,
          hasAcceptedTerms,
          token,
        });
        useAuthStore.getState().setCredits(me.data.credits.balance);

        if (hasAcceptedTerms) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/(auth)/terms');
        }
      } catch (e) {
        Alert.alert('Erreur', String(e));
        router.replace('/(auth)/email');
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [url]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <>
          <ActivityIndicator size="large" color="#0B63F3" />
          <Text style={styles.text}>Connexion...</Text>
        </>
      ) : (
        <Text style={styles.text}>OK</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { marginTop: 12, color: '#111827', fontWeight: '700' },
});
