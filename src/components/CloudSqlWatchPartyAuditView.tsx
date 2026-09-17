import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, MessageSquare, RefreshCw, Terminal, Layers, ChevronLeft } from 'lucide-react';

interface AuditLogItem {
  id: number;
  party_id: string;
  event_type: string;
  user_name: string;
  details: string;
  created_at: string;
}

interface ChatMessageItem {
  id: number;
  party_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export const CloudSqlWatchPartyAuditView: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [status, setStatus] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'chat'>('audit');
  const [samplePartyId, setSamplePartyId] = useState('demo-party-101');
  const [testMessage, setTestMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statusRes = await fetch('/api/cloud-sql/status');
      const statusData = await statusRes.json();
      setStatus(statusData);

      const auditRes = await fetch('/api/cloud-sql/watch-party/audit?limit=25');
      const auditData = await auditRes.json();
      if (auditData.success) {
        setAuditLogs(auditData.logs);
      }

      const msgRes = await fetch(`/api/cloud-sql/watch-party/messages/${samplePartyId}?limit=25`);
      const msgData = await msgRes.json();
      if (msgData.success) {
        setMessages(msgData.messages);
      }
    } catch (err) {
      console.error('Failed to load Cloud SQL watch party data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateDemoLogs = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/cloud-sql/watch-party/demo-seed', { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to create demo logs:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/cloud-sql/watch-party/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party_id: samplePartyId,
          message: testMessage
        })
      });

      if (res.ok) {
        setTestMessage('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to post test message:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-main)] flex flex-col animate-fadeIn">
      {/* Absolute Back Button Top Left */}
      <div className="absolute top-[env(safe-area-inset-top,0px)] left-0 p-4 z-50">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 active:scale-95 transition"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--accent-gold)]" />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Watch Party Data</h3>
              <p className="text-[11px] text-[var(--text-secondary)] font-mono">balmy-hue-1cf5x</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="w-[44px] h-[44px] rounded-xl flex items-center justify-center bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Connection Status Banner */}
        <div className="p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[var(--text-secondary)]">PostgreSQL Status</span>
            <span className={status?.connected ? 'text-emerald-400 flex items-center gap-1.5' : 'text-amber-400 flex items-center gap-1.5'}>
              <ShieldCheck className="w-4 h-4" />
              {status?.connected ? 'Connected (Backup)' : 'Unconfigured'}
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] font-mono flex items-center justify-between">
            <span>Instance: ai-studio-4cea5145</span>
            <span>{status?.serverTime ? new Date(status.serverTime).toLocaleTimeString() : 'N/A'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex-1 flex items-center justify-center gap-2 h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'audit' ? 'bg-[var(--accent-gold)] text-black' : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'chat' ? 'bg-[var(--accent-gold)] text-black' : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Logs</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="min-h-[250px] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-3 flex flex-col gap-3">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] text-xs gap-3 py-10">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-gold)]" />
              <p>Querying Postgres...</p>
            </div>
          ) : activeTab === 'audit' ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text-primary)] font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> SELECT * FROM party_audit
                </h4>
                {auditLogs.length === 0 && (
                  <button
                    onClick={handleCreateDemoLogs}
                    disabled={submitting}
                    className="text-[10px] font-bold px-2 py-1 bg-[var(--accent-gold)] text-black rounded uppercase min-h-[32px]"
                  >
                    {submitting ? 'Seeding...' : 'Seed Data'}
                  </button>
                )}
              </div>
              
              {auditLogs.length > 0 ? (
                <div className="space-y-2 overflow-y-auto max-h-[350px] pr-1 scrollbar-hide">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[var(--accent-gold)] uppercase tracking-wider">{log.event_type}</span>
                        <span className="text-[9px] text-[var(--text-muted)] font-mono">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-primary)] break-words">
                        <span className="font-bold">{log.user_name}</span> {log.details}
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] font-mono mt-1 pt-1 border-t border-[var(--border-subtle)]">
                        Party ID: {log.party_id}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] font-mono py-10">
                  0 rows returned.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text-primary)] font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> SELECT * FROM party_chat
                </h4>
                <div className="text-[10px] text-[var(--text-secondary)] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10">
                  ID: {samplePartyId}
                </div>
              </div>

              {messages.length > 0 ? (
                <div className="space-y-2 overflow-y-auto max-h-[250px] pr-1 scrollbar-hide flex-1">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{msg.sender_name}</span>
                        <span className="text-[9px] text-[var(--text-muted)] font-mono">{new Date(msg.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed break-words">
                        {msg.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] font-mono py-10">
                  No messages found.
                </div>
              )}

              <form onSubmit={handlePostMessage} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Insert demo message..."
                  className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 text-xs text-[var(--text-primary)] min-h-[44px] focus:outline-none focus:border-[var(--accent-gold)]"
                />
                <button
                  type="submit"
                  disabled={!testMessage.trim() || submitting}
                  className="px-4 rounded-xl bg-[var(--accent-gold)] text-black font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition min-h-[44px]"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
