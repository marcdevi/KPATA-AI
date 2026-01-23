/**
 * Home Screen for KPATA AI Mobile App
 * Take photo/import + choose background + template + mannequin
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useJobStore } from '../../src/store/job';
import { useAuthStore } from '../../src/store/auth';
import { createJob } from '../../src/services/api';
import { CATEGORIES, BACKGROUNDS, TEMPLATES, MANNEQUINS } from '../../src/constants/options';

export default function HomeScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { currentOptions, setOption, resetOptions, setPendingJob } = useJobStore();
  const { credits, profileId } = useAuthStore();

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

    if (credits < 1) {
      Alert.alert('Crédits insuffisants', 'Tu n\'as plus de crédits. Achète un pack pour continuer.');
      return;
    }

    setIsCreating(true);
    const clientRequestId = `app_${Date.now()}`;

    const result = await createJob({
      ...currentOptions,
      clientRequestId,
    });

    setIsCreating(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    if (result.data?.job.id) {
      setPendingJob(result.data.job.id);
      resetOptions();
      setSelectedImage(null);
      router.push(`/job/${result.data.job.id}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Image Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📷 Photo du produit</Text>
        
        {selectedImage ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity style={styles.changeBtn} onPress={() => setSelectedImage(null)}>
              <Text style={styles.changeBtnText}>Changer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imageButtons}>
            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
              <Text style={styles.imageBtnIcon}>📸</Text>
              <Text style={styles.imageBtnText}>Prendre photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
              <Text style={styles.imageBtnIcon}>🖼️</Text>
              <Text style={styles.imageBtnText}>Importer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Catégorie</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionsRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.optionBtn, currentOptions.category === cat.id && styles.optionActive]}
                onPress={() => setOption('category', cat.id)}
              >
                <Text style={styles.optionIcon}>{cat.icon}</Text>
                <Text style={[styles.optionText, currentOptions.category === cat.id && styles.optionTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Background */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 Style de fond</Text>
        <View style={styles.optionsGrid}>
          {BACKGROUNDS.map((bg) => (
            <TouchableOpacity
              key={bg.id}
              style={[styles.optionBtn, styles.optionBtnLarge, currentOptions.backgroundStyle === bg.id && styles.optionActive]}
              onPress={() => setOption('backgroundStyle', bg.id)}
            >
              <Text style={styles.optionIcon}>{bg.icon}</Text>
              <Text style={[styles.optionText, currentOptions.backgroundStyle === bg.id && styles.optionTextActive]}>
                {bg.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Template */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📐 Template</Text>
        <View style={styles.optionsRow}>
          {TEMPLATES.map((tpl) => (
            <TouchableOpacity
              key={tpl.id}
              style={[styles.optionBtn, currentOptions.templateLayout === tpl.id && styles.optionActive]}
              onPress={() => setOption('templateLayout', tpl.id)}
            >
              <Text style={styles.optionIcon}>📐</Text>
              <Text style={[styles.optionText, currentOptions.templateLayout === tpl.id && styles.optionTextActive]}>
                {tpl.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Mannequin */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👕 Mannequin</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionsRow}>
            {MANNEQUINS.map((man) => (
              <TouchableOpacity
                key={man.id}
                style={[styles.optionBtn, currentOptions.mannequinMode === man.id && styles.optionActive]}
                onPress={() => setOption('mannequinMode', man.id)}
              >
                <Text style={styles.optionIcon}>{man.icon}</Text>
                <Text style={[styles.optionText, currentOptions.mannequinMode === man.id && styles.optionTextActive]}>
                  {man.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Create Button */}
      <View style={styles.footer}>
        <Text style={styles.creditsText}>💰 {credits} crédits disponibles</Text>
        <TouchableOpacity
          style={[styles.createBtn, (!selectedImage || isCreating) && styles.createBtnDisabled]}
          onPress={handleCreateJob}
          disabled={!selectedImage || isCreating}
        >
          <Text style={styles.createBtnText}>
            {isCreating ? '⏳ Création...' : '✨ Créer le visuel (1 crédit)'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  imageButtons: { flexDirection: 'row', gap: 12 },
  imageBtn: { flex: 1, padding: 24, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' },
  imageBtnIcon: { fontSize: 32, marginBottom: 8 },
  imageBtnText: { fontSize: 14, color: '#4B5563' },
  imagePreview: { alignItems: 'center' },
  previewImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 8 },
  changeBtn: { padding: 8 },
  changeBtnText: { color: '#6366F1', fontWeight: '600' },
  optionsRow: { flexDirection: 'row', gap: 8 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { padding: 12, backgroundColor: '#F3F4F6', borderRadius: 8, alignItems: 'center', minWidth: 80 },
  optionBtnLarge: { flex: 1, minWidth: 100 },
  optionActive: { backgroundColor: '#EEF2FF', borderWidth: 2, borderColor: '#6366F1' },
  optionIcon: { fontSize: 20, marginBottom: 4 },
  optionText: { fontSize: 12, color: '#4B5563', textAlign: 'center' },
  optionTextActive: { color: '#6366F1', fontWeight: '600' },
  footer: { padding: 16, paddingBottom: 32 },
  creditsText: { textAlign: 'center', color: '#6B7280', marginBottom: 12 },
  createBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 12, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
