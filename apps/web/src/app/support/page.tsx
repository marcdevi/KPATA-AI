'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { createTicket, reportContent } from '@/lib/api';

export default function SupportPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuthGuard();
  const [activeTab, setActiveTab] = useState<'help' | 'report'>('help');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportJobId, setReportJobId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) { alert('Remplis tous les champs.'); return; }
    setIsSubmitting(true);
    const result = await createTicket(subject, message);
    setIsSubmitting(false);
    if (result.error) { alert(result.error.message); return; }
    alert('Ton ticket a été créé. Notre équipe te répondra rapidement.');
    setSubject(''); setMessage('');
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) { alert('Décris le problème.'); return; }
    setIsSubmitting(true);
    const result = await reportContent({ jobId: reportJobId || undefined, reason: 'inappropriate_content', description: reportReason });
    setIsSubmitting(false);
    if (result.error) { alert(result.error.message); return; }
    alert('Ton signalement a été envoyé. Merci !');
    setReportReason(''); setReportJobId('');
  };

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="text-base font-black text-gray-900">Support</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('help')}
          className={`flex-1 py-3.5 text-sm font-bold transition-colors ${activeTab === 'help' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
        >
          💬 Aide
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-3.5 text-sm font-bold transition-colors ${activeTab === 'report' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
        >
          🚨 Signaler
        </button>
      </div>

      <div className="px-4 pt-5 pb-8">
        {activeTab === 'help' ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-1">Besoin d'aide ?</h2>
              <p className="text-sm text-gray-500">Notre équipe te répondra dans les plus brefs délais.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Sujet</label>
              <input
                type="text"
                placeholder="Ex: Problème de paiement"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Message</label>
              <textarea
                placeholder="Décris ton problème..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <button
              onClick={handleSubmitTicket}
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black disabled:opacity-60 hover:bg-indigo-700 transition-colors"
            >
              {isSubmitting ? '⏳ Envoi...' : '📤 Envoyer'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-1">Signaler un contenu</h2>
              <p className="text-sm text-gray-500">Aide-nous à garder KPATA AI sûr et respectueux.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ID du job (optionnel)</label>
              <input
                type="text"
                placeholder="Ex: abc123..."
                value={reportJobId}
                onChange={(e) => setReportJobId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Description du problème</label>
              <textarea
                placeholder="Décris ce qui ne va pas..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <button
              onClick={handleSubmitReport}
              disabled={isSubmitting}
              className="w-full bg-red-500 text-white py-4 rounded-xl font-black disabled:opacity-60 hover:bg-red-600 transition-colors"
            >
              {isSubmitting ? '⏳ Envoi...' : '🚨 Signaler'}
            </button>
          </div>
        )}

        <div className="mt-8 bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-bold text-gray-700 mb-2">Autres moyens de contact</p>
          <p className="text-sm text-gray-500">📧 support@kpata.ai</p>
          <p className="text-sm text-gray-500">📱 WhatsApp: +225 XX XX XX XX</p>
        </div>
      </div>
    </div>
  );
}
