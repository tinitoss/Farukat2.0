import React, { useState, useEffect } from 'react';
import { 
  Tv, 
  Play, 
  Clock, 
  Search, 
  Trash2, 
  Film,
  Calendar,
  Sparkles
} from 'lucide-react';
import { XpAccount, WatchProgress } from '../types';
import { getWatchHistory, clearWatchHistory, getActiveUserId, formatTime } from '../utils/mediaUtils';
import { MEDIA_CATALOG } from '../data/mediaData';
import { useTranslation } from '../i18n/LanguageContext';

interface HistoryViewProps {
  account: XpAccount;
  onSelectMedia: (media: any) => void;
  onClose?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ account, onSelectMedia }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [watchHistory, setWatchHistory] = useState<WatchProgress[]>([]);

  const userId = getActiveUserId(account?.userId);
  const isHistoryHidden = Boolean(account?.stats?.hideHistory);

  useEffect(() => {
    if (userId && userId !== 'guest') {
      const history = getWatchHistory(userId);
      setWatchHistory(history);
    }
  }, [userId]);

  const watchedItems = (Array.isArray(watchHistory) ? watchHistory : []).map(w => {
    const media = MEDIA_CATALOG.find(m => m.id === w.mediaId);
    return { ...w, mediaItem: media };
  }).filter(w => w.mediaItem);

  const filteredItems = watchedItems.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = item.mediaTitle?.toLowerCase().includes(query) || item.mediaItem?.title?.toLowerCase().includes(query);
    const episodeMatch = item.episodeTitle?.toLowerCase().includes(query);
    return titleMatch || episodeMatch;
  });

  const handleClearHistory = async () => {
    if (userId && userId !== 'guest') {
      await clearWatchHistory(userId);
      setWatchHistory([]);
    }
  };

  if (isHistoryHidden) {
    return (
      <div className="w-full min-h-[60vh] bg-[var(--bg-main)] text-[var(--text-primary)] font-sans px-4 py-8 max-w-3xl mx-auto flex flex-col items-center justify-center text-center animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-[#121212] border border-white/10 flex items-center justify-center text-zinc-500 mb-4">
          <Tv className="w-7 h-7 opacity-50" />
        </div>
        <h2 className="text-base font-black text-white mb-1.5">{t('history.pausedTitle', undefined, 'Watch History Paused')}</h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-sm leading-relaxed">
          {t('history.pausedDesc', undefined, 'History recording is disabled in your account settings. Videos you watch are not being saved.')}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full text-[var(--text-primary)] font-sans select-none animate-fadeIn pb-12">
      {/* Header Info & Search */}
      <div className="mb-4 bg-[#0d0d0d] border border-white/10 p-3.5 sm:p-4 rounded-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-black text-[var(--text-primary)] tracking-tight">
              {t('history.title', undefined, 'Watch History')}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-normal mt-0.5">
              {t('history.subtitle', undefined, 'Continue watching your saved titles and resumed playback.')}
            </p>
          </div>
          {watchedItems.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-white/5 hover:border-red-900/30 transition text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              title={t('history.clearAllTitle', undefined, 'Clear all watch history')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">{t('history.clearBtn', undefined, 'Clear')}</span>
            </button>
          )}
        </div>

        {/* Search input if history has items */}
        {watchedItems.length > 3 && (
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('history.searchPlaceholder', undefined, 'Search watched titles...')}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141414] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e2b14c]"
            />
          </div>
        )}
      </div>

      {/* Watched Videos List */}
      {watchedItems.length === 0 ? (
        <div className="p-10 text-center bg-[#0d0d0d] border border-white/10 rounded-2xl flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 mb-3">
            <Film className="w-6 h-6 opacity-40" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">{t('history.noWatchedTitle', undefined, 'No Watched Videos')}</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs">
            {t('history.noWatchedDesc', undefined, 'Start streaming films or series to resume playback directly from here.')}
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-[#0d0d0d] border border-white/10 rounded-2xl">
          <p className="text-xs text-zinc-400">{t('history.noMatch', { query: searchQuery }, `No watched titles matching "${searchQuery}"`)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item, idx) => {
            const percent = item.duration ? Math.min(100, Math.round((item.currentTime / item.duration) * 100)) : 0;
            return (
              <div
                key={`${item.mediaId}-${item.episodeId || idx}`}
                id={`history-card-${item.mediaId}`}
                onClick={() => onSelectMedia(item.mediaItem)}
                className="bg-[#0d0d0d] border border-white/10 hover:border-[#e2b14c]/50 p-3 rounded-2xl flex gap-3 transition group cursor-pointer select-none"
              >
                <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-black shrink-0 border border-white/10">
                  <img
                    src={item.mediaThumbnail || item.mediaItem?.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                    alt={item.mediaTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <div className="w-8 h-8 rounded-full bg-[#e2b14c] text-black flex items-center justify-center shadow-lg">
                      <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-xs border border-white/10 text-[9px] font-mono font-bold text-[#e2b14c]">
                    {percent}%
                  </div>
                </div>

                <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <div className="text-[9px] font-black text-[#e2b14c] uppercase tracking-wider mb-0.5">
                      {item.mediaItem?.category || 'Movie'}
                    </div>
                    <h3 className="text-xs font-bold text-white line-clamp-1 leading-snug group-hover:text-[#e2b14c] transition">
                      {item.mediaTitle}
                    </h3>
                    {item.episodeTitle && (
                      <div className="text-[10px] text-[var(--text-secondary)] line-clamp-1 mt-0.5">
                        {item.episodeTitle}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 mt-2">
                    <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full bg-[#e2b14c]" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] font-mono">
                      <span>{formatTime(item.currentTime)} / {formatTime(item.duration)}</span>
                      <span>{new Date(item.lastWatchedAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
