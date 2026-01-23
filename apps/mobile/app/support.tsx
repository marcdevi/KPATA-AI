/**
 * Support Screen for KPATA AI Mobile App
 * Help button creates ticket, Report button creates report
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { createTicket, reportContent } from '../src/services/api';

export default function SupportScreen() {
  const [activeTab, setActiveTab] = useState<'help' | 'report'>('help');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportJobId, setReportJobId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Erreur', 'Remplis tous les champs.');
      return;
    }

    setIsSubmitting(true);
    const result = await createTicket(subject, message);
    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    Alert.alert('Succès', 'Ton ticket a été créé. Notre équipe te répondra rapidement.');
    setSubject('');
    setMessage('');
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Erreur', 'Décris le problème.');
      return;
    }

    setIsSubmitting(true);
    const result = await reportContent({
      jobId: reportJobId || undefined,
      reason: 'inappropriate_content',
      description: reportReason,
    });
    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Erreur', result.error.message);
      return;
    }

    Alert.alert('Succès', 'Ton signalement a été envoyé. Merci de nous aider à améliorer KPATA AI.');
    setReportReason('');
    setReportJobId('');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'help' && styles.tabActive]}
          onPress={() => setActiveTab('help')}
        >
          <Text style={[styles.tabText, activeTab === 'help' && styles.tabTextActive]}>💬 Aide</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'report' && styles.tabActive]}
          onPress={() => setActiveTab('report')}
        >
          <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>🚨 Signaler</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'help' ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Besoin d'aide ?</Text>
          <Text style={styles.formSubtitle}>Notre équipe te répondra dans les plus brefs délais.</Text>

          <Text style={styles.label}>Sujet</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Problème de paiement"
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Décris ton problème..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmitTicket}
            disabled={isSubmitting}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? '⏳ Envoi...' : '📤 Envoyer'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Signaler un contenu</Text>
          <Text style={styles.formSubtitle}>Aide-nous à garder KPATA AI sûr et respectueux.</Text>

          <Text style={styles.label}>ID du job (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: abc123..."
            value={reportJobId}
            onChangeText={setReportJobId}
          />

          <Text style={styles.label}>Description du problème</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Décris ce qui ne va pas..."
            value={reportReason}
            onChangeText={setReportReason}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, styles.reportBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmitReport}
            disabled={isSubmitting}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? '⏳ Envoi...' : '🚨 Signaler'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.contact}>
        <Text style={styles.contactTitle}>Autres moyens de contact</Text>
        <Text style={styles.contactItem}>📧 support@kpata.ai</Text>
        <Text style={styles.contactItem}>📱 WhatsApp: +225 XX XX XX XX</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, padding: 16, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  tabText: { fontSize: 16, color: '#6B7280' },
  tabTextActive: { color: '#6366F1', fontWeight: '600' },
  form: { padding: 16 },
  formTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  formSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  textarea: { height: 120 },
  submitBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 12, alignItems: 'center' },
  reportBtn: { backgroundColor: '#EF4444' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  contact: { padding: 16, backgroundColor: '#F9FAFB', margin: 16, borderRadius: 12 },
  contactTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  contactItem: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
});
