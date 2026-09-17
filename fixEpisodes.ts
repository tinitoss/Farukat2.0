import fs from 'fs';
import { MEDIA_CATALOG } from './src/data/mediaData';

const catalog = [...MEDIA_CATALOG];

// Fix Dardi & Ladi
const dardiLadi = catalog.find(m => m.id === 'dardi-ladi-1');
if (dardiLadi) {
  dardiLadi.episodes = Array.from({ length: 22 }).map((_, i) => ({
    id: `dardi-ladi-1-ep-${i + 1}`,
    episodeNumber: i + 1,
    title: `Episode ${i + 1}`,
    thumbnail: 'https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg',
    videoUrl: '', // blank or some placeholder
    rating: '9.9',
    duration: '20 min',
    description: `Dardi & Ladi Episode ${i + 1}`,
    channel: 'Banesa',
    views: '100K',
    timeAgo: '1 Year Ago',
    isNew: false
  }));
} else {
  catalog.unshift({
    id: 'dardi-ladi-1',
    title: 'Dardi & Ladi',
    originalSection: 'featured-series',
    category: 'series',
    sagaId: 'dardi-ladi',
    rating: '9.9',
    year: 'Season 1',
    duration: '22 Episodes',
    description: 'The epic comedy series that started it all.',
    tags: ['Comedy', 'Dardi & Ladi'],
    isSeries: true,
    thumbnail: 'https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg',
    poster: 'https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg',
    backdrop: 'https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg',
    videoUrl: '',
    featured: true,
    episodes: Array.from({ length: 22 }).map((_, i) => ({
      id: `dardi-ladi-1-ep-${i + 1}`,
      episodeNumber: i + 1,
      title: `Episode ${i + 1}`,
      thumbnail: 'https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg',
      videoUrl: '',
      rating: '9.9',
      duration: '20 min',
      description: `Dardi & Ladi Episode ${i + 1}`,
      channel: 'Banesa',
      views: '100K',
      timeAgo: '1 Year Ago',
      isNew: false
    }))
  } as any);
}

// Fix Mahalla Kuqe
const mahallaKuqe1 = catalog.find(m => m.id === 'mahalla-kuqe-1');
if (mahallaKuqe1) {
  mahallaKuqe1.episodes = Array.from({ length: 16 }).map((_, i) => ({
    id: `mahalla-kuqe-1-ep-${i + 1}`,
    episodeNumber: i + 1,
    title: `Episode ${i + 1}`,
    thumbnail: 'https://gorgeous-choux-7cd54a.netlify.app/images/mhl.jpg',
    videoUrl: '', 
    rating: '8.5',
    duration: '20 min',
    description: `Mahalla Kuqe Season 2 Episode ${i + 1}`,
    channel: 'Mahalla Kuqe',
    views: '50K',
    timeAgo: '1 Year Ago',
    isNew: false
  }));
} else {
  catalog.unshift({
    id: 'mahalla-kuqe-1',
    title: 'Mahalla Kuqe (Season 2)',
    originalSection: 'featured-series',
    category: 'series',
    rating: '8.5',
    year: 'Season 2',
    duration: '16 Episodes',
    description: 'Mahalla Kuqe Season 2 continues the hilarious adventures.',
    tags: ['Comedy'],
    isSeries: true,
    thumbnail: 'https://gorgeous-choux-7cd54a.netlify.app/images/mhl.jpg',
    poster: 'https://gorgeous-choux-7cd54a.netlify.app/images/mhl.jpg',
    backdrop: 'https://gorgeous-choux-7cd54a.netlify.app/images/mhl.jpg',
    videoUrl: '',
    featured: true,
    episodes: Array.from({ length: 16 }).map((_, i) => ({
      id: `mahalla-kuqe-1-ep-${i + 1}`,
      episodeNumber: i + 1,
      title: `Episode ${i + 1}`,
      thumbnail: 'https://gorgeous-choux-7cd54a.netlify.app/images/mhl.jpg',
      videoUrl: '',
      rating: '8.5',
      duration: '20 min',
      description: `Mahalla Kuqe Season 2 Episode ${i + 1}`,
      channel: 'Mahalla Kuqe',
      views: '50K',
      timeAgo: '1 Year Ago',
      isNew: false
    }))
  } as any);
}

const fileContent = `import { MediaItem, MediaCategory } from '../types';\n\nexport const MEDIA_CATALOG: MediaItem[] = ${JSON.stringify(catalog, null, 2)};\n`;

fs.writeFileSync('./src/data/mediaData.ts', fileContent, 'utf-8');
console.log('Fixed episodes!');
