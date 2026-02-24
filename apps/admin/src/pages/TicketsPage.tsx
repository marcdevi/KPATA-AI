import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from '../components/ui/use-toast';

interface Ticket {
  id: string;
  profile_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  last_message_at: string;
  profiles?: { phone_e164: string };
}

interface TicketMessage {
  id: string;
  sender_profile_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketsResponse {
  tickets: Ticket[];
  pagination: { total: number };
}

const MACROS = [
  { label: 'Salutation', text: 'Bonjour ! Comment puis-je vous aider ?' },
  { label: 'Remboursement effectué', text: 'Votre crédit a été remboursé. Vous pouvez vérifier votre solde.' },
  { label: 'Problème technique', text: 'Nous avons identifié un problème technique. Notre équipe travaille dessus.' },
  { label: 'Clôture', text: 'Merci de nous avoir contactés. N\'hésitez pas si vous avez d\'autres questions !' },
];

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.get<TicketsResponse>('/admin/tickets?status=open'),
  });

  const { data: messagesData } = useQuery({
    queryKey: ['ticket-messages', selectedTicket],
    queryFn: () => api.get<{ messages: TicketMessage[] }>(`/admin/tickets/${selectedTicket}/messages`),
    enabled: !!selectedTicket,
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/admin/tickets/${selectedTicket}/reply`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', selectedTicket] });
      setReplyText('');
      toast({ title: 'Message envoyé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/admin/tickets/${selectedTicket}/close`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setSelectedTicket(null);
      toast({ title: 'Ticket fermé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    replyMutation.mutate(replyText);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'secondary'> = {
      open: 'warning',
      in_progress: 'secondary',
      closed: 'success',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support Inbox</h1>
        <p className="text-muted-foreground">Gestion des tickets de support</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ticket List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Tickets ouverts ({ticketsData?.tickets?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-4 text-muted-foreground">Chargement...</p>
            ) : ticketsData?.tickets?.length === 0 ? (
              <p className="p-4 text-muted-foreground">Aucun ticket ouvert</p>
            ) : (
              <div className="divide-y">
                {ticketsData?.tickets?.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`cursor-pointer p-4 hover:bg-muted/50 ${
                      selectedTicket === ticket.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedTicket(ticket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{ticket.subject}</p>
                        <p className="text-sm text-muted-foreground">
                          {ticket.profiles?.phone_e164}
                        </p>
                      </div>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(ticket.last_message_at || ticket.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation */}
        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Conversation</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => closeMutation.mutate()}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Fermer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Messages */}
                <div className="mb-4 max-h-96 space-y-3 overflow-y-auto">
                  {messagesData?.messages?.map((msg) => {
                    const currentTicket = ticketsData?.tickets?.find(t => t.id === selectedTicket);
                    const isAgent = msg.sender_profile_id !== currentTicket?.profile_id;
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg p-3 ${
                          isAgent
                            ? 'ml-8 bg-primary text-primary-foreground'
                            : 'mr-8 bg-muted'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className="mt-1 text-xs opacity-70">
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Macros */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {MACROS.map((macro) => (
                    <Button
                      key={macro.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setReplyText(macro.text)}
                    >
                      {macro.label}
                    </Button>
                  ))}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleReply} className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Votre réponse..."
                    className="flex-1"
                  />
                  <Button type="submit" disabled={replyMutation.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-96 items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-12 w-12" />
                <p>Sélectionnez un ticket pour voir la conversation</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
