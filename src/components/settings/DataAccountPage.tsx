import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Download, Trash2, Shield, User, AlertTriangle, FileText, CheckCircle2, RotateCcw } from 'lucide-react';
import { XpAccount } from '../../types';
import { exportUserData, deleteUserAccount } from '../../utils/privacyActions';
import { clearWatchHistory, getActiveUserId } from '../../utils/mediaUtils';
import { auth } from '../../firebase';
import { useTranslation } from '../../i18n/LanguageContext';

interface DataAccountPageProps {
  account: XpAccount;
  onClose: () => void;
  onSignOut: () => void;
}

export const DataAccountPage: React.FC<DataAccountPageProps> = ({ account, onClose, onSignOut }) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleClearHistory = async () => {
    setIsClearingHistory(true);
    setError(null);
    setSuccess(null);
    try {
      const activeUid = getActiveUserId(account?.userId);
      await clearWatchHistory(activeUid);
      setSuccess(t('dataAccount.clearSuccess', undefined, 'Watch history and progress cleared successfully.'));
      setShowClearHistoryConfirm(false);
    } catch (err) {
      console.error(err);
      setError(t('dataAccount.clearError', undefined, 'Failed to clear watch history.'));
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const historyStr = localStorage.getItem('farukat_watch_history_v1');
      const favStr = localStorage.getItem('farukat_favorites_v1');
      const likeStr = localStorage.getItem('farukat_likes_v1');
      
      const history = historyStr ? JSON.parse(historyStr) : [];
      const favs = favStr ? JSON.parse(favStr) : [];
      const likes = likeStr ? JSON.parse(likeStr) : [];
      
      await exportUserData(account, history, favs, likes);
      setSuccess(t('dataAccount.exportSuccess', undefined, 'Data export created successfully.'));
    } catch (err) {
      console.error(err);
      setError(t('dataAccount.exportError', undefined, "Couldn't create your data export."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setError(null);
    
    try {
      await deleteUserAccount();
      onSignOut();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError(t('dataAccount.recentLoginRequired', undefined, 'For security, please sign out and sign in again before deleting your account.'));
      } else {
        setError(t('dataAccount.deleteError', undefined, "Couldn't delete account. Please try again."));
      }
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const memberId = account.profile?.memberId || 'GUEST';
  const isGuest = memberId === 'GUEST-0000';
  const email = account.profile?.email || auth.currentUser?.email || 'Not provided';
  const joinDate = account.profile?.memberSince 
    ? new Date(account.profile.memberSince).toLocaleDateString()
    : 'Unknown';

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[var(--bg-main)] flex flex-col animate-fadeIn">
      {/* Absolute Back Button Top Left */}
      <div className="absolute top-[env(safe-area-inset-top,0px)] left-0 p-4 z-50">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 active:scale-95 transition"
          aria-label={t('common.back', undefined, 'Go back')}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] pb-6 flex flex-col gap-6 w-full max-w-md mx-auto">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('dataAccount.title', undefined, 'Data & Account')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('dataAccount.subtitle', undefined, 'Manage your personal information and privacy.')}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-xs leading-relaxed">{success}</p>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-[var(--accent-gold)] uppercase tracking-wider">{t('dataAccount.accountInfo', undefined, 'Account Information')}</h2>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-[var(--text-secondary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{account.profile?.name || 'Anonymous'}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{email}</p>
              </div>
            </div>
            
            <div className="pt-3 border-t border-[var(--divider-hairline)] grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider mb-1">{t('profile.memberId', undefined, 'Member ID')}</p>
                <p className="text-xs text-[var(--text-primary)] font-mono">{memberId}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider mb-1">{t('profile.memberSince', undefined, 'Joined')}</p>
                <p className="text-xs text-[var(--text-primary)]">{joinDate}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-[var(--accent-gold)] uppercase tracking-wider">{t('dataAccount.downloadData', undefined, 'Download Your Data')}</h2>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-4">
              <FileText className="w-5 h-5 text-[var(--text-secondary)] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)] mb-1">{t('dataAccount.exportDataTitle', undefined, 'Export Account Data')}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t('dataAccount.exportDataDesc', undefined, 'Download a JSON file containing your watch history, favorites, likes, and progression data.')}
                </p>
              </div>
            </div>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold text-xs active:bg-white/5 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? t('dataAccount.exporting', undefined, 'Exporting...') : t('dataAccount.requestExport', undefined, 'Request Data Export')}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-[var(--accent-gold)] uppercase tracking-wider">{t('dataAccount.watchHistory', undefined, 'Watch History')}</h2>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-4">
              <RotateCcw className="w-5 h-5 text-[var(--text-secondary)] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)] mb-1">{t('dataAccount.clearWatchHistoryTitle', undefined, 'Clear Watch History & Progress')}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t('dataAccount.clearWatchHistoryDesc', undefined, 'Reset all saved video progress, continue watching records, and watched title lists across devices.')}
                </p>
              </div>
            </div>
            {showClearHistoryConfirm ? (
              <div className="space-y-3 p-3 bg-red-500/10 rounded-xl">
                <p className="text-xs font-bold text-red-400 text-center">{t('dataAccount.confirmClearHistory', undefined, 'Clear all watch history and progress?')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearHistoryConfirm(false)}
                    disabled={isClearingHistory}
                    className="flex-1 h-10 rounded-xl bg-neutral-800 text-white font-semibold text-xs transition"
                  >
                    {t('common.cancel', undefined, 'Cancel')}
                  </button>
                  <button
                    onClick={handleClearHistory}
                    disabled={isClearingHistory}
                    className="flex-1 h-10 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {isClearingHistory ? t('dataAccount.clearing', undefined, 'Clearing...') : t('dataAccount.clearHistoryBtn', undefined, 'Clear History')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearHistoryConfirm(true)}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-xs active:bg-red-500/20 transition"
              >
                <Trash2 className="w-4 h-4" />
                {t('dataAccount.clearHistoryBtn', undefined, 'Clear Watch History')}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider">{t('dataAccount.dangerZone', undefined, 'Danger Zone')}</h2>
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-400 mb-1">{t('dataAccount.deleteAccountTitle', undefined, 'Delete Account')}</p>
                <p className="text-xs text-red-400/80 leading-relaxed">
                  {t('dataAccount.deleteAccountDesc', undefined, 'Permanently delete your account, watch history, achievements, and all associated data. This action cannot be undone.')}
                </p>
              </div>
            </div>
            
            {showDeleteConfirm ? (
              <div className="space-y-3 p-3 bg-red-500/10 rounded-xl">
                <p className="text-xs font-bold text-red-400 text-center">{t('dataAccount.confirmDelete', undefined, 'Are you absolutely sure?')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 h-10 rounded-xl bg-neutral-800 text-white font-semibold text-xs transition"
                  >
                    {t('common.cancel', undefined, 'Cancel')}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex-1 h-10 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {isDeleting ? t('dataAccount.deleting', undefined, 'Deleting...') : t('common.yes', undefined, 'Yes, Delete')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isGuest}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-xs active:bg-red-500/20 transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isGuest ? t('dataAccount.guestDeleteNotice', undefined, 'Guest accounts cannot be deleted') : t('dataAccount.deleteBtn', undefined, 'Delete Account')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
