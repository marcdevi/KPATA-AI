/**
 * Result Screen for KPATA AI Mobile App
 * Display 2 formats + download/share + change options
 */

import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, SafeAreaView, Animated, Easing } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { getJob } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth';
import { Ionicons } from '@expo/vector-icons';

interface Asset {
  id: string;
  type: string;
  width: number;
  height: number;
  metadata?: {
    format?: string;
    variant?: string;
    url?: string;
  };
}

interface Job {
  id: string;
  status: string;
  category: string;
  background_style: string;
}

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { credits } = useAuthStore();
  const [selectedFormat, setSelectedFormat] = useState<'whatsapp' | 'instagram'>('whatsapp');

  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const spin = useState(() => new Animated.Value(0))[0];
  const pulse = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    loadJobData();
    
    // Poll every 2 seconds if job is not completed or no assets
    const interval = setInterval(() => {
      if (job?.status !== 'completed' || assets.length === 0) {
        loadJobData();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [id, job?.status, assets.length]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [spin, pulse]);

  const loadJobData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getJob(id);
      
      if (response.error) {
        setError(response.error.message);
        return;
      }
      
      if (response.data) {
        setJob(response.data.job);
        setAssets(response.data.assets || []);
      }
    } catch (err) {
      setError('Impossible de charger les données du job');
      console.error('Failed to load job:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getAssetUrl = (type: string): string | null => {
    const asset = assets.find(a => 
      a.type === type || 
      a.metadata?.format === type.replace('output_', '')
    );
    return asset?.metadata?.url || null;
  };

  const instagramAsset = assets.find(a => a.metadata?.format === 'instagram' || a.metadata?.variant === 'instagram');
  const whatsappAsset = assets.find(a => a.metadata?.format === 'whatsapp' || a.metadata?.variant === 'whatsapp');

  const handleDownload = async (url: string | null, format: string) => {
    if (!url) {
      Alert.alert('Erreur', 'Image non disponible');
      return;
    }
    
    setIsSharing(true);
    try {
      // Request permission to access media library
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire pour télécharger les images.');
        setIsSharing(false);
        return;
      }

      const cacheDir = new Directory(Paths.cache);
      const filename = `kpata_${format}_${Date.now()}.webp`;
      const file = await File.downloadFileAsync(url, cacheDir);
      await file.rename(filename);
      
      // Save to device gallery
      const asset = await MediaLibrary.createAssetAsync(file.uri);
      await MediaLibrary.createAlbumAsync('KPATA', asset, false);
      
      Alert.alert('Succès', 'Image enregistrée dans ta galerie !');
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Erreur', 'Impossible de télécharger l\'image.');
    }
    setIsSharing(false);
  };

  const handleShare = async (url: string | null, format: string) => {
    if (!url) {
      Alert.alert('Erreur', 'Image non disponible');
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Indisponible', 'Le partage n\'est pas disponible sur cet appareil.');
      return;
    }

    setIsSharing(true);
    try {
      const cacheDir = new Directory(Paths.cache);
      const filename = `kpata_share_${format}_${Date.now()}.webp`;
      const file = await File.downloadFileAsync(url, cacheDir);
      await file.rename(filename);
      await Sharing.shareAsync(file.uri);
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Erreur', 'Impossible de partager l\'image.');
    }
    setIsSharing(false);
  };

  const handleChangeBackground = () => {
    if (credits < 1) {
      Alert.alert('Crédits insuffisants', 'Tu n\'as plus de crédits.');
      return;
    }
    Alert.alert(
      'Changer le fond',
      'Cette action consomme 1 crédit. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer', onPress: () => Alert.alert('Info', 'Fonctionnalité en développement') },
      ]
    );
  };

  const handleChangeTemplate = () => {
    if (credits < 1) {
      Alert.alert('Crédits insuffisants', 'Tu n\'as plus de crédits.');
      return;
    }
    Alert.alert(
      'Changer le template',
      'Cette action consomme 1 crédit. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer', onPress: () => Alert.alert('Info', 'Fonctionnalité en développement') },
      ]
    );
  };

  // Show loading screen until job is completed AND assets are available
  const isJobProcessing = !job || job.status !== 'completed' || assets.length === 0;
  
  if (isLoading && !job) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }
  
  if (isJobProcessing) {
    const elapsedMs = now - mountedAt;
    const step1Done = elapsedMs > 3000;
    const step2Active = step1Done;
    const step2Done = elapsedMs > 11000;
    const step3Active = step2Done;
    const step3Done = elapsedMs > 19000;
    const step4Active = step3Done;

    const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
    const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.25] });
    const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
      <SafeAreaView style={styles.processingContainer}>
        <View style={styles.processingTop}>
          <Animated.View style={[styles.processingOrbOuter, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
          <View style={styles.processingOrbInner}>
            <Ionicons name="sparkles" size={28} color="#0B63F3" />
          </View>

          <Text style={styles.processingTitle}>Transformation en cours...</Text>
          <View style={styles.processingObjectiveRow}>
            <Ionicons name="time-outline" size={16} color="#9CA3AF" />
            <Text style={styles.processingObjectiveText}>Objectif &lt; 30 secondes</Text>
          </View>

          <View style={styles.stepsList}>
            <StepRow label="Optimisation photo" state={step1Done ? 'done' : 'active'} spinDeg={spinDeg} />
            <StepRow label="Détourage IA" state={step2Done ? 'done' : step2Active ? 'active' : 'todo'} spinDeg={spinDeg} />
            <StepRow label="Studio Pro & Lumière" state={step3Done ? 'done' : step3Active ? 'active' : 'todo'} spinDeg={spinDeg} />
            <StepRow label="Export Final" state={step4Active ? 'active' : 'todo'} spinDeg={spinDeg} />
          </View>
        </View>

        <View style={styles.processingBottom}>
          <TouchableOpacity style={styles.backToGalleryBtn} onPress={() => router.replace('/(tabs)/gallery')}>
            <Text style={styles.backToGalleryBtnText}>Retour à la galerie</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadJobData}>
          <Text style={styles.retryBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeAsset = selectedFormat === 'whatsapp' ? whatsappAsset : instagramAsset;
  const activeUrl = activeAsset?.metadata?.url || null;

  return (
    <SafeAreaView style={styles.resultContainer}>
      <View style={styles.resultHeader}>
        <View style={styles.resultHeaderSide} />
        <Text style={styles.resultHeaderTitle}>Ton Visuel</Text>
        <TouchableOpacity style={styles.resultHeaderClose} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultScrollContent}>
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, selectedFormat === 'whatsapp' && styles.tabActive]}
            onPress={() => setSelectedFormat('whatsapp')}
          >
            <Text style={[styles.tabText, selectedFormat === 'whatsapp' && styles.tabTextActive]}>WhatsApp (9:16)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedFormat === 'instagram' && styles.tabActive]}
            onPress={() => setSelectedFormat('instagram')}
          >
            <Text style={[styles.tabText, selectedFormat === 'instagram' && styles.tabTextActive]}>Instagram (1:1)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewWrap}>
          {activeUrl ? (
            <Image
              source={{ uri: activeUrl }}
              style={selectedFormat === 'whatsapp' ? styles.previewImageWhatsapp : styles.previewImageInstagram}
              resizeMode="cover"
            />
          ) : (
            <View style={selectedFormat === 'whatsapp' ? styles.previewPlaceholderWhatsapp : styles.previewPlaceholderInstagram}>
              <Text style={styles.placeholderText}>Image indisponible</Text>
            </View>
          )}
        </View>

        <View style={styles.primaryActionsRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnFilled, !activeUrl && styles.primaryBtnDisabled]}
            onPress={() => handleDownload(activeUrl, selectedFormat)}
            disabled={isSharing || !activeUrl}
          >
            <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnFilledText}>{isSharing ? '...' : 'Télécharger'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnOutline, !activeUrl && styles.primaryBtnDisabled]}
            onPress={() => handleShare(activeUrl, selectedFormat)}
            disabled={isSharing || !activeUrl}
          >
            <Ionicons name="share-social-outline" size={18} color="#111827" />
            <Text style={styles.primaryBtnOutlineText}>Partager</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryList}>
          <TouchableOpacity style={styles.secondaryRow} onPress={handleChangeBackground}>
            <View style={styles.secondaryRowLeft}>
              <View style={styles.secondaryIconBox}>
                <Ionicons name="image-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.secondaryRowText}>Regénérer le fond</Text>
            </View>
            <View style={styles.creditBadge}>
              <Text style={styles.creditBadgeText}>1 crédit</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.secondaryDivider} />

          <TouchableOpacity style={styles.secondaryRow} onPress={handleChangeTemplate}>
            <View style={styles.secondaryRowLeft}>
              <View style={styles.secondaryIconBox}>
                <Ionicons name="grid-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.secondaryRowText}>Changer le template</Text>
            </View>
            <View style={styles.creditBadge}>
              <Text style={styles.creditBadgeText}>1 crédit</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footerLinksRow}>
          <TouchableOpacity onPress={() => Alert.alert('Info', 'Fonctionnalité en développement')}>
            <Text style={styles.footerLinkText}>Signaler un problème</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Info', 'Fonctionnalité en développement')}>
            <Text style={styles.footerLinkText}>Aide</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.creditsNote}>💰 {credits} crédits restants</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepRow({
  label,
  state,
  spinDeg,
}: {
  label: string;
  state: 'done' | 'active' | 'todo';
  spinDeg: Animated.AnimatedInterpolation<string>;
}) {
  return (
    <View style={styles.stepRow}>
      {state === 'done' ? (
        <View style={styles.stepIconDone}>
          <Ionicons name="checkmark" size={18} color="#16A34A" />
        </View>
      ) : state === 'active' ? (
        <Animated.View style={[styles.stepSpinner, { transform: [{ rotate: spinDeg }] }]}>
          <View style={styles.stepSpinnerArc} />
        </Animated.View>
      ) : (
        <View style={styles.stepDot} />
      )}

      <Text style={[styles.stepLabel, state === 'active' && styles.stepLabelActive, state === 'todo' && styles.stepLabelMuted]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, color: '#1F2937', fontSize: 18, fontWeight: '600' },
  loadingSubText: { marginTop: 8, color: '#6B7280', fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  errorText: { color: '#EF4444', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#6366F1', padding: 12, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600' },

  processingContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  processingTop: { flex: 1, alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  processingOrbOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#EEF2FF',
  },
  processingOrbInner: {
    position: 'absolute',
    top: 48 + 38,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 10,
    borderColor: '#E7E8FF',
  },
  processingTitle: { marginTop: 96, fontSize: 22, fontWeight: '900', color: '#111827', textAlign: 'center' },
  processingObjectiveRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  processingObjectiveText: { color: '#9CA3AF', fontWeight: '700' },
  stepsList: { marginTop: 34, alignSelf: 'stretch', paddingHorizontal: 10, gap: 18 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepIconDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSpinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#DCE9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSpinnerArc: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#0B63F3',
    borderTopColor: '#0B63F3',
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB', marginLeft: 10, marginRight: 10 },
  stepLabel: { fontSize: 15, fontWeight: '800', color: '#111827' },
  stepLabelActive: { color: '#0B63F3' },
  stepLabelMuted: { color: '#9CA3AF' },

  processingBottom: { paddingHorizontal: 16, paddingBottom: 18, paddingTop: 10 },
  backToGalleryBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToGalleryBtnText: { color: '#9CA3AF', fontWeight: '800' },

  resultContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  resultHeader: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultHeaderSide: { width: 40 },
  resultHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  resultHeaderClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  resultScroll: { flex: 1 },
  resultScrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },

  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontWeight: '800', color: '#9CA3AF' },
  tabTextActive: { color: '#111827' },

  previewWrap: { alignItems: 'center', marginBottom: 18 },
  previewImageWhatsapp: { width: 230, height: 360, borderRadius: 14, backgroundColor: '#E5E7EB' },
  previewImageInstagram: { width: 260, height: 260, borderRadius: 14, backgroundColor: '#E5E7EB' },
  previewPlaceholderWhatsapp: { width: 230, height: 360, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  previewPlaceholderInstagram: { width: 260, height: 260, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },

  primaryActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnFilled: { backgroundColor: '#0B63F3' },
  primaryBtnOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnFilledText: { color: '#FFFFFF', fontWeight: '900' },
  primaryBtnOutlineText: { color: '#111827', fontWeight: '900' },

  secondaryList: { borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F7', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  secondaryRow: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secondaryDivider: { height: 1, backgroundColor: '#EEF2F7' },
  secondaryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondaryIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  secondaryRowText: { fontWeight: '900', color: '#111827' },
  creditBadge: { backgroundColor: '#EEF4FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  creditBadgeText: { color: '#0B63F3', fontWeight: '900', fontSize: 12 },

  footerLinksRow: { flexDirection: 'row', justifyContent: 'center', gap: 26, marginTop: 18, marginBottom: 18 },
  footerLinkText: { color: '#9CA3AF', fontWeight: '800' },

  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', textAlign: 'center', marginBottom: 16 },
  infoCard: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, marginBottom: 16 },
  infoText: { color: '#4B5563', fontSize: 14, lineHeight: 22 },
  formatCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 16 },
  formatTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  imageWhatsapp: { width: '100%', aspectRatio: 9 / 16, borderRadius: 8, backgroundColor: '#E5E7EB' },
  imageInstagram: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#E5E7EB' },
  imagePlaceholder: { width: '100%', aspectRatio: 9 / 16, borderRadius: 8, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderSquare: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#9CA3AF', fontSize: 16, textAlign: 'center' },
  downloadBtn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  downloadBtnDisabled: { backgroundColor: '#9CA3AF' },
  downloadBtnText: { color: '#fff', fontWeight: '600' },
  changeOptions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  changeBtn: { flex: 1, backgroundColor: '#EEF2FF', padding: 12, borderRadius: 8, alignItems: 'center' },
  changeBtnText: { color: '#6366F1', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  creditsNote: { textAlign: 'center', color: '#6B7280', marginBottom: 32 },
});
