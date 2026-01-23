/**
 * Profile Screen for KPATA AI Mobile App
 */

import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';

export default function ProfileScreen() {
  const { phoneE164, role, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Es-tu sûr de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => { logout(); router.replace('/'); } },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.phone}>{phoneE164}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role === 'user_pro' ? '⭐ PRO' : '🆓 Gratuit'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/mannequin')}>
          <Text style={styles.menuIcon}>👕</Text>
          <Text style={styles.menuText}>Mon Mannequin</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/support')}>
          <Text style={styles.menuIcon}>💬</Text>
          <Text style={styles.menuText}>Support</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>📜</Text>
          <Text style={styles.menuText}>CGU</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>🔒</Text>
          <Text style={styles.menuText}>Confidentialité</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>

      <Text style={styles.version}>KPATA AI v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 40 },
  phone: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 12 },
  roleBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  roleText: { color: '#6366F1', fontWeight: '600' },
  section: { padding: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 8 },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuText: { flex: 1, fontSize: 16, color: '#1F2937' },
  menuArrow: { fontSize: 20, color: '#9CA3AF' },
  logoutBtn: { margin: 16, padding: 16, backgroundColor: '#FEE2E2', borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#DC2626', fontWeight: '600' },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginBottom: 32 },
});
