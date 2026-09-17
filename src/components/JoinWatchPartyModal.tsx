import React, { useState, useRef, useEffect } from 'react';
import { Users, X, Tv, Sparkles, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { joinWatchPartyByCode, subscribeToLivePublicParties, joinPublicWatchParty, WatchPartyDoc } from '../utils/watchPartyManager';

interface JoinWatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoFillCode?: string;
}

export const JoinWatchPartyModal: React.FC<JoinWatchPartyModalProps> = ({
  isOpen,
  onClose,
  autoFillCode = '',
}) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joiningHostName, setJoiningHostName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'code' | 'public'>('code');
  const [publicParties, setPublicParties] = useState<WatchPartyDoc[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (autoFillCode) {
        // ... (existing code for auto-fill)
        const clean = autoFillCode.toUpperCase().slice(0, 7);
        setCode(clean);
        handleJoinCode(clean);
      } else {
        // ... (existing reset logic)
        setCode('');
        setErrorMessage(null);
        setJoiningHostName(null);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150);
      }
    }
  }, [isOpen, autoFillCode]);

  useEffect(() => {
    if (isOpen && activeTab === 'public') {
        return subscribeToLivePublicParties((parties) => {
            setPublicParties(parties);
        });
    }
  }, [isOpen, activeTab]);


  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    setCode(val);
    setErrorMessage(null);
  };

  const handleJoinCode = async (targetCode: string) => {
    if (targetCode.length !== 7 && targetCode.length !== 6) {
      setErrorMessage('Please enter a complete 6 or 7-character party code.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await joinWatchPartyByCode(targetCode);
      if (res.success && res.partyData) {
        // Show brief confirmation state with host name
        setJoiningHostName(res.partyData.hostName);
        
        // Wait 1 second for beautiful UX transition, then open player
        setTimeout(() => {
          setIsSubmitting(false);
          setJoiningHostName(null);
          onClose();
          // Launch synced watch party player
          if ((window as any).__setActiveWatchParty) {
            (window as any).__setActiveWatchParty(res.partyData);
          }
        }, 1200);
      } else {
        setErrorMessage(res.message || 'Invalid or expired code. Please check and try again.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to join watch party.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoinCode(code);
  };

  // Render individual 7 boxes
  const renderBoxes = () => {
    const maxLen = 7;
    const boxes = [];
    for (let i = 0; i < maxLen; i++) {
      const char = code[i] || '';
      const isFocused = code.length === i;
      boxes.push(
        <div
          key={i}
          className={`w-9 h-14 sm:w-11 sm:h-16 rounded-xl border flex items-center justify-center text-xl font-black font-mono transition-all select-none ${
            isFocused
              ? 'border-[#e2b14c] bg-[#e2b14c]/5 shadow-[0_0_12px_rgba(226,177,76,0.25)] scale-105'
              : char
              ? 'border-white/20 bg-white/5 text-white'
              : 'border-white/10 bg-white/2'
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          {char}
        </div>
      );
    }
    return boxes;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fadeIn">
      <div className="bg-[var(--bg-main)] border border-white/10 w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative text-[var(--text-primary)]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#e2b14c]/20 text-[#e2b14c] flex items-center justify-center">
                <Users className="w-4 h-4 stroke-[2.5]" />
              </div>
              <h3 className="text-sm font-bold tracking-wide">Join Watch Party</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl">
             <button onClick={() => setActiveTab('code')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'code' ? 'bg-[#e2b14c] text-black' : 'text-white'}`}>Join with Code</button>
             <button onClick={() => setActiveTab('public')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'public' ? 'bg-[#e2b14c] text-black' : 'text-white'}`}>Public Parties</button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          {activeTab === 'public' ? (
            /* Public Parties List State */
            <div className="flex flex-col gap-3">
              {publicParties.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--text-muted)]">No public parties live right now.</div>
              ) : (
                publicParties.map((p) => (
                  <div key={p.partyId} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{p.mediaTitle}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Hosted by {p.hostName}</p>
                    </div>
                    <button
                        onClick={async () => {
                           const res = await joinPublicWatchParty(p.partyId);
                           if (res.success && res.partyData) {
                             onClose();
                             if ((window as any).__setActiveWatchParty) {
                                (window as any).__setActiveWatchParty(res.partyData);
                             }
                           }
                        }}
                        className="bg-[#e2b14c] text-black text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                    >Join</button>
                  </div>
                ))
              )}
            </div>
          ) : joiningHostName ? (
            /* ... existing confirmation state ... */
            <div className="flex flex-col items-center justify-center py-8 text-center gap-4 animate-fadeIn">
              {/* ... (keep existing) ... */}
            </div>
          ) : (
            /* Enter Code Form State */
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* ... (existing code form) ... */}
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-white/10 bg-white/5 text-[11px] text-[var(--text-muted)] text-center flex items-center justify-center gap-1.5 shrink-0">
          <Tv className="w-3.5 h-3.5 text-[#e2b14c]" />
          <span>Stream live and chat together in real-time with zero lag</span>
        </div>
      </div>
    </div>
  );
};
