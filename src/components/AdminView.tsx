import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  Film,
  Tv,
  Star,
  Search,
  X,
  Check,
  Edit3,
  LogOut,
  Image as ImageIcon,
  Sliders,
  Layers,
  Layout,
  ArrowRight,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  PlaySquare,
  ListPlus,
  Loader2,
} from 'lucide-react';
import { MediaItem, MediaCategory } from '../types';
import { getYouTubeThumbnail16x9 } from '../utils/youtubeUtils';
import { MEDIA_CATALOG } from '../data/mediaData';
import {
  isAdminSession,
  setAdminSession,
  verifyAdminCredentials,
  getManagedCatalog,
  adminPublishVideo,
  adminDeleteVideo,
  adminToggleHideVideo,
  adminToggleNewBadge,
  adminResetCatalog,
  adminUpdateVideoCategory,
  getHeroSettings,
  saveHeroSettings,
  adminUpdateHeroCategory,
  HeroCategoryConfig,
  getCustomVideos,
  getHiddenVideoIds,
  isAdminEmail,
  getCustomSections,
  saveCustomSections,
  adminAddSection,
  adminUpdateSection,
  adminDeleteSection,
  adminMoveSectionRank,
  SectionConfig,
} from '../utils/mediaCatalogStore';

interface AdminViewProps {
  currentUserEmail?: string | null;
  onSelectMedia?: (item: MediaItem) => void;
  onPreviewConsumer?: () => void;
  onClose?: () => void;
}

const SECTION_OPTIONS: { id: MediaCategory; label: string }[] = [
  { id: 'series', label: 'Series' },
  { id: 'movie', label: 'Movies' },
  { id: 'horror', label: 'Horror Collection' },
  { id: 'scifi', label: 'Sci-Fi Universe' },
  { id: 'behind', label: 'Behind The Scenes' },
  { id: 'deleted', label: 'Deleted Scenes' },
  { id: 'skits', label: 'Funny Skits' },
  { id: 'specials', label: 'Special Features' },
  { id: 'music', label: 'Soundtracks & Audio' },
];

export const AdminView: React.FC<AdminViewProps> = ({
  currentUserEmail,
  onSelectMedia,
  onPreviewConsumer,
  onClose,
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminEmail(currentUserEmail));

  useEffect(() => {
    setIsAdmin(isAdminEmail(currentUserEmail));
  }, [currentUserEmail]);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Admin Sub-Tab
  const [activeAdminTab, setActiveAdminTab] = useState<'catalog' | 'hero' | 'sections'>('catalog');

  // Catalog state
  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'hidden' | 'new' | 'custom'>('all');

  // Hero Banners State
  const [heroBanners, setHeroBanners] = useState<HeroCategoryConfig[]>(() => getHeroSettings());
  const [editingHero, setEditingHero] = useState<HeroCategoryConfig | null>(null);

  // Modal State for Adding/Editing Video
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MediaCategory>('series');
  const [isSeries, setIsSeries] = useState(true);
  const [videoUrl, setVideoUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('1h 30m');
  const [year, setYear] = useState('2026');
  const [rating, setRating] = useState('9.5');
  const [quality, setQuality] = useState('4K Ultra HD');
  const [tagsStr, setTagsStr] = useState('Action, Drama');
  const [isNewBadge, setIsNewBadge] = useState(true);
  const [selectedSagaId, setSelectedSagaId] = useState<string>('');

  // Status Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Custom Sections State
  const [sectionsList, setSectionsList] = useState<SectionConfig[]>(() => getCustomSections());
  const [showSectionModal, setShowSectionModal] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<SectionConfig | null>(null);
  const [secLabel, setSecLabel] = useState('');
  const [secSubtitle, setSecSubtitle] = useState('');
  const [secBadge, setSecBadge] = useState('');
  const [secVariant, setSecVariant] = useState<'portrait' | 'landscape'>('portrait');

  // YouTube Playlist Import State
  const [showYtModal, setShowYtModal] = useState<boolean>(false);
  const [ytPlaylistInput, setYtPlaylistInput] = useState<string>('');
  const [ytTargetCategory, setYtTargetCategory] = useState<string>('movie');
  const [ytIsSeriesFormat, setYtIsSeriesFormat] = useState<boolean>(true);
  const [ytFetching, setYtFetching] = useState<boolean>(false);
  const [ytFetchError, setYtFetchError] = useState<string | null>(null);
  const [ytFetchedResult, setYtFetchedResult] = useState<{ playlistTitle: string; items: any[] } | null>(null);
  const [ytSelectedIds, setYtSelectedIds] = useState<string[]>([]);
  const [ytPublishing, setYtPublishing] = useState<boolean>(false);

  const refreshCatalog = () => {
    // Pass true to get hidden videos for admin
    const managed = getManagedCatalog(MEDIA_CATALOG, true);
    setCatalog(managed);
    setHeroBanners(getHeroSettings());
    setSectionsList(getCustomSections());
  };

  useEffect(() => {
    refreshCatalog();

    const handleUpdate = () => refreshCatalog();
    window.addEventListener('farukat_catalog_updated', handleUpdate);
    return () => window.removeEventListener('farukat_catalog_updated', handleUpdate);
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (isAdminEmail(currentUserEmail)) {
      setAdminSession(true);
      setIsAdmin(true);
      showToast('Admin access granted');
    } else {
      setAuthError('Access restricted. Only altinberisha434@gmail.com can log in as Admin.');
    }
  };

  const handleLogout = () => {
    setAdminSession(false);
    setIsAdmin(false);
    showToast('Admin logged out');
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setTitle('');
    setCategory('series');
    setIsSeries(true);
    setVideoUrl('');
    setPosterUrl('');
    setBackdropUrl('');
    setThumbnailUrl('');
    setDescription('');
    setDuration('1h 30m');
    setYear('2026');
    setRating('9.5');
    setQuality('4K Ultra HD');
    setTagsStr('Action, Drama');
    setIsNewBadge(true);
    setSelectedSagaId('');
    setShowFormModal(true);
  };

    const openEditModal = (item: MediaItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setCategory(item.category);
    setIsSeries(item.isSeries);
    setVideoUrl(item.videoUrl || '');
    setPosterUrl(item.posterImageUrl || item.poster || '');
    setBackdropUrl(item.backdropImageUrl || item.backdrop || item.poster || '');
    setThumbnailUrl(item.thumbnail || '');
    setDescription(item.description || '');
    setDuration(item.duration || '1h 30m');
    setYear(item.year || '2026');
    setRating(item.rating || '9.5');
    setQuality(item.quality || '4K Ultra HD');
    setTagsStr(item.tags ? item.tags.join(', ') : 'Action, Drama');
    setIsNewBadge(!!item.isNew);
    setSelectedSagaId(item.sagaId || '');
    setShowFormModal(true);
  };

  const handleSaveVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a video title');
      return;
    }

    const id = editingItem ? editingItem.id : `admin-video-${Date.now()}`;
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);

    const fallbackPoster = posterUrl.trim() || thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80';
    const fallbackBackdrop = backdropUrl.trim() || fallbackPoster;
    const fallbackThumb = thumbnailUrl.trim() || posterUrl.trim() || fallbackPoster;

    const newItem: MediaItem = {
      id,
      title: title.trim(),
      originalSection: category,
      category,
      rating: rating || '9.5',
      year: year || '2026',
      duration: duration || '1h 30m',
      description: description.trim() || 'Farukat Cinema Original Release.',
      tags: tags.length > 0 ? tags : ['Cinema', 'Original'],
      isSeries,
      thumbnail: fallbackThumb,
      poster: fallbackPoster,
      backdrop: fallbackBackdrop,
      posterImageUrl: posterUrl.trim() || fallbackPoster,
      backdropImageUrl: backdropUrl.trim() || fallbackBackdrop,
      videoUrl: videoUrl.trim() || 'https://www.youtube.com/watch?v=TatxQIZIfrc',
      quality: quality || '4K Ultra HD',
      featured: true,
      isNew: isNewBadge,
      sagaId: selectedSagaId ? selectedSagaId : undefined,
    };

    adminPublishVideo(newItem);
    setShowFormModal(false);
    showToast(editingItem ? 'Video updated successfully' : 'New video published to collection!');
  };

  const handleSectionShift = (id: string, newCategory: MediaCategory) => {
    adminUpdateVideoCategory(id, newCategory);
    showToast(`Video moved to "${newCategory}" section!`);
  };

  const handleDelete = (id: string, itemTitle: string) => {
    if (confirm(`Are you sure you want to delete "${itemTitle}"?`)) {
      adminDeleteVideo(id);
      showToast(`Deleted "${itemTitle}"`);
    }
  };

  const handleToggleHide = (id: string) => {
    const isNowHidden = adminToggleHideVideo(id);
    showToast(isNowHidden ? 'Video hidden from public view' : 'Video published to public view');
  };

  const handleToggleNew = (id: string) => {
    const isNowNew = adminToggleNewBadge(id);
    showToast(isNowNew ? 'Marked video as NEW' : 'Removed NEW badge');
  };

  const handleResetCatalog = () => {
    if (confirm('Reset custom video overrides back to initial defaults?')) {
      adminResetCatalog();
      showToast('Catalog restored to default state');
    }
  };

  const handleSaveHeroCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHero) return;
    adminUpdateHeroCategory(editingHero.id, {
      label: editingHero.label,
      image: editingHero.image,
      tagline: editingHero.tagline,
    });
    setEditingHero(null);
    showToast(`Updated Hero Banner: ${editingHero.label}`);
  };

  // Section CRUD & Ranking Handlers
  const handleOpenAddSection = () => {
    setEditingSection(null);
    setSecLabel('');
    setSecSubtitle('');
    setSecBadge('');
    setSecVariant('portrait');
    setShowSectionModal(true);
  };

  const handleOpenEditSection = (sec: SectionConfig) => {
    setEditingSection(sec);
    setSecLabel(sec.label);
    setSecSubtitle(sec.subtitle || '');
    setSecBadge(sec.badge || '');
    setSecVariant(sec.variant || 'portrait');
    setShowSectionModal(true);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secLabel.trim()) {
      alert('Please enter a section title');
      return;
    }

    if (editingSection) {
      adminUpdateSection(editingSection.id, {
        label: secLabel.trim(),
        subtitle: secSubtitle.trim(),
        badge: secBadge.trim() || secLabel.trim(),
        variant: secVariant,
      });
      showToast(`Updated section "${secLabel.trim()}"`);
    } else {
      adminAddSection(secLabel.trim(), secSubtitle.trim(), secBadge.trim(), secVariant);
      showToast(`Created section "${secLabel.trim()}"!`);
    }

    setSectionsList(getCustomSections());
    setShowSectionModal(false);
  };

  const handleMoveSectionRank = (id: string, direction: 'up' | 'down') => {
    adminMoveSectionRank(id, direction);
    setSectionsList(getCustomSections());
    showToast('Section rank order updated');
  };

  const handleDeleteSection = (id: string, label: string) => {
    if (confirm(`Are you sure you want to delete section "${label}"?`)) {
      adminDeleteSection(id);
      setSectionsList(getCustomSections());
      showToast(`Deleted section "${label}"`);
    }
  };

  // YouTube Playlist Handlers
  const handleFetchYtPlaylist = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ytPlaylistInput.trim()) return;
    setYtFetching(true);
    setYtFetchError(null);
    setYtFetchedResult(null);

    try {
      const res = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(ytPlaylistInput.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch YouTube playlist.');
      }

      setYtFetchedResult({
        playlistTitle: data.playlistTitle || 'YouTube Playlist',
        items: data.items || [],
      });
      setYtSelectedIds((data.items || []).map((i: any) => i.id));
    } catch (err: any) {
      setYtFetchError(err.message || 'Error parsing YouTube playlist.');
    } finally {
      setYtFetching(false);
    }
  };

  const handlePublishYtSelected = () => {
    if (!ytFetchedResult || ytSelectedIds.length === 0) return;
    setYtPublishing(true);

    const selectedItems = ytFetchedResult.items.filter((i) => ytSelectedIds.includes(i.id));
    let publishedCount = 0;

    if (ytIsSeriesFormat && selectedItems.length > 1) {
      const seriesId = `admin-series-yt-${Date.now()}`;
      const mainThumb = selectedItems[0]?.thumbnail || '';
      const mainTitle = ytFetchedResult.playlistTitle || selectedItems[0]?.title || 'YouTube Series';

      const episodes = selectedItems.map((item, idx) => ({
        id: item.id,
        episodeNumber: idx + 1,
        seasonNumber: 1,
        title: item.title,
        thumbnail: item.thumbnail,
        videoUrl: item.videoUrl,
        rating: '9.5',
        duration: '10m',
        description: item.description,
        isNew: true,
      }));

      const seriesItem: MediaItem = {
        id: seriesId,
        title: mainTitle,
        originalSection: ytTargetCategory,
        category: ytTargetCategory as MediaCategory,
        rating: '9.5',
        year: '2026',
        duration: `${selectedItems.length} Episodes`,
        description: `YouTube Playlist Series containing ${selectedItems.length} episodes.`,
        tags: ['YouTube', 'Series', 'Playlist'],
        isSeries: true,
        thumbnail: mainThumb,
        poster: mainThumb,
        backdrop: mainThumb,
        videoUrl: selectedItems[0]?.videoUrl || '',
        episodes,
        quality: '4K Ultra HD',
        featured: true,
        isNew: true,
      };

      adminPublishVideo(seriesItem);
      publishedCount = selectedItems.length;
    } else {
      selectedItems.forEach((item) => {
        const mediaItem: MediaItem = {
          id: `admin-video-yt-${item.videoId}`,
          title: item.title,
          originalSection: ytTargetCategory,
          category: ytTargetCategory as MediaCategory,
          rating: '9.5',
          year: item.year || '2026',
          duration: '10m',
          description: item.description,
          tags: ['YouTube', 'Playlist'],
          isSeries: false,
          thumbnail: item.thumbnail,
          poster: item.poster,
          backdrop: item.backdrop,
          videoUrl: item.videoUrl,
          quality: '4K Ultra HD',
          featured: true,
          isNew: true,
        };
        adminPublishVideo(mediaItem);
        publishedCount++;
      });
    }

    setYtPublishing(false);
    setShowYtModal(false);
    setYtFetchedResult(null);
    setYtPlaylistInput('');
    showToast(`Published ${publishedCount} video(s) to section!`);
    refreshCatalog();
  };

  // Filter catalog items
  const filteredCatalog = catalog.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = filterCategory === 'all' || item.category === filterCategory;

    let matchesStatus = true;
    if (statusFilter === 'hidden') matchesStatus = !!item.isHidden;
    if (statusFilter === 'new') matchesStatus = !!item.isNew;
    if (statusFilter === 'custom') matchesStatus = item.id.startsWith('admin-video-');

    return matchesSearch && matchesCat && matchesStatus;
  });

  const customCount = getCustomVideos().length;
  const hiddenCount = getHiddenVideoIds().length;
  const seriesCount = catalog.filter((i) => i.isSeries).length;
  const movieCount = catalog.filter((i) => !i.isSeries).length;

  // Render Login Screen if not Admin
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-[#0e0e0e] border border-[var(--border-subtle)] rounded-3xl shadow-2xl text-[var(--text-primary)]">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30 flex items-center justify-center mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white">Admin Authentication</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Access Farukat Control Portal to publish, edit, or manage catalog titles.
          </p>
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Admin Master Key
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter key (e.g. admin)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#e2b14c]"
              />
            </div>
            {authError && <p className="text-xs text-red-400 mt-1.5">{authError}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[var(--accent-gold)] hover:brightness-110 text-black font-black text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Unlock Admin Panel</span>
          </button>
        </form>

        <div className="mt-6 p-3 rounded-xl bg-[#141414] border border-[#222] text-[11px] text-[var(--text-muted)] flex items-center gap-2">
          <Database className="w-4 h-4 text-[#e2b14c] shrink-0" />
          <span>Turso DB Database Syncing Enabled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 select-none animate-fadeIn text-[var(--text-primary)] overflow-x-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 bg-[#e2b14c] text-black px-4 py-2.5 rounded-2xl font-black text-xs shadow-2xl flex items-center gap-2 border border-black/20 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30">
              ADMIN CONTROL HUB
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              TURSO DB SYNCED
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-[#e2b14c]" />
            Master Content Operations
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={openCreateModal}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-[var(--accent-gold)] hover:brightness-110 text-black font-black text-xs transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Publish Video</span>
          </button>

          <button
            onClick={() => setShowYtModal(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <PlaySquare className="w-4 h-4" />
            <span>Publish YouTube Playlist</span>
          </button>

          {onPreviewConsumer && (
            <button
              onClick={onPreviewConsumer}
              className="px-3 py-2 rounded-xl bg-[#161616] hover:bg-[#222] text-[var(--text-secondary)] border border-[#2a2a2a] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
              title="Preview Consumer Player UI"
            >
              <Eye className="w-3.5 h-3.5 text-[#e2b14c]" />
              <span>Player</span>
            </button>
          )}

          <button
            onClick={handleResetCatalog}
            className="px-3 py-2 rounded-xl bg-[#161616] hover:bg-[#222] text-[var(--text-secondary)] border border-[#2a2a2a] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
            title="Reset Catalog to Defaults"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Admin</span>
          </button>
        </div>
      </div>

      {/* Admin Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#0d0d0d] border border-[var(--border-subtle)] mb-6 overflow-x-auto max-w-full scrollbar-none">
        <button
          onClick={() => setActiveAdminTab('catalog')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 min-h-[44px] ${
            activeAdminTab === 'catalog'
              ? 'bg-[#e2b14c] text-black shadow-lg'
              : 'text-[var(--text-muted)] hover:text-white bg-[#141414]'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Videos & Titles ({catalog.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('sections')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 min-h-[44px] ${
            activeAdminTab === 'sections'
              ? 'bg-[#e2b14c] text-black shadow-lg'
              : 'text-[var(--text-muted)] hover:text-white bg-[#141414]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Section Manager & Ranking ({sectionsList.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('hero')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 min-h-[44px] ${
            activeAdminTab === 'hero'
              ? 'bg-[#e2b14c] text-black shadow-lg'
              : 'text-[var(--text-muted)] hover:text-white bg-[#141414]'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Hero Banners</span>
        </button>
      </div>

      {/* SUB-TAB 1: VIDEOS & CATALOG MANAGER */}
      {activeAdminTab === 'catalog' && (
        <div className="w-full max-w-full">
          {/* Stats Quick Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)]">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Total Titles</span>
              <p className="text-xl font-black text-white mt-0.5">{catalog.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)]">
              <span className="text-[10px] font-mono text-red-400 uppercase">Series</span>
              <p className="text-xl font-black text-red-400 mt-0.5">{seriesCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)]">
              <span className="text-[10px] font-mono text-blue-400 uppercase">Movies</span>
              <p className="text-xl font-black text-blue-400 mt-0.5">{movieCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)]">
              <span className="text-[10px] font-mono text-emerald-400 uppercase">Custom Uploads</span>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{customCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
              <span className="text-[10px] font-mono text-amber-400 uppercase">Hidden Titles</span>
              <p className="text-xl font-black text-amber-400 mt-0.5">{hiddenCount}</p>
            </div>
          </div>

          {/* Controls Bar: Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d0d0d] p-3 rounded-2xl border border-[var(--border-subtle)] mb-6 max-w-full overflow-hidden">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog titles..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-[var(--text-primary)] placeholder-[#666] focus:outline-none focus:border-[#e2b14c]"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full sm:w-auto pb-1 sm:pb-0">
              <div className="flex items-center gap-1 shrink-0">
                {(['all', 'series', 'movie', 'horror', 'scifi', 'skits', 'behind', 'deleted', 'music'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer capitalize transition min-h-[36px] ${
                      filterCategory === cat
                        ? 'bg-[#e2b14c]/20 text-[#e2b14c] border border-[#e2b14c]/40'
                        : 'bg-[#161616] text-[var(--text-secondary)] hover:text-white border border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 pl-2 border-l border-[var(--border-subtle)] shrink-0">
                {(['all', 'hidden', 'new', 'custom'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer uppercase font-mono transition min-h-[36px] ${
                      statusFilter === st
                        ? 'bg-white text-black font-black'
                        : 'bg-[#161616] text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Video Catalog List */}
          <div className="space-y-3 w-full max-w-full">
            {filteredCatalog.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl bg-[#0e0e0e] border transition flex flex-col gap-3 w-full max-w-full overflow-hidden ${
                  item.isHidden
                    ? 'border-amber-500/30 bg-amber-950/10 opacity-75'
                    : 'border-[var(--border-subtle)] hover:border-[#e2b14c]/40'
                }`}
              >
                {/* Top Row: Thumbnail + Video Details */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 w-full">
                  <div className="relative w-20 sm:w-24 aspect-video rounded-xl overflow-hidden bg-[var(--bg-main)] shrink-0 border border-[var(--border-subtle)]">
                    <img
                      src={item.thumbnail || item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {item.isNew && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-black uppercase">
                        NEW
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[140px] sm:max-w-none">{item.title}</h4>
                      <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1f1f1f] text-[#e2b14c] border border-[#e2b14c]/30 uppercase font-black shrink-0">
                        {item.category}
                      </span>
                      {/* Deduplicated: only show Series/Movie pill if category is NOT already series or movie */}
                      {item.category !== 'series' && item.category !== 'movie' && (
                        item.isSeries ? (
                          <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1f1f1f] text-red-400 border border-red-500/20 shrink-0">
                            Series
                          </span>
                        ) : (
                          <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1f1f1f] text-blue-400 border border-blue-500/20 shrink-0">
                            Movie
                          </span>
                        )
                      )}
                      {item.isHidden && (
                        <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold shrink-0">
                          HIDDEN
                        </span>
                      )}
                      {item.id.startsWith('admin-video-') && (
                        <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          CUSTOM
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">{item.description}</p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-secondary)] mt-1 flex-wrap">
                      <span>{item.year}</span>
                      <span>•</span>
                      <span>{item.duration}</span>
                      <span>•</span>
                      <span>Rating {item.rating}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Section Shift + Action Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full pt-2.5 border-t border-[#1a1a1a]">
                  {/* Quick Section Shift Selector */}
                  <div className="flex items-center gap-1.5 bg-[#141414] border border-[#2a2a2a] rounded-xl px-2.5 py-1.5 w-full sm:w-auto min-w-0">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#e2b14c] shrink-0" />
                    <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase shrink-0">Section:</span>
                    <select
                      value={item.category}
                      onChange={(e) => handleSectionShift(item.id, e.target.value as MediaCategory)}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer w-full min-w-0 truncate py-0.5"
                      title="Shift video section"
                    >
                      {sectionsList.map((sec) => (
                        <option key={sec.id} value={sec.id} className="bg-[#141414] text-white">
                          {sec.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Controls Row */}
                  <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto shrink-0">
                    {/* Toggle Hide */}
                    <button
                      onClick={() => handleToggleHide(item.id)}
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border min-h-[38px] ${
                        item.isHidden
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-[#161616] text-[var(--text-secondary)] hover:text-white border-[#2a2a2a]'
                      }`}
                      title={item.isHidden ? 'Unhide Video' : 'Hide Video'}
                    >
                      {item.isHidden ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                      <span className="text-[11px]">{item.isHidden ? 'Hidden' : 'Hide'}</span>
                    </button>

                    {/* Toggle NEW Badge */}
                    <button
                      onClick={() => handleToggleNew(item.id)}
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border min-h-[38px] ${
                        item.isNew
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#161616] text-[var(--text-secondary)] hover:text-white border-[#2a2a2a]'
                      }`}
                      title="Toggle NEW Badge"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${item.isNew ? 'text-emerald-400' : ''}`} />
                      <span className="text-[11px]">{item.isNew ? 'NEW' : 'New'}</span>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-xl bg-[#161616] hover:bg-[#222] text-[var(--text-secondary)] hover:text-white border border-[#2a2a2a] transition cursor-pointer min-h-[38px] flex items-center justify-center gap-1"
                      title="Edit Video Details & Images"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#e2b14c]" />
                      <span className="text-[11px]">Edit</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#161616] hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 border border-[#2a2a2a] transition cursor-pointer min-h-[38px] flex items-center justify-center"
                      title="Delete Video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: SECTION MANAGER & RANKING */}
      {activeAdminTab === 'sections' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2 mb-1">
                <Sliders className="w-5 h-5 text-[#e2b14c]" />
                <span>Custom Sections & Rank Hierarchy</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Create new custom sections, edit labels, badges, and reorder how sections appear on the homepage.
              </p>
            </div>

            <button
              onClick={handleOpenAddSection}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent-gold)] hover:brightness-110 text-black font-black text-xs transition shadow-lg flex items-center gap-2 cursor-pointer shrink-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create New Section</span>
            </button>
          </div>

          <div className="space-y-3">
            {sectionsList.map((sec, idx) => {
              const count = catalog.filter(m => m.category === sec.id || m.originalSection === sec.id || (sec.id === 'series' && m.isSeries)).length;

              return (
                <div
                  key={sec.id}
                  className="p-4 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-[#333]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#161616] border border-[#2a2a2a] text-[#e2b14c] font-mono font-black text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h4 className="text-base font-black text-white truncate">{sec.label}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#181818] border border-[#333] text-[var(--text-muted)] uppercase">
                          {sec.variant === 'landscape' ? 'Banner Layout' : 'Poster Layout'}
                        </span>
                        {sec.badge && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30">
                            Badge: {sec.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1">{sec.subtitle || 'No subtitle provided'}</p>
                      <span className="text-[11px] font-mono text-[#e2b14c]">{count} Title(s) Assigned</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {/* Move Up */}
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveSectionRank(sec.id, 'up')}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border transition cursor-pointer min-h-[40px] min-w-[40px] ${
                        idx === 0
                          ? 'bg-[#141414] border-[#222] text-[#444] cursor-not-allowed'
                          : 'bg-[#181818] border-[#2a2a2a] text-white hover:bg-[#222] hover:border-[#e2b14c]'
                      }`}
                      title="Move Section Up in Rank"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      disabled={idx === sectionsList.length - 1}
                      onClick={() => handleMoveSectionRank(sec.id, 'down')}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border transition cursor-pointer min-h-[40px] min-w-[40px] ${
                        idx === sectionsList.length - 1
                          ? 'bg-[#141414] border-[#222] text-[#444] cursor-not-allowed'
                          : 'bg-[#181818] border-[#2a2a2a] text-white hover:bg-[#222] hover:border-[#e2b14c]'
                      }`}
                      title="Move Section Down in Rank"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    {/* Edit Section */}
                    <button
                      onClick={() => handleOpenEditSection(sec)}
                      className="px-3 py-2 rounded-xl bg-[#181818] hover:bg-[#222] text-white text-xs font-bold border border-[#2a2a2a] transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#e2b14c]" />
                      <span>Edit</span>
                    </button>

                    {/* Delete Section */}
                    <button
                      onClick={() => handleDeleteSection(sec.id, sec.label)}
                      className="w-10 h-10 rounded-xl bg-[#181818] hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 border border-[#2a2a2a] transition flex items-center justify-center cursor-pointer min-h-[40px] min-w-[40px]"
                      title="Delete Section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {activeAdminTab === 'hero' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)]">
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-2">
              <ImageIcon className="w-5 h-5 text-[#e2b14c]" />
              <span>Hero Slide Images & Taglines</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Manage the 5 rotating backdrop banners featured at the top of the main player view. Changes sync instantly across all devices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {heroBanners.map((hero) => (
              <div key={hero.id} className="p-4 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-[#e2b14c]">
                    Section: {hero.label}
                  </span>
                  <button
                    onClick={() => setEditingHero(hero)}
                    className="px-3 py-1 rounded-lg bg-[#181818] hover:bg-[#222] text-white text-xs font-bold border border-[#333] transition flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#e2b14c]" />
                    <span>Edit Banner Image</span>
                  </button>
                </div>

                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#222]">
                  <img
                    src={hero.image || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1200'}
                    alt={hero.label}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/60 to-transparent">
                    <p className="text-sm font-black text-white">{hero.label}</p>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1">{hero.tagline}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SECTION OVERVIEW */}
      {activeAdminTab === 'sections' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)]">
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-[#e2b14c]" />
              <span>Catalog Section Distribution</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Overview of all active sections in Farukat Cinema and item count per category.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTION_OPTIONS.map((sec) => {
              const count = catalog.filter((i) => i.category === sec.id).length;
              return (
                <div key={sec.id} className="p-4 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{sec.label}</h4>
                    <span className="text-xs font-mono text-[var(--text-muted)] uppercase">ID: {sec.id}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-[#161616] border border-[#2b2b2b] text-sm font-black text-[#e2b14c]">
                    {count} Titles
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hero Category Edit Modal */}
      {editingHero && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0e0e0e] border border-[var(--border-subtle)] rounded-3xl p-6 shadow-2xl text-[var(--text-primary)] relative my-8">
            <button
              onClick={() => setEditingHero(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-[#181818] text-[var(--text-muted)] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-[#e2b14c]" />
              <span>Edit Hero Slide: {editingHero.label}</span>
            </h3>

            <form onSubmit={handleSaveHeroCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Section Display Label
                </label>
                <input
                  type="text"
                  value={editingHero.label}
                  onChange={(e) => setEditingHero({ ...editingHero, label: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#e2b14c]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Banner Image URL
                </label>
                <input
                  type="text"
                  value={editingHero.image}
                  onChange={(e) => setEditingHero({ ...editingHero, image: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  required
                />
              </div>

              {editingHero.image && editingHero.image.trim() && (
                <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#222]">
                  <img
                    src={editingHero.image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Hero Tagline / Subtitle
                </label>
                <textarea
                  value={editingHero.tagline}
                  onChange={(e) => setEditingHero({ ...editingHero, tagline: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setEditingHero(null)}
                  className="px-4 py-2 rounded-xl bg-[#161616] text-[var(--text-secondary)] text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--accent-gold)] hover:brightness-110 text-black font-black text-xs transition shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Banner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish / Edit Video Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#0e0e0e] border border-[var(--border-subtle)] rounded-3xl p-6 shadow-2xl text-[var(--text-primary)] relative my-8">
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-[#181818] text-[var(--text-muted)] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-[#e2b14c]" />
              <span>{editingItem ? 'Edit Video Details & Images' : 'Publish New Video'}</span>
            </h3>

            <form onSubmit={handleSaveVideo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Offline Season 2"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#e2b14c]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Assign Section / Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MediaCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  >
                    {sectionsList.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Saga Assignment (Optional)
                  </label>
                  <select
                    value={selectedSagaId}
                    onChange={(e) => setSelectedSagaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  >
                    <option value="">None (General Home / Rows)</option>
                    <option value="dardi-ladi">BANESA (Dardi & Ladi Universe)</option>
                    <option value="scifi-saga">THE END (Double P Sci-Fi Saga)</option>
                    <option value="deleted-scenes">Deleted Scenes (Exclusive Unseen Cuts & Vault)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Type Options
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSeries}
                      onChange={(e) => setIsSeries(e.target.checked)}
                      className="rounded border-[#333] accent-[#e2b14c]"
                    />
                    <span>Is Series?</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-emerald-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isNewBadge}
                      onChange={(e) => setIsNewBadge(e.target.checked)}
                      className="rounded border-[#333] accent-emerald-500"
                    />
                    <span>Mark as NEW</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Video URL (YouTube or MP4 stream)
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => {
                    const newUrl = e.target.value;
                    setVideoUrl(newUrl);
                    if (newUrl && (!posterUrl || !backdropUrl)) {
                      const yt16x9 = getYouTubeThumbnail16x9(newUrl);
                      if (yt16x9 && yt16x9.includes('youtube.com')) {
                        if (!posterUrl) setPosterUrl(yt16x9);
                        if (!backdropUrl) setBackdropUrl(yt16x9);
                      }
                    }
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Poster Image (9:16 Portrait)
                  </label>
                  <input
                    type="text"
                    value={posterUrl}
                    onChange={(e) => setPosterUrl(e.target.value)}
                    placeholder="https://... (9:16 portrait)"
                    className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Backdrop Image (16:9 Wide)
                  </label>
                  <input
                    type="text"
                    value={backdropUrl}
                    onChange={(e) => setBackdropUrl(e.target.value)}
                    placeholder="https://... (16:9 banner)"
                    className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  />
                </div>
              </div>

              {((posterUrl && posterUrl.trim()) || (backdropUrl && backdropUrl.trim())) && (
                <div className="grid grid-cols-2 gap-3">
                  {posterUrl && posterUrl.trim() && (
                    <div className="relative aspect-[9/16] max-h-36 rounded-xl overflow-hidden border border-[#2a2a2a] bg-black mx-auto">
                      <img src={posterUrl} alt="Poster preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/80 text-[9px] font-mono text-white rounded">9:16 Poster</span>
                    </div>
                  )}
                  {backdropUrl && backdropUrl.trim() && (
                    <div className="relative aspect-video max-h-36 rounded-xl overflow-hidden border border-[#2a2a2a] bg-black">
                      <img src={backdropUrl} alt="Backdrop preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/80 text-[9px] font-mono text-white rounded">16:9 Hero</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="1h 45m"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2026"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Rating
                  </label>
                  <input
                    type="text"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    placeholder="9.8"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Enter synopsis or description..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="Action, Drama, Thriller"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#161616] text-[var(--text-secondary)] hover:text-white text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--accent-gold)] hover:brightness-110 text-black font-black text-xs transition shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingItem ? 'Save Changes' : 'Publish Title'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SECTION MODAL */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setShowSectionModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-[#161616] text-[var(--text-muted)] hover:text-white cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#e2b14c]" />
              <span>{editingSection ? 'Edit Section Details' : 'Create Custom Section'}</span>
            </h3>

            <form onSubmit={handleSaveSection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Section Title / Label *
                </label>
                <input
                  type="text"
                  value={secLabel}
                  onChange={(e) => setSecLabel(e.target.value)}
                  placeholder="e.g. Kosovar Classics, Blockbuster Movies"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#e2b14c]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Subtitle Description
                </label>
                <input
                  type="text"
                  value={secSubtitle}
                  onChange={(e) => setSecSubtitle(e.target.value)}
                  placeholder="e.g. Exclusive archives, remastered classics, and sagas"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Badge Text
                  </label>
                  <input
                    type="text"
                    value={secBadge}
                    onChange={(e) => setSecBadge(e.target.value)}
                    placeholder="e.g. Classics"
                    className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Card Style Layout
                  </label>
                  <select
                    value={secVariant}
                    onChange={(e) => setSecVariant(e.target.value as 'portrait' | 'landscape')}
                    className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#e2b14c] cursor-pointer"
                  >
                    <option value="portrait">Vertical Poster Card</option>
                    <option value="landscape">Horizontal Banner Card</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#161616] text-[var(--text-secondary)] hover:text-white text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--accent-gold)] hover:brightness-110 text-black font-black text-xs transition shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingSection ? 'Save Changes' : 'Create Section'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* YOUTUBE PLAYLIST IMPORT MODAL */}
      {showYtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0e0e0e] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowYtModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-[#161616] text-[var(--text-muted)] hover:text-white cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-500 border border-red-600/30 flex items-center justify-center shrink-0">
                <PlaySquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Publish YouTube Playlist</h3>
                <p className="text-xs text-[var(--text-muted)]">Import movies or series episodes from any public YouTube playlist directly into a section.</p>
              </div>
            </div>

            <form onSubmit={handleFetchYtPlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  YouTube Playlist Link or ID *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ytPlaylistInput}
                    onChange={(e) => setYtPlaylistInput(e.target.value)}
                    placeholder="https://www.youtube.com/playlist?list=PL..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-red-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={ytFetching || !ytPlaylistInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
                  >
                    {ytFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                    <span>Fetch Playlist</span>
                  </button>
                </div>
                {ytFetchError && <p className="text-xs text-red-400 mt-1.5">{ytFetchError}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Target Section / Category
                  </label>
                  <select
                    value={ytTargetCategory}
                    onChange={(e) => setYtTargetCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {sectionsList.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label} ({sec.badge || sec.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Format Mode
                  </label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                      <input
                        type="radio"
                        name="ytFormat"
                        checked={ytIsSeriesFormat}
                        onChange={() => setYtIsSeriesFormat(true)}
                        className="accent-red-500"
                      />
                      <span>1 Multi-Episode Series</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                      <input
                        type="radio"
                        name="ytFormat"
                        checked={!ytIsSeriesFormat}
                        onChange={() => setYtIsSeriesFormat(false)}
                        className="accent-red-500"
                      />
                      <span>Individual Videos</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Fetched Videos List Preview */}
              {ytFetchedResult && (
                <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Found {ytFetchedResult.items.length} Videos in "{ytFetchedResult.playlistTitle}"
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (ytSelectedIds.length === ytFetchedResult.items.length) {
                          setYtSelectedIds([]);
                        } else {
                          setYtSelectedIds(ytFetchedResult.items.map(i => i.id));
                        }
                      }}
                      className="text-xs text-[#e2b14c] font-mono hover:underline cursor-pointer"
                    >
                      {ytSelectedIds.length === ytFetchedResult.items.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {ytFetchedResult.items.map((item) => {
                      const isSelected = ytSelectedIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isSelected) {
                              setYtSelectedIds(prev => prev.filter(id => id !== item.id));
                            } else {
                              setYtSelectedIds(prev => [...prev, item.id]);
                            }
                          }}
                          className={`p-2 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                            isSelected
                              ? 'bg-red-950/30 border-red-500/50 text-white'
                              : 'bg-[#141414] border-[#222] text-[var(--text-muted)] opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="accent-red-500 rounded"
                          />
                          <img src={item.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=200'} alt={item.title} className="w-16 h-10 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{item.title}</p>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">ID: {item.videoId}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setShowYtModal(false)}
                      className="px-4 py-2 rounded-xl bg-[#161616] text-[var(--text-secondary)] text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={ytPublishing || ytSelectedIds.length === 0}
                      onClick={handlePublishYtSelected}
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition shadow-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Publish {ytSelectedIds.length} Selected to Section</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
