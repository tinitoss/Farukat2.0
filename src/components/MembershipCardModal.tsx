import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCw,
  History,
  CheckCircle2,
  Lock,
  Edit3,
  Check,
  Shield,
  Clock,
  Settings,
  Flame,
  Copy,
  Sparkles,
  Fingerprint,
  X,
  Upload,
  Camera,
  Crown,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import { getVerificationUrl } from '../config';
import { useTranslation } from '../i18n/LanguageContext';
import { RenderUserIdentity } from './UserIdentityRenderer';
import { SettingsView } from './SettingsView';
import { HistoryView } from './HistoryView';
import { RankBadge } from './RankBadge';
import { getRankTheme } from '../utils/rankSystem';
import {
  XpAccount,
  CardTheme,
} from '../types';
import {
  calculateLevelInfo,
  recordProfileUpdate,
  checkIsPro,
  subscribeToXpAccount,
} from '../utils/xpSystem';
import { updateTursoProfile } from '../utils/tursoClient';
import { auth, signOut } from '../firebase';
import {
  CARD_THEME_GROUPS,
  formatThemeCardNumber,
  getCardThemeStyles,
  getThemeConfig,
  isThemeUnlocked,
  ThemeConfig,
} from '../utils/cardThemeStyles';
import { isSagaCompleted, getSagaCompletions } from '../utils/sagaManager';
import { CardThemeOverlay } from './CardThemeOverlay';
import { getOptimizedAvatarUrl } from '../utils/imageOptimizer';

// Helper to trim signature canvas without relying on trim-canvas CJS library
const getCanvasDataUrl = (sigCanvasInstance: any): string => {
  if (!sigCanvasInstance) return '';
  try {
    const canvas: HTMLCanvasElement | null = sigCanvasInstance.getCanvas ? sigCanvasInstance.getCanvas() : null;
    if (!canvas) {
      return sigCanvasInstance.toDataURL ? sigCanvasInstance.toDataURL('image/png') : '';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return canvas.toDataURL('image/png');

    const trimmedWidth = maxX - minX + 1;
    const trimmedHeight = maxY - minY + 1;

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedWidth;
    trimmedCanvas.height = trimmedHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    if (!trimmedCtx) return canvas.toDataURL('image/png');

    trimmedCtx.drawImage(canvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
    return trimmedCanvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas trimming fallback', e);
    return sigCanvasInstance.toDataURL ? sigCanvasInstance.toDataURL('image/png') : '';
  }
};

const AVATAR_PRESETS = [
  { id: 'peep-alex', name: 'Open Peep Alex', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Alex' },
  { id: 'peep-aneka', name: 'Open Peep Aneka', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Aneka' },
  { id: 'peep-buster', name: 'Open Peep Buster', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Buster' },
  { id: 'peep-cali', name: 'Open Peep Cali', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Cali' },
  { id: 'peep-jasper', name: 'Open Peep Jasper', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Jasper' },
  { id: 'peep-milo', name: 'Open Peep Milo', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Milo' },
  { id: 'peep-nova', name: 'Open Peep Nova', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Nova' },
  { id: 'peep-zoe', name: 'Open Peep Zoe', url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Zoe' },
];

interface ThemeDetailSheetProps {
  theme: ThemeConfig | null;
  isOpen: boolean;
  onClose: () => void;
  unlocked: boolean;
  isEquipped: boolean;
  unlockDesc: string;
  onEquip: (themeId: CardTheme, label: string) => void;
}

const ThemeDetailSheet: React.FC<ThemeDetailSheetProps> = ({
  theme,
  isOpen,
  onClose,
  unlocked,
  isEquipped,
  unlockDesc,
  onEquip,
}) => {
  const { t } = useTranslation();
  const [justEquipped, setJustEquipped] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  if (!isOpen || !theme) return null;

  const handleEquipClick = () => {
    if (!unlocked || isEquipped || justEquipped) return;
    setJustEquipped(true);
    onEquip(theme.id, theme.label);
    setTimeout(() => {
      setJustEquipped(false);
      onClose();
    }, 700);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY !== null) {
      const deltaY = e.touches[0].clientY - dragStartY;
      if (deltaY > 0) {
        setDragOffsetY(deltaY);
      }
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 80) {
      onClose();
    }
    setDragStartY(null);
    setDragOffsetY(0);
  };

  const requirementText =
    theme.achievementCondition || unlockDesc || theme.desc || (theme.requiredLevel ? `${t('profile.level', { level: theme.requiredLevel }, `Level ${theme.requiredLevel}`)}` : t('profile.lockedAction', undefined, 'Locked'));

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: dragStartY !== null ? 'none' : 'transform 0.25s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10 w-full max-w-lg bg-[#0d0d0e] border-t border-white/10 rounded-t-3xl p-5 pb-32 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-250 select-none max-h-[90vh] overflow-y-auto"
      >
        {/* Drag handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-1 cursor-grab shrink-0" />

        {/* Title & Close */}
        <div className="flex items-center justify-between pt-1 shrink-0">
          <div className="flex flex-col min-w-0 pr-2">
            <h3 className="text-base font-bold text-white tracking-tight truncate">{theme.label}</h3>
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              {theme.category === 'show' ? t('profile.showInspired', undefined, 'Show-Inspired Edition') : t('profile.generalFinish', undefined, 'General Finish')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
            aria-label="Close sheet"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Swatch / Large Preview Card */}
        <div
          className={`relative w-full aspect-[16/9] rounded-2xl border overflow-hidden shadow-xl bg-gradient-to-br shrink-0 ${
            theme.swatchGradient
          } ${unlocked ? 'border-white/20' : 'border-white/10 grayscale opacity-80'}`}
        >
          {theme.bgImage && (
            <img
              src={theme.bgImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <CardThemeOverlay theme={theme.id} />

          {/* Badge Overlay */}
          <div className="absolute top-3 right-3 z-10">
            {isEquipped || justEquipped ? (
              <span className="px-2.5 py-1 rounded-full bg-[#e2b14c] text-black font-bold text-[10px] flex items-center gap-1 shadow-md">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>{t('profile.equipped', undefined, 'EQUIPPED')}</span>
              </span>
            ) : !unlocked ? (
              <span className="px-2.5 py-1 rounded-full bg-black/80 border border-white/20 text-white/90 font-bold text-[10px] flex items-center gap-1 shadow-md">
                <Lock className="w-3 h-3 text-[#e2b14c]" />
                <span>{t('profile.locked', undefined, 'LOCKED')}</span>
              </span>
            ) : null}
          </div>

          <div className="absolute bottom-3 left-3 right-3 z-10 p-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-[#e2b14c] uppercase font-semibold">
              {theme.label}
            </span>
            <span className="text-xs text-white font-medium line-clamp-2">
              {theme.meaning}
            </span>
          </div>
        </div>

        {/* Full Details & Requirements */}
        <div className="flex flex-col gap-2.5 bg-zinc-900/90 border border-white/10 rounded-2xl p-4 shrink-0">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
              {t('profile.description', undefined, 'Description')}
            </span>
            <p className="text-xs text-zinc-200 leading-relaxed">
              {theme.meaning}
            </p>
          </div>

          {!unlocked && (
            <div className="pt-2.5 border-t border-white/10 flex flex-col gap-1">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#e2b14c]">
                {t('profile.unlockRequirement', undefined, 'Unlock Requirement')}
              </span>
              <div className="flex items-center gap-2 text-xs text-[#e2b14c] font-medium">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>{requirementText}</span>
              </div>
            </div>
          )}
        </div>

        {/* Single Primary Action Button */}
        <div className="pt-1 pb-2 shrink-0">
          {justEquipped ? (
            <button
              disabled
              className="w-full h-[52px] rounded-xl bg-emerald-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg animate-fadeIn"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{t('profile.successfullyEquipped', undefined, 'Successfully Equipped!')}</span>
            </button>
          ) : isEquipped ? (
            <button
              disabled
              className="w-full h-[52px] rounded-xl bg-[#e2b14c]/15 border border-[#e2b14c]/40 text-[#e2b14c] font-bold text-xs flex items-center justify-center gap-2 opacity-90 cursor-default"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{t('profile.equippedAction', undefined, 'Equipped')}</span>
            </button>
          ) : !unlocked ? (
            <button
              disabled
              className="w-full h-[52px] rounded-xl bg-white/10 border border-white/5 text-zinc-500 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Lock className="w-4 h-4 text-zinc-500" />
              <span>{t('profile.lockedAction', undefined, 'Locked')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEquipClick}
              className="w-full h-[52px] rounded-xl bg-[#e2b14c] text-black font-bold text-xs hover:brightness-110 active:scale-[0.99] transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('profile.equipFinish', undefined, 'Equip Finish')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface MembershipCardModalProps {
  account: XpAccount;
  onClose: () => void;
  onUpdateAccount: () => void;
  onSignOut?: () => void;
  isFullPage?: boolean;
  initialTab?: 'card' | 'settings' | 'history' | 'edit';
  onSelectMedia?: (media: any) => void;
}

export const MembershipCardModal: React.FC<MembershipCardModalProps> = ({
  account,
  onClose,
  onUpdateAccount,
  onSignOut,
  isFullPage = false,
  initialTab = 'card',
  onSelectMedia,
}) => {
  const { t } = useTranslation();
  const [isFlipped, setIsFlipped] = useState(false);
  const [copiedCardNum, setCopiedCardNum] = useState(false);
  const [activeTab, setActiveTab] = useState<'card' | 'edit' | 'settings' | 'history'>(initialTab);

  const activeUid = auth.currentUser?.uid || account?.userId || account?.profile?.memberId;

  // Real-time XP account listener inside Profile
  useEffect(() => {
    if (!activeUid) return;
    const unsubXp = subscribeToXpAccount(() => {
      onUpdateAccount();
    }, activeUid);

    return () => {
      unsubXp();
    };
  }, [activeUid, onUpdateAccount]);

  // 3D Card Physical Interaction Engine (Pointer Events + RAF)
  const cardRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);

  // Profile Editor State
  const [editName, setEditName] = useState(account?.profile?.name || '');
  const [editAvatar, setEditAvatar] = useState(account?.profile?.avatarUrl || '');
  const [editBio, setEditBio] = useState(account?.profile?.bio || '');
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>(account?.profile?.cardTheme || 'ivory-gold');
  const [currentSignature, setCurrentSignature] = useState<string | undefined>(account?.profile?.signatureUrl);
  const [detailSheetTheme, setDetailSheetTheme] = useState<ThemeConfig | null>(null);
  const [themeLockNotice, setThemeLockNotice] = useState<string | null>(null);
  const [themeEquipSuccessNotice, setThemeEquipSuccessNotice] = useState<string | null>(null);
  const sigCanvas = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
            setEditAvatar(compressedUrl);
          } else {
            setEditAvatar(reader.result as string);
          }
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Synchronize selectedTheme whenever account cardTheme updates
  useEffect(() => {
    if (account?.profile?.cardTheme) {
      setSelectedTheme(account.profile.cardTheme);
    }
  }, [account?.profile?.cardTheme]);

  // Synchronize signature whenever account signatureUrl updates
  useEffect(() => {
    if (account?.profile?.signatureUrl) {
      setCurrentSignature(account.profile.signatureUrl);
    }
  }, [account?.profile?.signatureUrl]);

  const hasSignature = Boolean(
    currentSignature && 
    typeof currentSignature === 'string' && 
    currentSignature.trim().length > 0 && 
    currentSignature !== 'null' && 
    currentSignature !== 'undefined'
  );

  const levelInfo = calculateLevelInfo(account.lifetimeXp);
  const rankTheme = getRankTheme(levelInfo.rankTier);
  const isPro = checkIsPro(account);
  const isDardiLadiCompletedSaga = isSagaCompleted('dardi-ladi') || (getSagaCompletions('dardi-ladi').length >= 22);

  const currentEquippedTheme = (account?.profile?.cardTheme || selectedTheme || 'ivory-gold') as CardTheme;
  const rawTheme = (selectedTheme || account?.profile?.cardTheme || 'ivory-gold') as CardTheme;

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Handled gracefully
    }

    activePointerIdRef.current = e.pointerId;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isDraggingRef.current = false;
    setIsInteracting(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId || !pointerStartRef.current) return;

    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = e.clientY - pointerStartRef.current.y;

    if (!isDraggingRef.current && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
      isDraggingRef.current = true;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 12;
    const rotY = ((x - centerX) / centerX) * 15;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      setRotateX(rotX);
      setRotateY(rotY);
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    const wasDrag = isDraggingRef.current;
    const startTime = pointerStartRef.current?.time || 0;
    const duration = Date.now() - startTime;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignored
    }

    activePointerIdRef.current = null;
    pointerStartRef.current = null;
    isDraggingRef.current = false;
    setIsInteracting(false);

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    setRotateX(0);
    setRotateY(0);

    // Clean tap detection: toggle flip on quick tap without drag
    if (!wasDrag && duration < 350) {
      const target = e.target as HTMLElement;
      if (!target.closest('button') && !target.closest('a')) {
        setIsFlipped((prev) => !prev);
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
      }
      activePointerIdRef.current = null;
      pointerStartRef.current = null;
      isDraggingRef.current = false;
      setIsInteracting(false);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      setRotateX(0);
      setRotateY(0);
    }
  };

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Copy Card Number
  const handleCopyCardNumber = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentTheme = (selectedTheme || account?.profile?.cardTheme || 'ivory-gold') as CardTheme;
    const baseNum = account?.profile?.cardNumber || '';
    const textToCopy = formatThemeCardNumber(baseNum, currentTheme) || baseNum;
    if (textToCopy) {
      navigator.clipboard?.writeText(textToCopy);
      setCopiedCardNum(true);
      setTimeout(() => setCopiedCardNum(false), 2200);
    }
  };

  // Instantly Equip Theme to Account, Card, and Directory
  const handleEquipTheme = async (themeId: CardTheme, themeLabel: string) => {
    try {
      setSelectedTheme(themeId);
      setThemeLockNotice(null);
      setThemeEquipSuccessNotice(`Equipped "${themeLabel}" as active card finish!`);

      // 1. Immediately mutate local account object so UI reflects it synchronously
      if (account?.profile) {
        account.profile.cardTheme = themeId;
      }

      // 2. Persist to storage and cloud
      await recordProfileUpdate(
        account?.profile?.name || editName,
        account?.profile?.avatarUrl || editAvatar,
        themeId,
        account?.profile?.signatureUrl
      );

      // Explicitly update Turso Database
      updateTursoProfile({
        cardTheme: themeId,
        explicitUserId: auth.currentUser?.uid || account?.userId,
        cardNumber: account?.profile?.cardNumber,
        username: account?.profile?.name || editName,
        lifetimeXp: account?.lifetimeXp,
        level: account?.currentLevel,
      }).catch((tursoErr) => console.warn('Direct Turso theme update notice:', tursoErr));

      onUpdateAccount();
    } catch (err) {
      console.error('Failed to equip card theme:', err);
    }
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      let signatureUrl = currentSignature || account?.profile?.signatureUrl;
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        const base64Image = getCanvasDataUrl(sigCanvas.current);
        signatureUrl = base64Image;
        setCurrentSignature(base64Image);
        if (account?.profile) account.profile.signatureUrl = base64Image;
      }
      if (account?.profile) {
        account.profile.name = editName.trim() || account.profile.name;
        account.profile.avatarUrl = editAvatar.trim() || account.profile.avatarUrl;
        account.profile.bio = editBio.trim() || account.profile.bio;
        account.profile.cardTheme = selectedTheme;
        if (signatureUrl) account.profile.signatureUrl = signatureUrl;
      }
      await recordProfileUpdate(editName, editAvatar, selectedTheme, signatureUrl);
      
      updateTursoProfile({
        cardTheme: selectedTheme,
        explicitUserId: auth.currentUser?.uid || account?.userId,
        cardNumber: account?.profile?.cardNumber,
        username: editName.trim() || account?.profile?.name,
        avatar: editAvatar.trim() || account?.profile?.avatarUrl,
        bio: editBio.trim(),
        signatureUrl: signatureUrl,
        lifetimeXp: account?.lifetimeXp,
        level: account?.currentLevel,
      }).catch((tursoErr) => console.warn('Direct Turso profile update notice:', tursoErr));

      onUpdateAccount();
      setActiveTab('card');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const themeStyle = getCardThemeStyles(rawTheme);
  const activeThemedCardNumber = formatThemeCardNumber(account?.profile?.cardNumber || '', rawTheme);

  return (
    <div className={isFullPage ? "w-full bg-[var(--bg-main)] text-[var(--text-primary)] pb-0 animate-fadeIn" : "fixed inset-0 z-50 bg-[var(--bg-main)]/95 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"}>
      <div className={isFullPage ? "w-full max-w-4xl mx-auto flex flex-col gap-0 px-2 sm:px-4" : "relative w-full max-w-4xl bg-[var(--bg-surface)] border border-[#161616] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"}>
      
        {/* ========================================================================= */}
        {/* MODAL HEADER (Only shown in popup modal mode) */}
        {/* ========================================================================= */}
        {!isFullPage && (
          <div className="flex items-center justify-end px-6 py-4 border-b border-[#141414] bg-[#090909]/90 backdrop-blur-md">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PROFILE HEADER HERO */}
        {/* ========================================================================= */}
        <div className="relative px-4 sm:px-6 pt-4 pb-3.5 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.07] flex flex-col gap-3 animate-fadeIn">
          {/* Single Profile Info Block */}
          <div className="relative flex items-center gap-3.5 w-full">
            {/* Avatar - Proportional size anchoring the block */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0 border border-white/10 bg-zinc-900 shadow-inner">
              <img
                src={getOptimizedAvatarUrl(account?.profile?.avatarUrl, 140)}
                alt={account?.profile?.name || 'Member avatar'}
                className={`w-full h-full object-cover ${account?.equippedCosmetics?.frame || ''}`}
                referrerPolicy="no-referrer"
                loading="eager"
                decoding="async"
              />
            </div>

            {/* Studio / Member Details */}
            <div className="flex flex-col min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-medium text-white tracking-tight truncate leading-snug">
                {account?.profile?.name || 'GoldPrince STUDIO'}
              </h2>

              {/* Secondary Line: Level (1-499) OR Rank (Bronze I ... MASTER) */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono tracking-wide mt-0.5">
                {levelInfo.isRanked ? (
                  <>
                    <RankBadge
                      tier={levelInfo.rankTier || 'Bronze'}
                      subRank={levelInfo.rankSub}
                      label={levelInfo.rankLabel || undefined}
                      size="sm"
                    />
                    <span className="text-zinc-600 font-light">•</span>
                    <span className="text-zinc-300 font-medium tracking-wide">{t('profile.cinemaLegend', undefined, 'Cinema Legend')}</span>
                  </>
                ) : (
                  <>
                    <span className="text-zinc-400">{t('achievements.level', { level: levelInfo.level }, `Level ${levelInfo.level}`)}</span>
                    <span className="text-zinc-600 font-light">•</span>
                    <span className="text-[#e2b14c] font-medium tracking-wider uppercase">{levelInfo.title}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress / Rank XP Bar */}
          {levelInfo.isMaster ? (
            /* MASTER: Ceiling reached — lifetime XP counter counting up indefinitely, no next rank progress bar */
            <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-[#e2b14c]/15 via-[#a855f7]/15 to-[#e2b14c]/15 border border-[#e2b14c]/40 shadow-inner">
              <div className="flex items-center gap-2">
                <Crown size={15} className="text-[#e2b14c]" />
                <span className="text-xs font-mono text-zinc-200">
                  <span className="font-black text-white">{(account?.lifetimeXp || 0).toLocaleString()}</span> {t('leaderboard.lifetimeXp', undefined, 'Lifetime XP')}
                </span>
              </div>
              <span className="text-[9px] font-mono font-black uppercase text-[#e2b14c] tracking-wider border border-[#e2b14c]/40 px-2 py-0.5 rounded bg-[#e2b14c]/20">
                {t('profile.apexMaster', undefined, 'Apex Master')}
              </span>
            </div>
          ) : levelInfo.isRanked ? (
            /* Ranked Tier Progression Bar (Bronze I ... Legendary III): Tier-specific color identity */
            <div className="flex flex-col gap-1.5 pt-0.5">
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, levelInfo.progressPercent))}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${rankTheme.progressBar}`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className={`font-semibold ${rankTheme.textColor}`}>
                  {t('profile.levelPercent', { percent: levelInfo.progressPercent }, `${levelInfo.progressPercent}% Complete`)}
                </span>
                <span className="text-zinc-400">
                  {t('profile.xpToNext', { xp: levelInfo.xpNeededForNext.toLocaleString(), next: levelInfo.nextRankLabel || t('leaderboard.rank', undefined, 'Rank') }, `${levelInfo.xpNeededForNext.toLocaleString()} XP to ${levelInfo.nextRankLabel || 'Next Rank'}`)}
                </span>
              </div>
            </div>
          ) : (
            /* Standard Pre-500 Level Progress Bar */
            <div className="flex flex-col gap-1.5 pt-0.5">
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, levelInfo.progressPercent))}%` }}
                  className="h-full bg-[#e2b14c] rounded-full transition-all duration-500"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span className="text-[#e2b14c]/90 font-medium">{t('profile.levelPercent', { percent: levelInfo.progressPercent }, `${levelInfo.progressPercent}% Complete`)}</span>
                <span>
                  {levelInfo.nextLevelXp
                    ? `${(levelInfo.nextLevelXp - account.lifetimeXp).toLocaleString()} XP to Level ${levelInfo.level + 1}`
                    : 'Max Tier Achieved'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* REFINED SEGMENTED NAVIGATION */}
        {/* ========================================================================= */}
        <div className="px-3 sm:px-6 pt-2.5 pb-2 border-b border-[#141414] bg-[#070707]/70">
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-950/60 border border-white/5 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('card')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10.5px] sm:text-xs font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'card'
                  ? 'bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{t('profile.digitalPass', undefined, 'Digital Pass')}</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10.5px] sm:text-xs font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span>{t('profile.settings', undefined, 'Settings')}</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10.5px] sm:text-xs font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>{t('profile.history', undefined, 'History')}</span>
            </button>

            <button
              onClick={() => setActiveTab('edit')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10.5px] sm:text-xs font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'edit'
                  ? 'bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <span>{t('profile.editProfile', undefined, 'Edit Profile')}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY AREA */}
        {/* ========================================================================= */}
        <div className={isFullPage ? "p-3.5 pt-2.5 pb-0 sm:p-5 sm:pt-3 sm:pb-0 flex flex-col gap-2.5 bg-[var(--bg-main)]" : "flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 bg-[var(--bg-surface)]"}>

          {activeTab === 'settings' && (
            <div className="flex flex-col">
              <SettingsView
                account={account}
                onUpdateAccount={onUpdateAccount}
                onSignOut={onSignOut || (() => {})}
                isGuest={account?.profile?.memberId === 'GUEST-0000'}
              />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="flex flex-col">
              <HistoryView
                account={account}
                onSelectMedia={(item) => {
                  if (onSelectMedia) {
                    onSelectMedia(item);
                  }
                  onClose();
                }}
                onClose={() => setActiveTab('card')}
              />
            </div>
          )}

          {activeTab === 'card' && (
            <div className="flex flex-col gap-2.5 items-center pb-0">
              
              {/* 3D Interactive Card Canvas with Clean Matte Finish (NO GLOW) */}
              <div className="w-full flex flex-col items-center">
                <div
                  className="w-full max-w-[460px] h-[260px] sm:h-[275px] perspective-[1200px] select-none relative group cursor-grab active:cursor-grabbing"
                  style={{
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  onLostPointerCapture={handlePointerCancel}
                >
                  <div
                    ref={cardRef}
                    style={{
                      transform: `rotateX(${rotateX}deg) rotateY(${rotateY + (isFlipped ? 180 : 0)}deg) scale(${isInteracting ? 1.018 : 1})`,
                      transformStyle: 'preserve-3d',
                      transition: isInteracting ? 'none' : 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      willChange: 'transform',
                    }}
                    className="relative w-full h-full"
                  >
                    {/* FRONT SIDE - Crisp Matte Finish, No Glowing Shadows */}
                    <div 
                      className={`absolute inset-0 w-full h-full rounded-2xl shadow-xl shadow-black/80 border bg-gradient-to-br ${themeStyle.cardBg} ${themeStyle.border} p-5 flex flex-col justify-between overflow-hidden`}
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      {/* Theme Custom Graphic & Motif Overlay */}
                      <CardThemeOverlay theme={rawTheme} />

                      {/* Front Content Container */}
                      <div className="relative z-10 flex flex-col justify-between h-full">
                        {/* Top Row: Digital Pass Header and Metallic Smartchip with Subtle Flip Icon */}
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className={`font-mono text-[11px] font-black tracking-[0.25em] uppercase ${themeStyle.textGold}`}>
                              {t('profile.digitalPass', undefined, 'DIGITAL PASS').toUpperCase()}
                            </span>
                            <span className="text-[8px] font-mono text-white/50 tracking-[0.15em] uppercase">
                              {levelInfo.isRanked ? `${levelInfo.rankLabel} ACCESS` : `${levelInfo.title} ACCESS`}
                            </span>
                          </div>

                          {/* Metallic Security Smartchip & Subtle Corner Flip Hint */}
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-7 rounded-md bg-gradient-to-br ${themeStyle.chipColor} border border-white/30 shadow-inner flex flex-col justify-around p-1 opacity-90 relative overflow-hidden`}>
                              <div className="w-full h-px bg-[var(--bg-main)]/40" />
                              <div className="w-full h-px bg-[var(--bg-main)]/40" />
                              <div className="absolute right-1 top-1 bottom-1 w-px bg-[var(--bg-main)]/30" />
                            </div>
                            <RotateCw className="w-3 h-3 text-white/35 pointer-events-none" />
                          </div>
                        </div>

                        {/* Card Number & Perpetual Expiry Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-sm sm:text-base font-black tracking-widest ${themeStyle.textGold}`}>
                              {activeThemedCardNumber}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyCardNumber(e);
                              }}
                              className="p-1.5 rounded-lg bg-[var(--bg-main)]/50 hover:bg-[var(--bg-main)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer border border-white/5"
                              title="Copy Card Number"
                            >
                              {copiedCardNum ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <span className="text-[10px] font-mono text-[var(--text-secondary)] tracking-wider font-bold">
                            {t('profile.expPerpetual', undefined, 'EXP: PERPETUAL')}
                          </span>
                        </div>

                        {/* Bottom Row: Holder Avatar, Real Name, Level & Issue Date */}
                        <div className="flex items-end justify-between pt-1.5 border-t border-white/10">
                          <div className="flex items-center gap-2.5">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-zinc-900">
                              <img
                                src={getOptimizedAvatarUrl(account?.profile?.avatarUrl, 100)}
                                alt="Card holder avatar"
                                className={`w-full h-full object-cover ${account?.equippedCosmetics?.frame || 'border border-[#e2b14c]/60'} shadow-sm`}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                onContextMenu={(e) => e.preventDefault()}
                              />
                            </div>
                            <div className="flex flex-col">
                              <RenderUserIdentity
                                user={{ ...account?.profile, isProMember: isPro, isPro }}
                                equippedCosmetics={account?.equippedCosmetics}
                                showAvatar={false}
                                size="sm"
                              />
                              <span className={`text-[10px] font-bold ${themeStyle.subtext}`}>
                                {levelInfo.isRanked
                                  ? `${levelInfo.rankLabel} • ${(account?.lifetimeXp || 0).toLocaleString()} XP`
                                  : `${t('achievements.level', { level: levelInfo.level }, `Level ${levelInfo.level}`)} • ${(account?.lifetimeXp || 0).toLocaleString()} XP`}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col text-right">
                            <span className="text-[8px] text-[var(--text-muted)] uppercase font-bold tracking-wider">{t('profile.memberSince', undefined, 'Member Since')}</span>
                            <span className="text-[10px] font-mono font-bold text-[#bbb]">
                              {account?.profile?.memberSince || '2026'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BACK SIDE - Crisp Matte Finish, No Glowing Shadows */}
                    <div 
                      className={`absolute inset-0 w-full h-full rounded-2xl shadow-xl shadow-black/80 border bg-gradient-to-br ${themeStyle.cardBg} ${themeStyle.border} overflow-hidden`}
                      style={{ 
                        backfaceVisibility: 'hidden', 
                        transform: 'rotateY(180deg)' 
                      }}
                    >
                      {/* Theme Custom Graphic & Motif Overlay */}
                      <CardThemeOverlay theme={rawTheme} />

                      {/* Magnetic Stripe */}
                      <div className="relative z-10 w-full h-12 bg-[var(--bg-main)]/90 mt-6 border-y border-white/5" />
                      
                      <div className="relative z-10 p-5 flex flex-col justify-between h-[calc(100%-3rem)]">
                        {/* Signature Area */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold text-[var(--text-primary)]/40 uppercase tracking-widest">{t('profile.authSignature', undefined, 'Authorized Signature')}</span>
                            {!hasSignature && (
                              <span className="text-[8px] font-bold text-[var(--text-primary)]/40 uppercase tracking-widest">{t('profile.notValidUnlessSigned', undefined, 'Not Valid Unless Signed')}</span>
                            )}
                          </div>
                          <div className="w-full h-14 bg-white/95 rounded flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                 style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 10px, transparent 10px, transparent 20px)' }} />
                            
                            {hasSignature && (currentSignature || account?.profile?.signatureUrl) ? (
                              <img 
                                src={(currentSignature || account?.profile?.signatureUrl)!} 
                                alt="Signature" 
                                className="h-10 object-contain relative z-10 filter brightness-90 contrast-125" 
                              />
                            ) : (
                              <span className="text-[10px] font-serif italic text-black/20 select-none">{t('profile.noSignatureRecorded', undefined, 'No signature recorded')}</span>
                            )}
                          </div>
                        </div>

                        {/* Security Info & QR Code */}
                        <div className="flex items-end justify-between gap-4">
                          <div className="flex-1 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-0.5 rounded bg-[var(--bg-main)]/40 border border-white/10 flex items-center gap-1.5">
                                <Fingerprint className={`w-3 h-3 ${themeStyle.textGold}`} />
                                <span className="text-[7.5px] font-mono text-[var(--text-primary)]/70 tracking-wider">{t('profile.securePassId', undefined, 'SECURE PASS ID')}: {account?.profile?.memberId || ''}</span>
                              </div>
                            </div>
                            <span className="text-[6.5px] text-[var(--text-primary)]/30 uppercase font-bold leading-tight">
                              {t('profile.verifiedPass', undefined, 'FARUKAT DIGITAL VERIFIED PASS')}
                            </span>
                          </div>
                          
                          {/* Dynamic Verifiable QR Code */}
                          <a
                            href={getVerificationUrl(activeThemedCardNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 bg-white rounded-md shadow-inner flex items-center justify-center transition hover:scale-105 active:scale-95 cursor-pointer"
                            title="Scan or tap to verify public pass authenticity"
                          >
                            <QRCodeSVG
                              value={getVerificationUrl(activeThemedCardNumber)}
                              size={34}
                              level="M"
                              fgColor="#000000"
                              bgColor="#ffffff"
                            />
                          </a>
                        </div>

                        {/* Bottom Branding */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-mono font-black text-[var(--text-primary)]/40 tracking-widest uppercase">{t('profile.premierDigitalPass', undefined, 'PREMIER DIGITAL PASS')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-mono text-[var(--text-primary)]/30">{t('profile.verifiedVersion', undefined, 'VERIFIED v2.4.0')}</span>
                            <RotateCw className="w-3 h-3 text-white/35 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Statistics Dashboard - Clean Two-Box Row */}
              <div className="w-full grid grid-cols-2 gap-2.5 mb-0 pb-0">
                {/* 1. Watch Time */}
                <div className="p-3 bg-[#0d0d0d] border border-[#161616] rounded-2xl flex items-center gap-3 shadow-sm hover:border-white/10 transition">
                  <div className="p-2 rounded-xl bg-[var(--bg-main)]/40 text-[#e2b14c] flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-black text-[var(--text-primary)] tracking-tight truncate">
                      {(() => {
                        const totalSecs = Math.floor(account.stats?.totalWatchSeconds || 0);
                        const hours = Math.floor(totalSecs / 3600);
                        const minutes = Math.floor((totalSecs % 3600) / 60);
                        const seconds = totalSecs % 60;
                        if (hours > 0) {
                          return (
                            <>
                              {hours}<span className="text-[10px] text-[var(--text-muted)] font-normal font-mono mx-0.5">h</span> {minutes}<span className="text-[10px] text-[var(--text-muted)] font-normal font-mono ml-0.5">m</span>
                            </>
                          );
                        }
                        if (minutes > 0) {
                          return (
                            <>
                              {minutes} <span className="text-[10px] text-[var(--text-muted)] font-normal font-mono">{minutes === 1 ? 'min' : 'mins'}</span>
                            </>
                          );
                        }
                        return (
                          <>
                            {seconds} <span className="text-[10px] text-[var(--text-muted)] font-normal font-mono">{seconds === 1 ? 'sec' : 'secs'}</span>
                          </>
                        );
                      })()}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider truncate">{t('profile.watchTime', undefined, 'Watch Time')}</span>
                  </div>
                </div>

                {/* 2. Day Streak */}
                <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl flex items-center gap-3 shadow-sm hover:border-white/10 transition">
                  <div className="p-2 rounded-xl bg-[var(--bg-base)]/40 text-[#e2b14c] flex-shrink-0">
                    <Flame className="w-4 h-4 fill-[#e2b14c]/20 text-[#e2b14c]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-black text-[var(--text-primary)] tracking-tight truncate">
                      {account.stats?.currentStreak || 0} <span className="text-[10px] text-[var(--text-muted)] font-normal font-mono">{(account.stats?.currentStreak || 0) === 1 ? 'day' : 'days'}</span>
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider truncate">{t('profile.dayStreak', undefined, 'Day Streak')}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: CARD STYLING & PROFILE SETTINGS */}
          {/* ========================================================================= */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-6 max-w-lg mx-auto w-full pb-40">
              {/* Group 1 — CARDHOLDER NAME */}
              <section className="space-y-2">
                <h2 className="text-[11px] font-mono font-semibold tracking-wider text-[var(--text-secondary)] uppercase px-1 select-none">
                  {t('profile.cardholderName', undefined, 'CARDHOLDER NAME')}
                </h2>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-sm">
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('profile.enterCardholderName', undefined, 'Enter cardholder name')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-white/10 text-xs text-[var(--text-primary)] placeholder-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent-gold)] focus:ring-1 focus:ring-[var(--accent-gold)]/20 transition"
                  />
                </div>
              </section>

              {/* Group 2 — AVATAR */}
              <section className="space-y-2">
                <h2 className="text-[11px] font-mono font-semibold tracking-wider text-[var(--text-secondary)] uppercase px-1 select-none">
                  {t('profile.avatar', undefined, 'AVATAR')}
                </h2>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-sm">
                  <div className="grid grid-cols-4 gap-3">
                    {AVATAR_PRESETS.map((preset) => {
                      const isSelected = editAvatar === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setEditAvatar(preset.url)}
                          className={`relative rounded-xl overflow-hidden aspect-square border transition-all duration-200 cursor-pointer bg-[var(--bg-elevated)] ${
                            isSelected
                              ? 'border-[var(--accent-gold)] ring-2 ring-[var(--accent-gold)]/40'
                              : 'border-white/10 opacity-80 hover:opacity-100 hover:border-white/30'
                          }`}
                          title={preset.name}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      );
                    })}

                    {/* Custom Upload Photo Tile */}
                    {(() => {
                      const isCustomAvatar = Boolean(editAvatar && !AVATAR_PRESETS.some((p) => p.url === editAvatar));
                      return (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarFileUpload}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative rounded-xl overflow-hidden aspect-square border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-1 p-1 bg-[var(--bg-elevated)] ${
                              isCustomAvatar
                                ? 'border-[var(--accent-gold)] ring-2 ring-[var(--accent-gold)]/40'
                                : 'border-dashed border-white/20 hover:border-[var(--accent-gold)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                            title={t('profile.uploadFromDevice', undefined, 'Upload photo from device')}
                          >
                            {isCustomAvatar ? (
                              <img src={editAvatar} alt="Uploaded avatar" className="w-full h-full object-cover" onContextMenu={(e) => e.preventDefault()} />
                            ) : (
                              <>
                                <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[var(--text-primary)]">
                                  <Camera className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[9.5px] font-medium leading-none text-[var(--text-secondary)]">{t('profile.upload', undefined, 'Upload')}</span>
                              </>
                            )}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </section>

              {/* Group 3 — CARD THEME FINISH */}
              <section className="space-y-4">
                <h2 className="text-[11px] font-mono font-semibold tracking-wider text-[var(--text-secondary)] uppercase px-1 select-none">
                  {t('profile.cardTheme', undefined, 'CARD THEME FINISH').toUpperCase()}
                </h2>

                {/* Currently Equipped Summary Card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg shrink-0 border border-white/10 shadow-inner flex items-center justify-center relative overflow-hidden bg-gradient-to-br ${getThemeConfig(currentEquippedTheme).swatchGradient}`}
                    >
                      {getThemeConfig(currentEquippedTheme).bgImage && (
                        <img
                          src={getThemeConfig(currentEquippedTheme).bgImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono uppercase tracking-wider">{t('profile.currentlyEquipped', undefined, 'Currently equipped')}</span>
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {getThemeConfig(currentEquippedTheme).label}
                      </span>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] border border-[var(--accent-gold)]/30 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                </div>

                {/* Equip Success / Lock Notices */}
                {themeEquipSuccessNotice && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>{themeEquipSuccessNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setThemeEquipSuccessNotice(null)}
                      className="text-emerald-400 hover:text-white p-1 rounded transition cursor-pointer"
                      aria-label="Close notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {themeLockNotice && (
                  <div className="p-3 rounded-xl bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/20 text-[var(--accent-gold)] text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0 text-[var(--accent-gold)]" />
                      <span>{themeLockNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setThemeLockNotice(null)}
                      className="text-[var(--accent-gold)] hover:text-white p-1 rounded transition cursor-pointer"
                      aria-label="Close notice"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Theme Subgroups — 2 Column Widget Grid */}
                {CARD_THEME_GROUPS.map((group) => (
                  <div key={group.groupId} className="space-y-2.5">
                    <div className="px-1">
                      <h3 className="text-xs font-mono font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                        {group.groupId === 'general' ? t('profile.generalFinishes', undefined, 'GENERAL FINISHES') : t('profile.showInspiredEditions', undefined, 'SHOW-INSPIRED EDITIONS')}
                      </h3>
                      <p className="text-[10.5px] text-[var(--text-disabled)]">{group.groupSubtitle}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {group.themes.map((theme: ThemeConfig) => {
                        const { unlocked } = isThemeUnlocked(
                          theme,
                          levelInfo.level,
                          isDardiLadiCompletedSaga
                        );
                        const isEquipped = currentEquippedTheme === theme.id;

                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setDetailSheetTheme(theme)}
                            className={`relative rounded-2xl aspect-square border overflow-hidden transition-all text-left flex flex-col justify-between group cursor-pointer ${
                              isEquipped
                                ? 'ring-2 ring-[#e2b14c] border-[#e2b14c] shadow-[0_0_15px_rgba(226,177,76,0.25)]'
                                : unlocked
                                ? 'border-white/10 hover:border-white/30 bg-zinc-900/80 shadow-sm'
                                : 'border-white/5 opacity-50 filter saturate-50 bg-zinc-950/90'
                            }`}
                          >
                            {/* Swatch & Motif Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${theme.swatchGradient}`}>
                              {theme.bgImage && (
                                <img
                                  src={theme.bgImage}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <CardThemeOverlay theme={theme.id} />
                            </div>

                            {/* Badges Overlay (Top Right) */}
                            <div className="relative z-10 p-2.5 flex justify-end w-full">
                              {isEquipped ? (
                                <div className="w-6 h-6 rounded-full bg-[#e2b14c] text-black shadow-md flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              ) : !unlocked ? (
                                <div className="w-6 h-6 rounded-full bg-black/75 border border-white/20 text-white/80 shadow-md flex items-center justify-center">
                                  <Lock className="w-3.5 h-3.5" />
                                </div>
                              ) : null}
                            </div>

                            {/* Bottom Title Overlay */}
                            <div className="relative z-10 inset-x-0 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 text-center w-full mt-auto">
                              <span className="text-[11px] font-bold text-white tracking-tight truncate block">
                                {theme.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Detail Bottom Sheet Modal */}
                {detailSheetTheme && (
                  <ThemeDetailSheet
                    theme={detailSheetTheme}
                    isOpen={Boolean(detailSheetTheme)}
                    onClose={() => setDetailSheetTheme(null)}
                    unlocked={
                      isThemeUnlocked(
                        detailSheetTheme,
                        levelInfo.level,
                        isDardiLadiCompletedSaga
                      ).unlocked
                    }
                    isEquipped={currentEquippedTheme === detailSheetTheme.id}
                    unlockDesc={
                      isThemeUnlocked(
                        detailSheetTheme,
                        levelInfo.level,
                        isDardiLadiCompletedSaga
                      ).desc
                    }
                    onEquip={(themeId, label) => {
                      handleEquipTheme(themeId, label);
                    }}
                  />
                )}
              </section>

              {/* Group 4 — AUTHORIZED SIGNATURE */}
              <section className="space-y-2">
                <h2 className="text-[11px] font-mono font-semibold tracking-wider text-[var(--text-secondary)] uppercase px-1 select-none">
                  {t('profile.authorizedSignatureUpper', undefined, 'AUTHORIZED SIGNATURE')}
                </h2>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-sm">
                  {hasSignature && (currentSignature || account?.profile?.signatureUrl) ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-white p-1.5 rounded-lg h-9 flex items-center justify-center min-w-[80px] shrink-0 border border-white/10">
                          <img src={(currentSignature || account?.profile?.signatureUrl)!} alt="Saved Signature" className="h-6 object-contain" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-[var(--text-primary)] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                            <span>{t('profile.signatureRecorded', undefined, 'Signature recorded')}</span>
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)] truncate">
                            {t('profile.lockedToPass', undefined, 'Locked to Pass #')}{account?.profile?.cardNumber || ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSignature('');
                            if (account?.profile) account.profile.signatureUrl = '';
                          }}
                          className="text-[10px] text-[var(--accent-gold)] hover:underline font-mono px-2 py-1 cursor-pointer"
                        >
                          {t('profile.resign', undefined, 'Re-sign')}
                        </button>
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-[var(--text-disabled)] font-mono border border-white/10 flex items-center gap-1 shrink-0">
                          <Lock className="w-2.5 h-2.5 text-[var(--text-disabled)]" />
                          <span>{t('profile.locked', undefined, 'Locked')}</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="bg-[#eaeaea] border border-white/10 rounded-xl overflow-hidden relative" style={{ height: '100px' }}>
                        <SignatureCanvas
                          ref={sigCanvas}
                          penColor="black"
                          canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                        />
                        <div className="absolute top-1.5 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                                const base64Image = getCanvasDataUrl(sigCanvas.current);
                                setCurrentSignature(base64Image);
                                if (account?.profile) account.profile.signatureUrl = base64Image;
                              }
                            }}
                            className="px-2 py-0.5 rounded text-[10px] bg-[#e2b14c] hover:bg-[#e2b14c]/90 text-black font-semibold transition cursor-pointer"
                          >
                            {t('profile.apply', undefined, 'Apply')}
                          </button>
                          <button
                            type="button"
                            onClick={() => sigCanvas.current?.clear()}
                            className="px-2 py-0.5 rounded text-[10px] bg-black/10 hover:bg-black/20 text-black font-medium transition cursor-pointer"
                          >
                            {t('profile.clear', undefined, 'Clear')}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {t('profile.signInstructions', undefined, 'Sign using your finger or pointer. Tap Apply to lock it to your card.')}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Bottom Action — Primary Save Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full h-[52px] rounded-xl bg-[var(--accent-gold)] text-black font-semibold text-xs hover:brightness-110 active:scale-[0.99] transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? t('profile.savingProfile', undefined, 'Saving profile...') : t('profile.saveCardProfile', undefined, 'Save card profile')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
