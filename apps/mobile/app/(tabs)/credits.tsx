/**
 * Credits Screen for KPATA AI Mobile App
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, SafeAreaView, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../../src/store/auth';
import { getCreditPacks, initPayment, getProfile, verifyPaystack } from '../../src/services/api';

interface CreditPack {
  id: string;
  code: string;
  name: string;
  credits: number;
  price_xof: number;
  active?: boolean;
}

export default function CreditsScreen() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackCode, setSelectedPackCode] = useState<string | null>(null);
  const [pendingVerifyRef, setPendingVerifyRef] = useState<string | null>(null);
  const pendingVerifyRefRef = useRef<string | null>(null);
  const pollingRef = useRef(false);
  const { credits, setCredits } = useAuthStore();

  useEffect(() => {
    loadPacks();
    refreshCredits();
  }, []);

  useEffect(() => {
    pendingVerifyRefRef.current = pendingVerifyRef;
  }, [pendingVerifyRef]);

  const pollVerify = async (reference: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    try {
      setIsLoading(true);

      const start = Date.now();
      while (Date.now() - start < 120000) {
        const v = await verifyPaystack(reference);
        console.log('[Paystack] verify', { reference, data: v.data, error: v.error });

        if (v.data?.status === 'succeeded') {
          await refreshCredits();
          setPendingVerifyRef(null);
          setIsLoading(false);
          Alert.alert('Paiement confirmé', 'Tes crédits ont été ajoutés.');
          return;
        }

        if (v.data?.status === 'failed' || v.data?.status === 'canceled') {
          setPendingVerifyRef(null);
          setIsLoading(false);
          Alert.alert('Paiement non validé', 'Le paiement n’a pas été confirmé.');
          return;
        }

        await new Promise((r) => setTimeout(r, 2500));
      }

      setIsLoading(false);
      Alert.alert('Paiement en cours', 'Si tu as payé, les crédits seront ajoutés sous peu.');
    } finally {
      pollingRef.current = false;
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const ref = pendingVerifyRefRef.current;
        if (ref) {
          // Give Paystack a moment to finalize before first verify
          setTimeout(() => {
            void pollVerify(ref);
          }, 1500);
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const loadPacks = async () => {
    const result = await getCreditPacks();
    if (result.data) {
      const active = result.data.packs.filter((p) => (p as unknown as { active?: boolean }).active !== false);
      setPacks(active as unknown as CreditPack[]);
      if (!selectedPackCode && (active[0] as unknown as { code?: string })?.code) {
        setSelectedPackCode((active[0] as unknown as { code: string }).code);
      }
    }
  };

  const refreshCredits = async () => {
    const result = await getProfile();
    if (result.data) {
      setCredits(result.data.credits.balance);
    }
  };

  const handleBuyPack = async (packCode: string, provider: 'paystack') => {
    setIsLoading(true);
    const result = await initPayment(packCode, provider);
    setIsLoading(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    const redirectUrl = result.data?.redirectUrl;
    const providerRef = result.data?.payment?.providerRef;

    if (!redirectUrl || !providerRef) {
      Alert.alert('Erreur', 'URL Paystack manquante');
      return;
    }

    const canOpen = await Linking.canOpenURL(redirectUrl);
    if (!canOpen) {
      Alert.alert('Erreur', 'Impossible d’ouvrir Paystack');
      return;
    }

    await Linking.openURL(redirectUrl);

    // Start verification only when the user returns to the app (AppState active)
    setPendingVerifyRef(providerRef);
  };

  const formatPrice = (price: number) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  };

  const isPopularPack = (pack: CreditPack) => {
    if (pack.credits === 10) return true;
    if (pack.name?.toLowerCase().includes('pop')) return true;
    return false;
  };

  const selectedPack = packs.find((p) => p.code === selectedPackCode) || null;

  const buyWithProvider = async () => {
    if (!selectedPackCode) {
      Alert.alert('Choix requis', 'Sélectionne un pack de crédits avant de payer.');
      return;
    }
    await handleBuyPack(selectedPackCode, 'paystack');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Portefeuille</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde actuel</Text>
          <Text style={styles.balanceValue}>{credits} Crédits</Text>
          <View style={styles.balanceHintPill}>
            <Text style={styles.balanceHintText}>1 crédit = 1 génération</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recharger des crédits</Text>

        <View style={styles.packsList}>
          {packs.map((pack) => {
            const active = selectedPackCode === pack.code;
            return (
              <TouchableOpacity
                key={pack.code}
                style={[styles.packRow, active && styles.packRowActive]}
                onPress={() => setSelectedPackCode(pack.code)}
                disabled={isLoading}
              >
                <View style={styles.packLeft}>
                  <Text style={styles.packTitle}>{pack.credits} Crédits</Text>
                  <Text style={styles.packSubtitle}>{formatPrice(pack.price_xof)}</Text>
                </View>

                <View style={styles.packRight}>
                  {isPopularPack(pack) && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>POPULAIRE</Text>
                    </View>
                  )}
                  <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Payer avec</Text>
        <View style={styles.providersRow}>
          <TouchableOpacity
            style={[styles.providerCard, styles.providerWave]}
            onPress={() => buyWithProvider()}
            disabled={isLoading || !selectedPack}
          >
            <View style={styles.providerIconWrap}>
              <Ionicons name="water-outline" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.providerText}>Paystack</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Historique</Text>
        <View style={styles.historyList}>
          <View style={styles.historyRow}>
            <View style={[styles.historyIcon, styles.historyIconSuccess]}>
              <Ionicons name="arrow-down" size={18} color="#16A34A" />
            </View>
            <View style={styles.historyCenter}>
              <Text style={styles.historyTitle}>+10 Crédits</Text>
              <Text style={styles.historySub}>Aujourd'hui, 10:23</Text>
            </View>
            <Text style={styles.historyAmount}>2 500 F</Text>
          </View>

          <View style={styles.historyRow}>
            <View style={[styles.historyIcon, styles.historyIconFail]}>
              <Ionicons name="close" size={18} color="#EF4444" />
            </View>
            <View style={styles.historyCenter}>
              <Text style={styles.historyTitleMuted}>Échec</Text>
              <Text style={styles.historySub}>Hier, 18:45</Text>
            </View>
            <Text style={styles.historyAmountMuted}>1500 F</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  screenTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 14 },

  balanceCard: {
    backgroundColor: '#0B63F3',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0B63F3',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  balanceLabel: { color: '#D7E6FF', fontSize: 14, fontWeight: '600' },
  balanceValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', marginTop: 8 },
  balanceHintPill: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  balanceHintText: { color: '#EAF2FF', fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12, marginTop: 6 },

  packsList: { gap: 12 },
  packRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packRowActive: { borderColor: '#0B63F3', backgroundColor: '#EEF4FF' },
  packLeft: { gap: 6 },
  packTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  packSubtitle: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  packRight: { alignItems: 'flex-end', gap: 8 },
  popularBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  popularBadgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },

  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: '#0B63F3' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0B63F3' },

  providersRow: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  providerCard: { flex: 1, borderRadius: 12, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  providerWave: { backgroundColor: '#22C1F6' },
  providerOrange: { backgroundColor: '#FF7A00' },
  providerIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  providerText: { color: '#FFFFFF', fontWeight: '900' },

  historyList: { gap: 12 },
  historyRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  historyIconSuccess: { backgroundColor: '#DCFCE7' },
  historyIconFail: { backgroundColor: '#FEE2E2' },
  historyCenter: { flex: 1, gap: 4 },
  historyTitle: { fontWeight: '900', color: '#111827' },
  historyTitleMuted: { fontWeight: '900', color: '#6B7280' },
  historySub: { color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  historyAmount: { fontWeight: '900', color: '#111827' },
  historyAmountMuted: { fontWeight: '900', color: '#9CA3AF', textDecorationLine: 'line-through' },

  bottomSpacer: { height: 24 },
});
