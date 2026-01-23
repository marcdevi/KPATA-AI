/**
 * Credits Screen for KPATA AI Mobile App
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '../../src/store/auth';
import { getCreditPacks, initPayment, getProfile } from '../../src/services/api';

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_xof: number;
}

export default function CreditsScreen() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { credits, setCredits } = useAuthStore();

  useEffect(() => {
    loadPacks();
    refreshCredits();
  }, []);

  const loadPacks = async () => {
    const result = await getCreditPacks();
    if (result.data) {
      setPacks(result.data.packs.filter((p) => p.active));
    }
  };

  const refreshCredits = async () => {
    const result = await getProfile();
    if (result.data) {
      setCredits(result.data.credits.balance);
    }
  };

  const handleBuyPack = async (packId: string, provider: 'orange_money' | 'mtn_momo' | 'wave') => {
    setIsLoading(true);
    const result = await initPayment(packId, provider);
    setIsLoading(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    Alert.alert('Paiement initié', 'Suis les instructions sur ton téléphone pour finaliser le paiement.');
  };

  const formatPrice = (price: number) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde actuel</Text>
        <Text style={styles.balanceValue}>{credits}</Text>
        <Text style={styles.balanceUnit}>crédits</Text>
      </View>

      <Text style={styles.sectionTitle}>Acheter des crédits</Text>

      {packs.map((pack) => (
        <View key={pack.id} style={styles.packCard}>
          <View style={styles.packInfo}>
            <Text style={styles.packName}>{pack.name}</Text>
            <Text style={styles.packCredits}>{pack.credits} crédits</Text>
            <Text style={styles.packPrice}>{formatPrice(pack.price_xof)}</Text>
          </View>
          <View style={styles.paymentButtons}>
            <TouchableOpacity
              style={[styles.payBtn, styles.orangeBtn]}
              onPress={() => handleBuyPack(pack.id, 'orange_money')}
              disabled={isLoading}
            >
              <Text style={styles.payBtnText}>Orange</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payBtn, styles.mtnBtn]}
              onPress={() => handleBuyPack(pack.id, 'mtn_momo')}
              disabled={isLoading}
            >
              <Text style={styles.payBtnText}>MTN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payBtn, styles.waveBtn]}
              onPress={() => handleBuyPack(pack.id, 'wave')}
              disabled={isLoading}
            >
              <Text style={styles.payBtnText}>Wave</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.note}>1 crédit = 1 photo transformée</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  balanceCard: { backgroundColor: '#6366F1', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24 },
  balanceLabel: { color: '#C7D2FE', fontSize: 14 },
  balanceValue: { color: '#fff', fontSize: 48, fontWeight: 'bold' },
  balanceUnit: { color: '#C7D2FE', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  packCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 12 },
  packInfo: { marginBottom: 12 },
  packName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  packCredits: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  packPrice: { fontSize: 20, fontWeight: 'bold', color: '#6366F1', marginTop: 4 },
  paymentButtons: { flexDirection: 'row', gap: 8 },
  payBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  orangeBtn: { backgroundColor: '#F97316' },
  mtnBtn: { backgroundColor: '#FBBF24' },
  waveBtn: { backgroundColor: '#3B82F6' },
  note: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 16, marginBottom: 32 },
});
