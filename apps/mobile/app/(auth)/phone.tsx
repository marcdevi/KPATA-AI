/**
 * Phone OTP Screen for KPATA AI Mobile App
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { sendOtp, verifyOtp, devLogin } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth';

const DEV_GUEST_ENABLED = Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_DEV_GUEST === 'true' ||
  process.env.EXPO_PUBLIC_ENABLE_DEV_GUEST === 'true';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const setCredits = useAuthStore((state) => state.setCredits);

  const handleDevLogin = async () => {
    setIsLoading(true);
    const result = await devLogin();
    setIsLoading(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    if (result.data) {
      setAuth({
        profileId: result.data.profile.id,
        phoneE164: result.data.profile.phone,
        role: result.data.profile.role as 'user_free' | 'user_pro' | 'admin',
        hasAcceptedTerms: true,
        token: result.data.token,
      });
      setCredits(result.data.credits);
      router.replace('/(tabs)/home');
    }
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 8) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide');
      return;
    }

    setIsLoading(true);
    const phoneE164 = phone.startsWith('+') ? phone : `+225${phone}`;
    
    const result = await sendOtp(phoneE164, channel);
    setIsLoading(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    if (!code || code.length < 4) {
      Alert.alert('Erreur', 'Code invalide');
      return;
    }

    setIsLoading(true);
    const phoneE164 = phone.startsWith('+') ? phone : `+225${phone}`;
    
    const result = await verifyOtp(phoneE164, code);
    setIsLoading(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    if (result.data) {
      setAuth({
        profileId: result.data.profile.id,
        phoneE164,
        role: 'user_free',
        hasAcceptedTerms: result.data.hasAcceptedTerms,
      });

      if (result.data.hasAcceptedTerms) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/terms');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KPATA AI</Text>
      <Text style={styles.subtitle}>
        {step === 'phone' 
          ? 'Entre ton numéro de téléphone' 
          : 'Entre le code reçu'}
      </Text>

      {step === 'phone' ? (
        <>
          <View style={styles.inputContainer}>
            <Text style={styles.prefix}>+225</Text>
            <TextInput
              style={styles.input}
              placeholder="XX XX XX XX XX"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={15}
            />
          </View>

          <View style={styles.channelContainer}>
            <TouchableOpacity
              style={[styles.channelBtn, channel === 'sms' && styles.channelActive]}
              onPress={() => setChannel('sms')}
            >
              <Text style={[styles.channelText, channel === 'sms' && styles.channelTextActive]}>
                📱 SMS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.channelBtn, channel === 'whatsapp' && styles.channelActive]}
              onPress={() => setChannel('whatsapp')}
            >
              <Text style={[styles.channelText, channel === 'whatsapp' && styles.channelTextActive]}>
                💬 WhatsApp
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Envoi...' : 'Recevoir le code'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.codeInput}
            placeholder="• • • • • •"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
            textAlign="center"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Vérification...' : 'Vérifier'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('phone')}>
            <Text style={styles.linkText}>← Changer de numéro</Text>
          </TouchableOpacity>
        </>
      )}

      {DEV_GUEST_ENABLED && (
        <TouchableOpacity
          style={styles.devButton}
          onPress={handleDevLogin}
          disabled={isLoading}
        >
          <Text style={styles.devButtonText}>🧪 Mode test</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366F1',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  prefix: {
    fontSize: 18,
    color: '#666',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 16,
  },
  codeInput: {
    fontSize: 32,
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  channelContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  channelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  channelActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  channelText: {
    fontSize: 14,
    color: '#666',
  },
  channelTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkText: {
    color: '#6366F1',
    textAlign: 'center',
    fontSize: 14,
  },
  devButton: {
    marginTop: 32,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  devButtonText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
});
