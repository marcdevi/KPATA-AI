/**
 * Gallery Screen for KPATA AI Mobile App
 * List jobs with thumbnails
 */

import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useJobStore } from '../../src/store/job';
import { getJobs } from '../../src/services/api';
import { JOB_STATUS_LABELS } from '../../src/constants/options';
import { API_CONFIG } from '../../src/config/api';

export default function GalleryScreen() {
  const { jobs, isLoadingJobs, setJobs, setLoadingJobs } = useJobStore();

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    const result = await getJobs(50, 0);
    setLoadingJobs(false);

    if (result.data) {
      setJobs(result.data.jobs.map((j) => ({
        id: j.id,
        status: j.status as 'queued' | 'processing' | 'completed' | 'failed',
        category: j.category,
        backgroundStyle: j.background_style,
        templateLayout: j.template_layout,
        mannequinMode: 'none',
        createdAt: j.created_at,
        completedAt: j.completed_at,
        thumbnailUrl: `${API_CONFIG.mediaWorkerUrl}/gallery/${j.id}/thumb_256.webp`,
      })));
    }
  }, [setJobs, setLoadingJobs]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const renderJob = ({ item }: { item: typeof jobs[0] }) => {
    const status = JOB_STATUS_LABELS[item.status] || { label: item.status, color: '#666' };

    return (
      <TouchableOpacity
        style={styles.jobCard}
        onPress={() => router.push(`/job/${item.id}`)}
      >
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={styles.thumbnail}
          
        />
        <View style={styles.jobInfo}>
          <Text style={styles.jobCategory}>{item.category}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.jobDate}>
            {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        renderItem={renderJob}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoadingJobs} onRefresh={loadJobs} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🖼️</Text>
            <Text style={styles.emptyText}>Aucun visuel pour le moment</Text>
            <Text style={styles.emptySubtext}>Crée ton premier visuel !</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 8 },
  jobCard: { flex: 1, margin: 8, backgroundColor: '#F9FAFB', borderRadius: 12, overflow: 'hidden' },
  thumbnail: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E7EB' },
  jobInfo: { padding: 8 },
  jobCategory: { fontSize: 12, fontWeight: '600', color: '#1F2937', textTransform: 'capitalize' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },
  jobDate: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 4 },
});
