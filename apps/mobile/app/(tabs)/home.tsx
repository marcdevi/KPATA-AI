/**
 * Home Screen for KPATA AI Mobile App
 * Take photo/import + choose background + template + mannequin
 */

import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, SafeAreaView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useJobStore } from '../../src/store/job';
import { useAuthStore } from '../../src/store/auth';
import { createJob, getMannequin } from '../../src/services/api';
import { CATEGORIES, BACKGROUNDS, TEMPLATES } from '../../src/constants/options';

export default function HomeScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { currentOptions, setOption, resetOptions, setPendingJob } = useJobStore();
  const { credits, setCredits } = useAuthStore();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorise l\'accès à la caméra pour prendre des photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCreateJob = async () => {
    if (!selectedImage) {
      Alert.alert('Erreur', 'Sélectionne une image d\'abord.');
      return;
    }

    const requiredCredits = currentOptions.mannequinMode === 'custom' ? 2 : 1;

    if (credits < requiredCredits) {
      Alert.alert(
        'Crédits insuffisants',
        `Tu n\'as pas assez de crédits. Il te faut ${requiredCredits} crédit${requiredCredits > 1 ? 's' : ''} pour cette génération.`
      );
      return;
    }

    // Check if custom mannequin is selected but not configured
    if (currentOptions.mannequinMode === 'custom') {
      const mannequinResult = await getMannequin();
      if (!mannequinResult.data?.mannequin) {
        Alert.alert(
          'Mannequin requis',
          'Tu dois d\'abord configurer ton mannequin dans l\'onglet Mannequin pour utiliser cette option.',
          [{ text: 'OK' }]
        );
        setIsCreating(false);
        return;
      }
    }

    setIsCreating(true);
    const clientRequestId = `app_${Date.now()}`;

    // Convert image to base64
    let imageBase64: string | undefined;
    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const reader = new FileReader();
      imageBase64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data:image/...;base64, prefix
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      Alert.alert('Erreur', 'Impossible de traiter l\'image.');
      setIsCreating(false);
      return;
    }

    const result = await createJob({
      ...currentOptions,
      clientRequestId,
      imageBase64,
    });

    setIsCreating(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    if (result.data?.job.id) {
      if (typeof result.data.creditsRemaining === 'number') {
        setCredits(result.data.creditsRemaining);
      }
      setPendingJob(result.data.job.id);
      resetOptions();
      setSelectedImage(null);
      router.push(`/result/${result.data.job.id}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>K</Text>
          </View>
          <Text style={styles.brandText}>KPATA AI</Text>
        </View>

        <View style={styles.creditsPill}>
          <Ionicons name="flash-outline" size={16} color={stylesVars.primary} />
          <Text style={styles.creditsPillText}>{credits} crédits</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Source photo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Source photo</Text>

          {selectedImage ? (
            <View style={styles.imagePreviewCard}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              <TouchableOpacity style={styles.changeBtn} onPress={() => setSelectedImage(null)}>
                <Text style={styles.changeBtnText}>Changer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imageButtons}>
              <TouchableOpacity style={[styles.sourceCard, styles.sourceCardActive]} onPress={takePhoto}>
                <View style={styles.sourceIconWrap}>
                  <Ionicons name="camera-outline" size={22} color={stylesVars.primary} />
                </View>
                <Text style={styles.sourceCardText}>Prendre photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sourceCard} onPress={pickImage}>
                <View style={styles.sourceIconWrapMuted}>
                  <Ionicons name="image-outline" size={22} color={stylesVars.textMuted} />
                </View>
                <Text style={styles.sourceCardText}>Importer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Catégorie */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipsRow}>
              {CATEGORIES.map((cat) => {
                const active = currentOptions.category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setOption('category', cat.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Fond */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Fond studio</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Tout voir</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.cardsRow}>
              {BACKGROUNDS.map((bg) => {
                const active = currentOptions.backgroundStyle === bg.id;
                return (
                  <TouchableOpacity
                    key={bg.id}
                    style={[styles.miniCard, active && styles.miniCardActive]}
                    onPress={() => setOption('backgroundStyle', bg.id)}
                  >
                    <View style={styles.miniThumb} />
                    <Text style={styles.miniCardLabel} numberOfLines={1}>
                      {bg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Template promo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Template promo</Text>
          <View style={styles.cardsRow}>
            {TEMPLATES.map((tpl) => {
              const active = currentOptions.templateLayout === tpl.id;
              return (
                <TouchableOpacity
                  key={tpl.id}
                  style={[styles.templateCard, active && styles.templateCardActive]}
                  onPress={() => setOption('templateLayout', tpl.id)}
                >
                  <View style={styles.templateThumb}>
                    <View style={styles.templateThumbBar} />
                    <View style={styles.templateThumbBlock} />
                  </View>
                  <Text style={styles.templateLabel} numberOfLines={1}>
                    {tpl.label.replace('Carré', 'Simple').replace('Portrait', 'Promo').replace('Story', 'Luxe')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Mannequin */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Mannequin</Text>
            <TouchableOpacity>
              <Ionicons name="information-circle-outline" size={18} color={stylesVars.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[styles.radioRow, currentOptions.mannequinMode === 'none' && styles.radioRowActive]}
              onPress={() => setOption('mannequinMode', 'none')}
            >
              <View style={[styles.radioOuter, currentOptions.mannequinMode === 'none' && styles.radioOuterActive]}>
                {currentOptions.mannequinMode === 'none' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioText}>Aucun (produit seul)</Text>
            </TouchableOpacity>

            <View style={styles.radioDivider} />

            <TouchableOpacity
              style={[styles.radioRow, currentOptions.mannequinMode === 'custom' && styles.radioRowActive]}
              onPress={() => setOption('mannequinMode', 'custom')}
            >
              <View style={[styles.radioOuter, currentOptions.mannequinMode === 'custom' && styles.radioOuterActive]}>
                {currentOptions.mannequinMode === 'custom' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.radioRowRight}>
                <Text style={styles.radioText}>Mon mannequin</Text>
              </View>
              <Text style={styles.addLink}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerBar}>
        <Text style={styles.watermarkText}>Version gratuite : Watermark activé</Text>
        <TouchableOpacity
          style={[styles.createBtn, (!selectedImage || isCreating) && styles.createBtnDisabled]}
          onPress={handleCreateJob}
          disabled={!selectedImage || isCreating}
        >
          <Text style={styles.createBtnText}>{isCreating ? 'Génération...' : 'Générer (1 crédit)'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const stylesVars = {
  primary: '#0B63F3',
  bg: '#FFFFFF',
  surface: '#F6F7FB',
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stylesVars.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: stylesVars.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: stylesVars.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#fff', fontWeight: '800' },
  brandText: { fontSize: 18, fontWeight: '800', color: stylesVars.text },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
  },
  creditsPillText: { color: stylesVars.text, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 110 },

  section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: stylesVars.text, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  seeAllText: { color: stylesVars.primary, fontWeight: '700', fontSize: 13 },

  imageButtons: { flexDirection: 'row', gap: 12 },
  sourceCard: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: stylesVars.surface,
    borderWidth: 1,
    borderColor: stylesVars.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sourceCardActive: { borderColor: stylesVars.primary, backgroundColor: '#F2F7FF' },
  sourceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E7F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIconWrapMuted: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCardText: { fontSize: 14, fontWeight: '700', color: stylesVars.text },

  imagePreviewCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: stylesVars.surface,
    borderWidth: 1,
    borderColor: stylesVars.border,
  },
  previewImage: { width: '100%', height: 210 },
  changeBtn: { padding: 12, alignItems: 'center' },
  changeBtnText: { color: stylesVars.primary, fontWeight: '700' },

  chipsRow: { flexDirection: 'row', gap: 10, paddingRight: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: stylesVars.surface,
    borderWidth: 1,
    borderColor: stylesVars.border,
  },
  chipActive: { backgroundColor: stylesVars.primary, borderColor: stylesVars.primary },
  chipText: { color: stylesVars.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff' },

  cardsRow: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  miniCard: {
    width: 110,
    borderRadius: 12,
    backgroundColor: stylesVars.surface,
    borderWidth: 1,
    borderColor: stylesVars.border,
    overflow: 'hidden',
  },
  miniCardActive: { borderColor: stylesVars.primary, borderWidth: 2 },
  miniThumb: { height: 64, backgroundColor: '#E5E7EB' },
  miniCardLabel: { padding: 10, fontSize: 12, fontWeight: '700', color: stylesVars.text, textAlign: 'center' },

  templateCard: {
    flex: 1,
    minWidth: 92,
    borderRadius: 12,
    backgroundColor: stylesVars.surface,
    borderWidth: 1,
    borderColor: stylesVars.border,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  templateCardActive: { borderColor: stylesVars.primary, borderWidth: 2, backgroundColor: '#F2F7FF' },
  templateThumb: {
    width: '100%',
    height: 54,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  templateThumbBar: { height: 10, backgroundColor: '#D1D5DB' },
  templateThumbBlock: { flex: 1, margin: 10, borderRadius: 6, backgroundColor: '#9CA3AF' },
  templateLabel: { fontSize: 12, fontWeight: '800', color: stylesVars.text },

  radioGroup: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: stylesVars.border,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  radioRowActive: { borderColor: stylesVars.primary },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioOuterActive: { borderColor: stylesVars.primary },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: stylesVars.primary },
  radioText: { flex: 1, color: stylesVars.text, fontWeight: '700' },
  radioRowRight: { flex: 1 },
  addLink: { color: stylesVars.primary, fontWeight: '800' },
  radioDivider: { height: 1, backgroundColor: stylesVars.border },

  footerBar: {
    borderTopWidth: 1,
    borderTopColor: stylesVars.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#fff',
  },
  watermarkText: { textAlign: 'center', color: stylesVars.textMuted, fontWeight: '600', marginBottom: 10 },
  createBtn: { backgroundColor: stylesVars.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
