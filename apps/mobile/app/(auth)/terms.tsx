/**
 * Terms Acceptance Screen for KPATA AI Mobile App
 */

import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { acceptTerms } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth';

export default function TermsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const setTermsAccepted = useAuthStore((state) => state.setTermsAccepted);

  const handleAccept = async () => {
    setIsLoading(true);
    const result = await acceptTerms();
    setIsLoading(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    setTermsAccepted(true);
    router.replace('/(tabs)/home');
  };

  const handleDecline = () => {
    Alert.alert(
      'Refuser les CGU',
      'Tu ne peux pas utiliser KPATA AI sans accepter les CGU.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conditions Générales</Text>
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.text}>
          En utilisant KPATA AI, tu acceptes :{'\n\n'}
          • Nos conditions d'utilisation{'\n'}
          • Notre politique de confidentialité{'\n'}
          • L'utilisation de tes images pour le traitement IA{'\n\n'}
          
          KPATA AI transforme tes photos de produits en visuels professionnels 
          pour les réseaux sociaux.{'\n\n'}
          
          Tes images sont traitées de manière sécurisée et ne sont pas partagées 
          avec des tiers sans ton consentement.{'\n\n'}
          
          Pour plus de détails, visite kpata.ai/cgu
        </Text>
      </ScrollView>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton, isLoading && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={isLoading}
        >
          <Text style={styles.acceptText}>
            {isLoading ? 'Chargement...' : '✅ J\'accepte'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.declineButton]} onPress={handleDecline}>
          <Text style={styles.declineText}>❌ Je refuse</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
    marginBottom: 24,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
  },
  buttons: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  acceptButton: {
    backgroundColor: '#6366F1',
  },
  acceptText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#F3F4F6',
  },
  declineText: {
    color: '#6B7280',
    fontSize: 16,
  },
});
