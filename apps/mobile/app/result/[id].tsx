/**
 * Result Screen for KPATA AI Mobile App
 * Display 2 formats + download/share + change options
 */

import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG } from '../../src/config/api';
import { createJob } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isSharing, setIsSharing] = useState(false);
  const { credits } = useAuthStore();

  const whatsappUrl = `${API_CONFIG.mediaWorkerUrl}/gallery/${id}/v1/whatsapp.webp`;
  const instagramUrl = `${API_CONFIG.mediaWorkerUrl}/gallery/${id}/v1/instagram.webp`;

  const handleShare = async (url: string, format: string) => {
    setIsSharing(true);
    try {
      const filename = `kpata_${format}_${id}.webp`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.downloadAsync(url, localUri);
      await Sharing.shareAsync(localUri);
    } catch (error) {
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

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>✨ Tes visuels sont prêts !</Text>

      {/* WhatsApp Format */}
      <View style={styles.formatCard}>
        <Text style={styles.formatTitle}>📱 WhatsApp Status (9:16)</Text>
        <Image source={{ uri: whatsappUrl }} style={styles.imageWhatsapp} resizeMode="contain" />
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => handleShare(whatsappUrl, 'whatsapp')}
          disabled={isSharing}
        >
          <Text style={styles.shareBtnText}>{isSharing ? '⏳' : '📤'} Partager</Text>
        </TouchableOpacity>
      </View>

      {/* Instagram Format */}
      <View style={styles.formatCard}>
        <Text style={styles.formatTitle}>📷 Instagram (1:1)</Text>
        <Image source={{ uri: instagramUrl }} style={styles.imageInstagram} resizeMode="contain" />
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => handleShare(instagramUrl, 'instagram')}
          disabled={isSharing}
        >
          <Text style={styles.shareBtnText}>{isSharing ? '⏳' : '📤'} Partager</Text>
        </TouchableOpacity>
      </View>

      {/* Change Options */}
      <View style={styles.changeOptions}>
        <TouchableOpacity style={styles.changeBtn} onPress={handleChangeBackground}>
          <Text style={styles.changeBtnText}>🎨 Changer fond (1 crédit)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.changeBtn} onPress={handleChangeTemplate}>
          <Text style={styles.changeBtnText}>📐 Changer template (1 crédit)</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.creditsNote}>💰 {credits} crédits restants</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', textAlign: 'center', marginBottom: 24 },
  formatCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 16 },
  formatTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  imageWhatsapp: { width: '100%', aspectRatio: 9 / 16, borderRadius: 8, backgroundColor: '#E5E7EB' },
  imageInstagram: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#E5E7EB' },
  shareBtn: { backgroundColor: '#6366F1', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  shareBtnText: { color: '#fff', fontWeight: '600' },
  changeOptions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  changeBtn: { flex: 1, backgroundColor: '#EEF2FF', padding: 12, borderRadius: 8, alignItems: 'center' },
  changeBtnText: { color: '#6366F1', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  creditsNote: { textAlign: 'center', color: '#6B7280', marginBottom: 32 },
});
