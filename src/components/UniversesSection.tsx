import React, { useMemo, useState, useEffect } from 'react';
import { Check, Clock } from 'lucide-react';
import { getSagaItemsForUniverse, calculateSagaTotalDuration } from '../utils/sagaManager';
import { MEDIA_CATALOG } from '../data/mediaData';
import { useTranslation } from '../i18n/LanguageContext';

export interface UniverseItem {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  bgImage: string;
  accentColor: string;
}

export interface CharacterGroup {
  name: string;
  badge?: string;
  characters: string[];
}

export interface SagaPillar {
  title: string;
  tag?: string;
  description: string;
  characters?: string[];
}

export interface SagaInfoDetail {
  title: string;
  subtitle?: string;
  overview: string;
  characters?: string[];
  characterGroups?: CharacterGroup[];
  pillars?: SagaPillar[];
  distinctSagaText?: string;
  chronologyText?: string;
  climaxText?: string;
}

export const SAGA_INFO_DETAILS: Record<string, SagaInfoDetail> = {
  'dardi-ladi': {
    title: 'BANESA',
    subtitle: 'The Shared Universe: Dardi & Ladi × Baba Ramiz × 3 Mangupat × Detektivi',
    overview:
      'Dardi & Ladi is one of our most prestigious works and one of the stories we are most proud to have told. But this is more than just the Dardi & Ladi saga — it is part of the larger Baba Ramiz saga, with both stories existing within the same universe.\n\nThe world brings together Dardi, Ladi, Baca Bush, La Zenun, Ismeti, Bajrushi, Asllani, Petriti, Rrustemi, Hajrullahi, Aga Avdi, Mixha Nagip, Yllza, Emira, Rifati, Ladmiri, Avdushi, and other characters whose stories unfold across different movies.',
    characterGroups: [
      {
        name: 'Dardi & Ladi / Baba Ramiz Universe Ensemble',
        badge: 'Core Universe',
        characters: [
          'Dardi',
          'Ladi',
          'Baca Bush',
          'La Zenun',
          'Ismeti',
          'Bajrushi',
          'Asllani',
          'Petriti',
          'Rrustemi',
          'Hajrullahi',
          'Aga Avdi',
          'Mixha Nagip',
          'Yllza',
          'Emira',
          'Rifati',
          'Ladmiri',
          'Avdushi',
        ],
      },
      {
        name: '3 Mangupat Saga',
        badge: 'Connected Timeline',
        characters: ['Naili', 'Fikreti', 'Nazimi', 'Selimi'],
      },
      {
        name: 'Detektivi Saga (Distinct Special Saga)',
        badge: 'Standalone Narrative',
        characters: ['Detektivi', 'Xhevadini', 'Selajdini', 'Dr. Mahmuti', 'Rrahmani'],
      },
    ],
    characters: [
      'Dardi',
      'Ladi',
      'Baca Bush',
      'La Zenun',
      'Ismeti',
      'Bajrushi',
      'Asllani',
      'Petriti',
      'Rrustemi',
      'Hajrullahi',
      'Aga Avdi',
      'Mixha Nagip',
      'Yllza',
      'Emira',
      'Rifati',
      'Ladmiri',
      'Avdushi',
      'Naili',
      'Fikreti',
      'Nazimi',
      'Selimi',
      'Detektivi',
      'Xhevadini',
      'Selajdini',
      'Dr. Mahmuti',
      'Rrahmani',
    ],
    pillars: [
      {
        title: '3 Mangupat Saga',
        tag: 'Universe Timeline',
        description:
          'This shared universe also includes 3 Mangupat, with its own stories and characters such as Naili, Fikreti, Nazimi, and Selimi. Their saga takes place within the same universe, adding another layer to the overall timeline.',
        characters: ['Naili', 'Fikreti', 'Nazimi', 'Selimi'],
      },
      {
        title: 'Detektivi Saga',
        tag: 'Distinct Special Saga',
        description:
          'There is also the Detektivi saga, a special saga within this same universe. Unlike the other sagas, Detektivi is not mixed directly with their storylines — it remains its own distinct saga, with its own narrative, events, and characters, while still existing within the same larger universe. Its central characters include Detektivi, Xhevadini, Selajdini, Dr. Mahmuti, and Rrahmani.',
        characters: ['Detektivi', 'Xhevadini', 'Selajdini', 'Dr. Mahmuti', 'Rrahmani'],
      },
    ],
    distinctSagaText:
      'There is also the Detektivi saga, a special saga within this same universe. Unlike the other sagas, Detektivi is not mixed directly with their storylines — it remains its own distinct saga, with its own narrative, events, and characters, while still existing within the same larger universe.',
    chronologyText:
      'By following this chronological order, you can see exactly what happens and when, while discovering how these different stories exist within the same world. Each saga has its own identity and storyline, but together they form a much larger universe.',
    climaxText:
      'The journey eventually leads to the point where the paths of the Dardi & Ladi and Baba Ramiz stories come together in one movie, inside the famous house named “Banesa” — a place that becomes an important connection within this shared universe.',
  },
  'scifi-saga': {
    title: 'THE END',
    subtitle: 'The Four-Film Saga of Double P',
    overview:
      'The End is a short saga centered around a charismatic character named Double P, who must become as close to flawless as possible in order to save a world on the brink of danger.',
    characters: ['Double P'],
    chronologyText:
      'The saga consists of The Part One, The Part Two, The Part Three, and The Finale (The Attack)—four films that follow his journey through an increasingly dangerous world, where every mistake could change everything.',
  },
  'deleted-scenes': {
    title: 'Deleted Scenes & Vault',
    subtitle: 'Exclusive Unseen Cuts & Vault Outtakes',
    overview:
      'The official Deleted Scenes collection gathers rare, unreleased cuts, hidden secrets, character backstories, and deleted moments across the cinematic universe.',
    chronologyText:
      'Explore each deleted scene in sequence to unveil secret lore, unreleased side stories, and alternate takes from your favorite films and series.',
  },
};

export const UNIVERSES_DATA: UniverseItem[] = [
  {
    id: 'dardi-ladi',
    name: 'Banesa',
    subtitle: 'Dardi & Ladi Saga',
    description: 'The complete chronological saga of Dardi & Ladi leading up to the legendary apartment crossover.',
    bgImage: 'https://i.postimg.cc/N0N574Xt/file-00000000bc2c81f4869e8118fdbca30e.png',
    accentColor: '#e2b14c',
  },
  {
    id: 'scifi-saga',
    name: 'THE END',
    subtitle: 'The Four-Film Saga of Double P',
    description: 'A short saga centered around the charismatic Double P, fighting to save a world on the brink of danger.',
    bgImage: 'https://i.postimg.cc/cJkFn4pB/file-0000000081d481f489daa25eee83bdd4.png',
    accentColor: '#3b82f6',
  },
  {
    id: 'deleted-scenes',
    name: 'Deleted Scenes',
    subtitle: 'Exclusive Vault Cuts',
    description: 'Rare deleted scenes, secret lore, unreleased outtakes, and character backstories from across the FARUKAT universe.',
    bgImage: 'https://i.postimg.cc/tJs0069q/file-00000000e32881f4a11bcd855d37478c.png',
    accentColor: '#2FBF71',
  },
];

interface UniversesSectionProps {
  onSelectUniverse: (universe: UniverseItem) => void;
}

export const UniversesSection: React.FC<UniversesSectionProps> = ({ onSelectUniverse }) => {
  const { t } = useTranslation();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setVersion((v) => v + 1);
    window.addEventListener('saga_completion_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('saga_completion_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const localizedUniverses = useMemo(() => {
    return UNIVERSES_DATA.map((u) => {
      const safeId = u.id.replace(/-/g, '_');
      return {
        ...u,
        name: t(`sagas.${safeId}_name`, undefined, u.name),
        subtitle: t(`sagas.${safeId}_subtitle`, undefined, u.subtitle),
        description: t(`sagas.${safeId}_description`, undefined, u.description),
      };
    });
  }, [t]);

  const sagaStatusMap = useMemo(() => {
    if (typeof window === 'undefined') return {};
    try {
      const rawProgress = localStorage.getItem('farukat_saga_progress_v1');
      const rawCompletions = localStorage.getItem('farukat_saga_completions_v1');
      const rawCompletedSagas = localStorage.getItem('farukat_saga_completed_sagas_v1');

      const progress = rawProgress ? JSON.parse(rawProgress) : {};
      const completions = rawCompletions ? JSON.parse(rawCompletions) : {};
      const completedSagas = rawCompletedSagas ? JSON.parse(rawCompletedSagas) : {};

      const statusMap: Record<string, 'completed' | 'in_progress' | 'none'> = {};

      localizedUniverses.forEach((u) => {
        if (completedSagas[u.id]) {
          statusMap[u.id] = 'completed';
        } else {
          const completedCount = completions[u.id]?.length || 0;
          const hasProg = Boolean(progress[u.id]?.mediaId);
          if (completedCount > 0 || hasProg) {
            statusMap[u.id] = 'in_progress';
          } else {
            statusMap[u.id] = 'none';
          }
        }
      });

      return statusMap;
    } catch {
      return {};
    }
  }, [localizedUniverses]);

  return (
    <div className="py-3 select-none">
      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between mb-2.5">
        <h2 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
          <span>{t('sagas.title', undefined, 'Sagas')}</span>
        </h2>
      </div>

      {/* 4-Tile Responsive Grid - Exactly 4 tiles, 1 row, no horizontal scrolling */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
          {localizedUniverses.map((u) => {
            const status = sagaStatusMap[u.id] || 'none';
            const sagaItems = getSagaItemsForUniverse(u.id, MEDIA_CATALOG);
            const totalDuration = calculateSagaTotalDuration(sagaItems);

            return (
              <button
                key={u.id}
                onClick={() => onSelectUniverse(u)}
                className="group relative w-full aspect-square rounded-[16px] overflow-hidden border border-white/15 hover:border-white/40 transition-all duration-200 cursor-pointer focus:outline-none touch-manipulation active:scale-95 shadow-lg bg-[var(--bg-surface)] block text-left"
                title={`Saga ${u.name} — ${totalDuration}`}
              >
                {/* Clean high quality image display */}
                <img
                  src={u.bgImage || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                  alt={u.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />

                {/* Status indicator badge */}
                {status === 'completed' ? (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-[var(--status-success)] text-black font-black text-[8px] sm:text-[9px] font-mono shadow-lg tracking-tight uppercase flex items-center gap-0.5 z-10">
                    <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                    <span className="hidden sm:inline">{t('sagas.completed', undefined, 'Completed')}</span>
                    <span className="sm:hidden">{t('common.done', undefined, 'Done')}</span>
                  </div>
                ) : status === 'in_progress' ? (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-[#e2b14c] text-black font-black text-[8px] sm:text-[9px] font-mono shadow-lg tracking-tight uppercase z-10">
                    {t('movies.resume', undefined, 'Resume')}
                  </div>
                ) : null}

                {/* Gentle gradient overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)] via-black/30 to-transparent flex flex-col justify-end p-2 sm:p-2.5">
                  <span className="text-[10px] sm:text-xs font-black text-white leading-tight uppercase tracking-tight text-left drop-shadow-md line-clamp-1">
                    {u.name}
                  </span>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-[#e2b14c] font-bold mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{totalDuration}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
