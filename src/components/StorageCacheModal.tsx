import React, { useState, useEffect } from 'react';
import { HardDrive, X, Image as ImageIcon, Trash2, AlertTriangle, CheckCircle2, RotateCcw, ChevronLeft } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import {
  StorageStats,
  getStorageStats,
  clearImageCache,
  clearTemporaryData,
  clearAllCache,
  formatBytes
} from '../utils/storageManager';

interface StorageCacheModalProps {
  onClose: () => void;
}

export const StorageCacheModal: React.FC<StorageCacheModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingImage, setIsClearingImage] = useState(false);
  const [isClearingTemp, setIsClearingTemp] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  
  const [confirmClearImage, setConfirmClearImage] = useState(false);
  const [confirmClearTemp, setConfirmClearTemp] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const s = await getStorageStats();
      setStats(s);
    } catch (err) {
      console.error('Failed to load storage stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setToastError(isError);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleClearImageCache = async () => {
    setConfirmClearImage(false);
    setIsClearingImage(true);
    try {
      await clearImageCache();
      await fetchStats();
      showToast(t('storage.toastImageCleared', undefined, 'Image cache cleared successfully.'));
    } catch (e) {
      showToast(t('storage.toastImageFailed', undefined, "Couldn't clear image cache."), true);
    } finally {
      setIsClearingImage(false);
    }
  };

  const handleClearTempData = async () => {
    setConfirmClearTemp(false);
    setIsClearingTemp(true);
    try {
      await clearTemporaryData();
      await fetchStats();
      showToast(t('storage.toastTempCleared', undefined, 'Temporary data cleared successfully.'));
    } catch (e) {
      showToast(t('storage.toastTempFailed', undefined, "Couldn't clear temporary data."), true);
    } finally {
      setIsClearingTemp(false);
    }
  };

  const handleClearAll = async () => {
    setConfirmClearAll(false);
    setIsClearingAll(true);
    try {
      await clearAllCache();
      await fetchStats();
      showToast(t('storage.toastAllCleared', undefined, 'All cache cleared successfully.'));
    } catch (e) {
      showToast(t('storage.toastAllFailed', undefined, "Couldn't clear all cache."), true);
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col animate-fadeIn">
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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] pb-6 flex flex-col gap-6 w-full max-w-md mx-auto">
        
        {/* Total Overview */}
        <div className="flex flex-col items-center justify-center py-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/5">
          <HardDrive className="w-8 h-8 text-[var(--accent-gold)] mb-3 opacity-80" />
          <div className="text-4xl font-black text-white tracking-tight">
            {isLoading ? <span className="animate-pulse opacity-50">--</span> : formatBytes(stats?.total || 0)}
          </div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-2">{t('storage.totalCache', undefined, 'Total App Cache')}</span>
        </div>

        {/* Image Cache Row */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="w-[44px] h-[44px] rounded-xl bg-[var(--accent-gold)]/10 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-[var(--accent-gold)]" />
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="text-sm font-bold text-white">{t('storage.imageCache', undefined, 'Image Cache')}</h3>
                <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{t('storage.imageCacheDesc', undefined, 'Posters and thumbnails.')}</p>
              </div>
            </div>
            <div className="text-right flex flex-col justify-center min-h-[44px]">
              <span className="text-sm font-black text-white">
                {isLoading ? '--' : formatBytes(stats?.imageCache || 0)}
              </span>
            </div>
          </div>

          {confirmClearImage ? (
            <div className="flex flex-col gap-3 p-4 bg-red-950/20 border border-red-900/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t('storage.deleteImagesConfirm', undefined, 'Delete cached images?')}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClearImage(false)} className="flex-1 h-[44px] bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white text-xs transition">{t('common.cancel', undefined, 'Cancel')}</button>
                <button onClick={handleClearImageCache} className="flex-1 h-[44px] bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white text-xs transition">{t('common.clear', undefined, 'Clear')}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearImage(true)}
              disabled={isLoading || isClearingImage || (stats?.imageCache === 0)}
              className="w-full h-[44px] bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition"
            >
              {isClearingImage ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{t('storage.clearImageCache', undefined, 'Clear Image Cache')}</span>
            </button>
          )}
        </div>

        {/* Temporary Data Row */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="w-[44px] h-[44px] rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="text-sm font-bold text-white">{t('storage.tempData', undefined, 'Temporary Data')}</h3>
                <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{t('storage.tempDataDesc', undefined, 'Cached API and local states.')}</p>
              </div>
            </div>
            <div className="text-right flex flex-col justify-center min-h-[44px]">
              <span className="text-sm font-black text-white">
                {isLoading ? '--' : formatBytes(stats?.tempData || 0)}
              </span>
            </div>
          </div>
          
          {confirmClearTemp ? (
            <div className="flex flex-col gap-3 p-4 bg-red-950/20 border border-red-900/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t('storage.deleteTempConfirm', undefined, 'Delete temporary data?')}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClearTemp(false)} className="flex-1 h-[44px] bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white text-xs transition">{t('common.cancel', undefined, 'Cancel')}</button>
                <button onClick={handleClearTempData} className="flex-1 h-[44px] bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white text-xs transition">{t('common.clear', undefined, 'Clear')}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearTemp(true)}
              disabled={isLoading || isClearingTemp || (stats?.tempData === 0)}
              className="w-full h-[44px] bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition"
            >
              {isClearingTemp ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{t('storage.clearTempData', undefined, 'Clear Temporary Data')}</span>
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-neutral-500 font-medium px-4 leading-relaxed">
          {t('storage.note', undefined, 'Note: Clearing cache will NOT delete your account, watch history, favorites, or achievements.')}
        </p>
      </div>

      {/* Sticky Footer */}
      <div className="p-4 border-t border-white/5 bg-[#0a0a0a] shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        {confirmClearAll ? (
          <div className="flex flex-col gap-4 p-4 bg-red-950/20 border border-red-900/30 rounded-2xl">
            <div className="flex items-start gap-3 text-red-400 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="leading-relaxed">{t('storage.clearAllConfirm', undefined, 'This removes all temporary cached files. Your permanent data is safe.')}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClearAll(false)} className="flex-1 h-[52px] bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white text-sm transition">{t('common.cancel', undefined, 'Cancel')}</button>
              <button onClick={handleClearAll} className="flex-1 h-[52px] bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white text-sm transition">{t('storage.clearAll', undefined, 'Clear All')}</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClearAll(true)}
            disabled={isLoading || isClearingAll || (stats?.total === 0)}
            className="w-full h-[52px] rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 text-red-400 font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition text-sm"
          >
            {isClearingAll ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            <span>{t('storage.clearAll', undefined, 'Clear All Cache')}</span>
          </button>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 animate-slideUp"
             style={{ 
               backgroundColor: toastError ? '#3f0000' : '#141414',
               borderColor: toastError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
               color: toastError ? '#fca5a5' : '#fff'
             }}>
          {toastError ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
          <span className="whitespace-nowrap">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
