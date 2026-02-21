import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../src/lib/supabase';
import { authBootstrap, getProfile } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth';

export default function EmailScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Erreur', 'Email invalide');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Erreur', 'Mot de passe trop court (min 6 caractères)');
      return;
    }

    setIsLoading(true);
    setInfo(null);

    try {
      const authRes =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (authRes.error) {
        throw new Error(authRes.error.message);
      }

      // If email confirmation is required, Supabase returns session = null
      if (!authRes.data.session) {
        setInfo('Compte créé. Vérifie tes emails pour confirmer ton compte puis reconnecte-toi.');
        return;
      }

      const token = authRes.data.session.access_token;

      useAuthStore.getState().setAuth({
        profileId: authRes.data.session.user.id,
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KPATA AI</Text>
      <Text style={styles.subtitle}>Connexion par email</Text>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
          onPress={() => setMode('signin')}
          disabled={isLoading}
        >
          <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>Connexion</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
          onPress={() => setMode('signup')}
          disabled={isLoading}
        >
          <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>Inscription</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="ex: marc@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={[styles.input, styles.passwordInput]}
        placeholder="Mot de passe"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleSubmit} disabled={isLoading}>
        <Text style={styles.buttonText}>
          {isLoading ? '...' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
        </Text>
      </TouchableOpacity>

      {!!info && <Text style={styles.hint}>{info}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 8, color: '#111827' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, color: '#6B7280', fontWeight: '600' },
  modeRow: { flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 4, borderRadius: 12, marginBottom: 12 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#FFFFFF' },
  modeBtnText: { fontWeight: '800', color: '#9CA3AF' },
  modeBtnTextActive: { color: '#111827' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  passwordInput: { marginTop: 12 },
  button: { marginTop: 16, backgroundColor: '#0B63F3', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  hint: { marginTop: 16, textAlign: 'center', color: '#6B7280', fontWeight: '600' },
});
