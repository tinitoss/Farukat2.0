import { MEDIA_CATALOG } from './src/data/mediaData.ts';
console.log('Total items:', MEDIA_CATALOG.length);
console.log('Featured Movies:', MEDIA_CATALOG.filter(m => m.featured && !m.isSeries).length);
console.log('Any Movies with Video:', MEDIA_CATALOG.filter(m => !m.isSeries && m.videoUrl).length);
