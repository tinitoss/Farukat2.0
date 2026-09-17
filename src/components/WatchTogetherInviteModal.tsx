import React, { useState, useEffect } from 'react';
import { Users, X, Copy, Share2, Check, Loader2, Tv, Sparkles, AlertCircle, Calendar, Shield, Globe, Clock } from 'lucide-react';
import { MediaItem, Episode } from '../types';
import { createWatchPartyByHost, createScheduledWatchParty, WatchPartyDoc } from '../utils/watchPartyManager';

interface WatchTogetherInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem;
  episode?: Episode;
  existingParty?: WatchPartyDoc | null;
}

export const WatchTogetherInviteModal: React.FC<WatchTogetherInviteModalProps> = ({
  isOpen,
  onClose,
  media,
  episode,
  existingParty = null,
}) => {
  const [party, setParty] = useState<WatchPartyDoc | null>(existingParty);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Discoverability and Scheduling States
  const [isPublic, setIsPublic] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // Sync state if existingParty changes or when opening/closing
  useEffect(() => {
    if (isOpen) {
      setParty(existingParty);
      setErrorMessage(null);
      setCopiedCode(false);
      setCopiedLink(false);
      setIsPublic(false);
      setIsScheduled(false);
      setScheduleDate('');
      setScheduleTime('');
      setScheduleSuccess(false);
    }
  }, [isOpen, existingParty]);

  if (!isOpen) return null;

  const mediaTitle = episode ? `${media.title} - ${episode.title}` : media.title;
  const roomCode = party?.roomCode || '';
  const inviteUrl = `${window.location.origin}/watch-party/${roomCode}`;

  const handleStartParty = async () => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const res = await createWatchPartyByHost(media, episode, isPublic);
      if (res.success && res.partyData) {
        setParty(res.partyData);
      } else {
        setErrorMessage(res.message || 'Failed to start watch party.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error starting watch party.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleScheduleParty = async () => {
    if (!scheduleDate || !scheduleTime) {
      setErrorMessage('Please select both a date and a time to schedule.');
      return;
    }
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const dateTimeStr = `${scheduleDate}T${scheduleTime}`;
      const scheduledTimestamp = new Date(dateTimeStr).getTime();
      if (isNaN(scheduledTimestamp)) {
        setErrorMessage('Invalid date or time selected.');
        setIsCreating(false);
        return;
      }
      if (scheduledTimestamp <= Date.now()) {
        setErrorMessage('Please schedule for a future date and time.');
        setIsCreating(false);
        return;
      }

      const res = await createScheduledWatchParty(media, episode, scheduledTimestamp, isPublic);
      if (res.success) {
        setScheduleSuccess(true);
      } else {
        setErrorMessage(res.message || 'Failed to schedule watch party.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error scheduling watch party.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleCopyLink = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleNativeShare = async () => {
    if (!roomCode) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join my FARUKAT Cinema Watch Party!`,
          text: `Join my watch party for "${mediaTitle}"! Code: ${roomCode}`,
          url: inviteUrl,
        });
      } else {
        // Fallback copy link if native share is not supported
        handleCopyLink();
      }
    } catch (err) {
      console.warn('Native share failed or dismissed:', err);
    }
  };

  const handleLaunchPlayer = () => {
    if (party) {
      onClose();
      // Set the active watch party globally to launch the synchronized player
      if ((window as any).__setActiveWatchParty) {
        (window as any).__setActiveWatchParty(party);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fadeIn">
      <div className="bg-[var(--bg-main)] border border-white/10 w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative text-[var(--text-primary)]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e2b14c]/20 text-[#e2b14c] flex items-center justify-center">
              <Users className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">Watch Together</h3>
              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[220px]">
                {mediaTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto min-h-0 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-red-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {scheduleSuccess ? (
            /* Dedicated Schedule Success Screen */
            <div className="flex flex-col items-center justify-center text-center py-8 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                <Calendar className="w-8 h-8" />
              </div>

              <div className="flex flex-col gap-1.5 max-w-xs">
                <h4 className="text-sm font-bold text-white">Party Scheduled</h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Your scheduled party for <span className="text-[#e2b14c] font-semibold">{scheduleDate} {scheduleTime}</span> is set. It will appear under upcoming watch parties on the Home page.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full min-h-[44px] bg-[#e2b14c] hover:brightness-110 text-black font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : !party ? (
            /* Host Invitation Landing: Tap to Start Watch Party */
            <div className="flex flex-col gap-5 py-2">
              {/* Toggle 1: Live Now vs Schedule for Later */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setIsScheduled(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    !isScheduled
                      ? 'bg-[#e2b14c] text-black shadow-md'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Watch Live Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsScheduled(true)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isScheduled
                      ? 'bg-[#e2b14c] text-black shadow-md'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule for Later</span>
                </button>
              </div>

              {/* Toggle 2: Private vs Public */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Discoverability
                </label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      !isPublic
                        ? 'bg-[#e2b14c] text-black shadow-md'
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Private (code only)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isPublic
                        ? 'bg-[#e2b14c] text-black shadow-md'
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Public (anyone can join)</span>
                  </button>
                </div>
              </div>

              {/* Scheduling Inputs */}
              {isScheduled && (
                <div className="space-y-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#e2b14c]" />
                      <span>Select Date</span>
                    </label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-[#e2b14c] transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#e2b14c]" />
                      <span>Select Time</span>
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-[#e2b14c] transition"
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <button
                type="button"
                onClick={isScheduled ? handleScheduleParty : handleStartParty}
                disabled={isCreating}
                className="w-full min-h-[44px] bg-[#e2b14c] hover:brightness-110 disabled:bg-white/5 disabled:text-[var(--text-muted)] disabled:border-white/10 text-black font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#e2b14c]/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer mt-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isScheduled ? 'Scheduling Party...' : 'Creating Party Room...'}</span>
                  </>
                ) : (
                  <>
                    {isScheduled ? <Calendar className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                    <span>{isScheduled ? 'Schedule Party' : 'Start Watch Party'}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Dedicated "Watch Party Started" Screen */
            <div className="flex flex-col gap-5 py-2 animate-fadeIn">
              <div className="flex flex-col items-center text-center gap-1">
                <span className="text-[10px] text-[#e2b14c] font-mono tracking-widest uppercase flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Watch Party Active</span>
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Share this code with your friend to connect
                </p>
              </div>

              {/* Monospace Code Display */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 relative group overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#e2b14c]/30 to-transparent" />
                <span className="text-4xl font-black font-mono tracking-[0.25em] pl-[0.25em] text-[#e2b14c] select-all">
                  {roomCode}
                </span>
              </div>

              {/* Action Grid */}
              <div className="flex flex-col gap-2.5">
                {/* 1. Copy Code */}
                <button
                  onClick={handleCopyCode}
                  className="w-full min-h-[44px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center justify-between px-4 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-4 h-4 text-[#e2b14c]" />
                    <span>Copy Party Code</span>
                  </div>
                  {copiedCode ? (
                    <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Copied!</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{roomCode}</span>
                  )}
                </button>

                {/* 2. Copy Invite Link */}
                <button
                  onClick={handleCopyLink}
                  className="w-full min-h-[44px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center justify-between px-4 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Tv className="w-4 h-4 text-[#e2b14c]" />
                    <span>Copy Invite Link</span>
                  </div>
                  {copiedLink ? (
                    <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Copied!</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[120px]">
                      Copy Link
                    </span>
                  )}
                </button>

                {/* 3. Native Share */}
                <button
                  onClick={handleNativeShare}
                  className="w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#e2b14c]" />
                  <span>Share Invite Code</span>
                </button>
              </div>

              {/* Launch Player Action */}
              <div className="pt-2">
                <button
                  onClick={handleLaunchPlayer}
                  className="w-full min-h-[44px] bg-[#e2b14c] hover:brightness-110 text-black font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#e2b14c]/10 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Tv className="w-4 h-4" />
                  <span>Launch Synced Player</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-white/10 bg-white/5 text-[11px] text-[var(--text-muted)] text-center flex items-center justify-center gap-1.5 shrink-0">
          <Tv className="w-3.5 h-3.5 text-[#e2b14c]" />
          <span>Stream starts in sync once any participant joins the party</span>
        </div>
      </div>
    </div>
  );
};
