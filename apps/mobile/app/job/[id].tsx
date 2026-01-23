/**
 * Job Status Screen for KPATA AI Mobile App
 * Realtime/poll job status
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getJob } from '../../src/services/api';
import { JOB_STATUS_LABELS } from '../../src/constants/options';

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<string>('queued');
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!id) return;

    const pollStatus = async () => {
      const result = await getJob(id);
      if (result.data) {
        setStatus(result.data.job.status);
        
        if (result.data.job.status === 'completed') {
          setIsPolling(false);
          router.replace(`/result/${id}`);
        } else if (result.data.job.status === 'failed') {
          setIsPolling(false);
        }
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);

    return () => clearInterval(interval);
  }, [id]);

  const statusInfo = JOB_STATUS_LABELS[status] || { label: status, color: '#666' };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {isPolling && status !== 'failed' ? (
          <>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.statusText}>{statusInfo.label}</Text>
            <Text style={styles.hint}>
              {status === 'queued' && 'Ton visuel est en file d\'attente...'}
              {status === 'processing' && 'Traitement en cours, ça arrive !'}
            </Text>
          </>
        ) : status === 'failed' ? (
          <>
            <Text style={styles.failedIcon}>😔</Text>
            <Text style={styles.failedText}>Échec du traitement</Text>
            <Text style={styles.hint}>Ton crédit a été remboursé.</Text>
          </>
        ) : (
          <>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successText}>Terminé !</Text>
          </>
        )}
      </View>

      <View style={styles.timeline}>
        <TimelineItem label="En attente" active={status === 'queued'} done={['processing', 'completed'].includes(status)} />
        <TimelineItem label="Traitement" active={status === 'processing'} done={status === 'completed'} />
        <TimelineItem label="Terminé" active={status === 'completed'} done={false} />
      </View>
    </View>
  );
}

function TimelineItem({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineDot, active && styles.timelineDotActive, done && styles.timelineDotDone]} />
      <Text style={[styles.timelineLabel, (active || done) && styles.timelineLabelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 24, fontWeight: '600', color: '#1F2937', marginTop: 24 },
  hint: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  failedIcon: { fontSize: 64 },
  failedText: { fontSize: 24, fontWeight: '600', color: '#EF4444', marginTop: 16 },
  successIcon: { fontSize: 64 },
  successText: { fontSize: 24, fontWeight: '600', color: '#10B981', marginTop: 16 },
  timeline: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 24 },
  timelineItem: { alignItems: 'center', flex: 1 },
  timelineDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E5E7EB', marginBottom: 8 },
  timelineDotActive: { backgroundColor: '#6366F1' },
  timelineDotDone: { backgroundColor: '#10B981' },
  timelineLabel: { fontSize: 12, color: '#9CA3AF' },
  timelineLabelActive: { color: '#1F2937', fontWeight: '600' },
});
