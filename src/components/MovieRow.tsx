import React, { useRef, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../types';
import { MovieCard } from './MovieCard';
import { usePreloadUpcoming } from '../utils/imagePreloader';

interface MovieRowProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  variant?: 'portrait' | 'landscape';
  badge?: string;
}

export const MovieRow: React.FC<MovieRowProps> = memo(({
  title,
  subtitle,
  items,
  onPlay,
  onOpenDetail,
  watchlist,
  onToggleWatchlist,
  variant = 'portrait',
  badge,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  // Preload upcoming row items to prevent flickering during scroll
  usePreloadUpcoming(items, 8);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="py-3 sm:py-4 select-none">
      {/* Row Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            {title}
            {badge && (
              <span className="px-2 py-0.5 rounded-full bg-[#e50914]/15 border border-[#e50914]/30 text-[#fca5a5] text-[10px] font-bold uppercase tracking-wider">
                {badge}
              </span>
            )}
          </h2>
          <span className="text-xs text-[var(--text-muted)] font-medium">({items.length})</span>
        </div>

        {/* Scroll Controls (Desktop visible) */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full bg-[var(--bg-card)] hover:bg-[#1f1f1f] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition active:scale-95 cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full bg-[var(--bg-card)] hover:bg-[#1f1f1f] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition active:scale-95 cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {subtitle && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-1.5 mb-2">
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
      )}

      {/* Horizontal Scroll Track */}
      <div
        ref={rowRef}
        className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none px-4 sm:px-6 py-1 scroll-smooth"
      >
        {items.map((item) => (
          <MovieCard
            key={item.id}
            item={item}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            inWatchlist={watchlist.includes(item.id)}
            onToggleWatchlist={onToggleWatchlist}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
});

