/**
 * Mannequin Screen for KPATA AI Mobile App
 * Upload mannequin face+body + checkbox "no celebrity"
 */

import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { createMannequin, getMannequin } from '../src/services/api';

export default function MannequinScreen() {
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [bodyImage, setBodyImage] = useState<string | null>(null);
  const [notCelebrity, setNotCelebrity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing mannequin on mount
  useEffect(() => {
    loadMannequin();
  }, []);

  const loadMannequin = async () => {
    try {
      const result = await getMannequin();
      if (result.data?.mannequin) {
        setFaceImage(result.data.mannequin.faceImageUrl);
        setBodyImage(result.data.mannequin.bodyImageUrl);
        setNotCelebrity(true);
      }
    } catch (error) {
      console.error('Failed to load mannequin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async (type: 'face' | 'body') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'face' ? [1, 1] : [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (type === 'face') {
        setFaceImage(result.assets[0].uri);
      } else {
        setBodyImage(result.assets[0].uri);
      }
    }
  };

  const handleSave = async () => {
    if (!faceImage || !bodyImage) {
      Alert.alert('Erreur', 'Ajoute une photo de visage et une photo de corps.');
      return;
    }

    if (!notCelebrity) {
      Alert.alert('Confirmation requise', 'Tu dois confirmer que ce n\'est pas une célébrité.');
      return;
    }

    setIsSaving(true);
    
    try {
      // Convert images to base64
      const faceFile = new File(faceImage);
      const faceBase64 = await faceFile.base64();
      
      const bodyFile = new File(bodyImage);
      const bodyBase64 = await bodyFile.base64();

      // Upload to API
      const result = await createMannequin({
        faceImageBase64: faceBase64,
        bodyImageBase64: bodyBase64,
        isCelebrityConfirmed: notCelebrity,
      });

      if (result.error) {
        Alert.alert('Erreur', result.error.message || 'Impossible d\'enregistrer le mannequin.');
        return;
      }

      Alert.alert('Succès', 'Ton mannequin a été enregistré ! Tu peux maintenant l\'utiliser pour générer tes visuels.');
      // Reload to show saved images
      await loadMannequin();
    } catch (error) {
      console.error('Mannequin save error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>👕 Mon Mannequin</Text>
      <Text style={styles.subtitle}>
        Ajoute tes photos pour créer un mannequin personnalisé.
        Tu pourras l'utiliser pour tes visuels.
      </Text>

      {/* Face Image */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📸 Photo de visage</Text>
        <TouchableOpacity style={styles.imageBox} onPress={() => pickImage('face')}>
          {faceImage ? (
            <Image source={{ uri: faceImage }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>👤</Text>
              <Text style={styles.placeholderText}>Ajouter</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>Photo de face, bien éclairée</Text>
      </View>

      {/* Body Image */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📸 Photo de corps</Text>
        <TouchableOpacity style={styles.imageBox} onPress={() => pickImage('body')}>
          {bodyImage ? (
            <Image source={{ uri: bodyImage }} style={styles.imageBody} />
          ) : (
            <View style={[styles.placeholder, styles.placeholderBody]}>
              <Text style={styles.placeholderIcon}>🧍</Text>
              <Text style={styles.placeholderText}>Ajouter</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>Photo en pied, vêtements neutres</Text>
      </View>

      {/* Checkbox */}
      <View style={styles.checkboxRow}>
        <Switch value={notCelebrity} onValueChange={setNotCelebrity} trackColor={{ true: '#6366F1' }} />
        <Text style={styles.checkboxText}>
          Je confirme que ces photos ne représentent pas une célébrité ou une personne publique.
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, (!faceImage || !bodyImage || !notCelebrity || isSaving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!faceImage || !bodyImage || !notCelebrity || isSaving}
      >
        <Text style={styles.saveBtnText}>
          {isSaving ? '⏳ Enregistrement...' : '💾 Enregistrer mon mannequin'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        ⚠️ MVP : 1 mannequin par compte. Tu pourras le modifier dans les paramètres.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  imageBox: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  image: { width: '100%', aspectRatio: 1 },
  imageBody: { width: '100%', aspectRatio: 3 / 4 },
  placeholder: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderBody: { aspectRatio: 3 / 4 },
  placeholderIcon: { fontSize: 48, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: '#6B7280' },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12 },
  checkboxText: { flex: 1, fontSize: 14, color: '#92400E', lineHeight: 20 },
  saveBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 32 },
});
