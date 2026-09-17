import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  Award,
  Palette,
  ArrowRight,
  Copy,
  Check,
  SearchX,
  ExternalLink,
  ChevronRight,
  Film,
  Lock,
} from 'lucide-react';
import { FarukatLogo, FarukatRotatingLoader } from './FarukatLogo';
import { PublicMemberProfile } from '../types';
import { lookupMemberForVerification } from '../utils/memberSystem';
import { formatThemeCardNumber, getCardThemeLabel, getCardThemeStyles } from '../utils/cardThemeStyles';
import { getVerificationUrl } from '../config';
import { useTranslation } from '../i18n/LanguageContext';
import { QRCodeSVG } from 'qrcode.react';

interface VerifyCardPageProps {
  cardId: string;
  currentUser?: any | null;
  onSignUpWithRef?: (referrerCardId: string) => void;
  onViewMemberProfile?: (member: PublicMemberProfile) => void;
  onGoToApp?: () => void;
}

export const VerifyCardPage: React.FC<VerifyCardPageProps> = ({
  cardId,
  currentUser,
  onSignUpWithRef,
  onViewMemberProfile,
  onGoToApp,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<PublicMemberProfile | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    lookupMemberForVerification(cardId)
      .then((found) => {
        if (isMounted) {
          setMember(found);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMember(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cardId]);

  const activeThemeId = member?.cardTheme || 'ivory-gold';
  const themeLabel = getCardThemeLabel(activeThemeId);
  const themeStyle = getCardThemeStyles(activeThemeId);
  const fullThemedCardNumber = member
    ? formatThemeCardNumber(member.cardNumber, activeThemeId)
    : cardId.toUpperCase();

  const handleCopyLink = () => {
    const url = getVerificationUrl(fullThemedCardNumber);
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(fullThemedCardNumber);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSignUpClick = () => {
    // Capture the referral parameter in storage so signup flow consumes it
    try {
      localStorage.setItem('farukat_referral_ref', fullThemedCardNumber);
    } catch {}

    if (onSignUpWithRef) {
      onSignUpWithRef(fullThemedCardNumber);
    } else {
      // Fallback navigation with referral query parameter
      window.location.href = `/?ref=${encodeURIComponent(fullThemedCardNumber)}`;
    }
  };

  const isLoggedIn = Boolean(
    currentUser && !currentUser.isGuest && currentUser.uid !== 'guest' && !currentUser.isAnonymous
  );

  return (
    <div className="min-h-screen w-full bg-[#080808] text-[var(--text-primary)] font-sans antialiased flex flex-col justify-between overflow-x-hidden">
      {/* Mobile Shell Container (Strictly 375px - 412px layout) */}
      <div className="w-full max-w-[420px] mx-auto flex-1 flex flex-col px-4 py-6">
        {/* Top Branding Navigation */}
        <header className="flex items-center justify-between pb-5 border-b border-white/10">
          <FarukatLogo size="sm" showText={true} />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#161616] border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-secondary)] uppercase">
              {t('profile.registry', undefined, 'REGISTRY')}
            </span>
          </div>
        </header>

        {/* Loading State with Minimal Spinner */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-16">
            <FarukatRotatingLoader message={t('profile.verifyingPass', undefined, 'Verifying pass authenticity')} size="sm" fullScreen={false} />
          </div>
        )}

        {/* Not Found State */}
        {!loading && !member && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-950/30 border border-red-500/30 flex items-center justify-center mb-4 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
              <SearchX className="w-8 h-8 text-red-400" />
            </div>

            <span className="text-[11px] font-mono tracking-widest uppercase text-red-400 font-bold mb-1">
              {t('profile.recordNotVerified', undefined, 'RECORD NOT VERIFIED')}
            </span>
            <h1 className="text-xl font-black tracking-tight text-white mb-2">
              {t('profile.passIdNotFound', undefined, 'Pass ID Not Found')}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-[320px] mb-6">
              {t('profile.passIdNotFoundDesc', { cardId }, `The card ID ${cardId} could not be verified in the FARUKAT digital pass registry. It may be inactive, private, or mistyped.`)}
            </p>

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleSignUpClick}
                className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-gradient-to-r from-[#fced9a] via-[#e2b14c] to-[#996b17] text-black font-black text-sm tracking-wider uppercase transition hover:brightness-110 active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(226,177,76,0.3)]"
              >
                <span>{t('profile.joinCinema', undefined, 'Join FARUKAT Cinema')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onGoToApp && (
                <button
                  type="button"
                  onClick={onGoToApp}
                  className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] text-[var(--text-secondary)] hover:text-white font-bold text-xs tracking-wider uppercase transition border border-white/10 cursor-pointer"
                >
                  {t('profile.returnToHub', undefined, 'Return to Cinema Hub')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Verified Pass Public Information */}
        {!loading && member && (
          <main className="flex-1 flex flex-col pt-5 pb-4">
            {/* 1. Core Trust Signal: Bold Verified Badge */}
            <div className="w-full p-4 rounded-2xl bg-gradient-to-b from-[#141d14] to-[#0c120c] border border-emerald-500/40 shadow-[0_10px_35px_rgba(16,185,129,0.15)] mb-4 flex flex-col items-center text-center relative overflow-hidden">
              {/* Subtle ambient light glow */}
              <div className="absolute -top-10 inset-x-0 h-20 bg-emerald-500/10 blur-2xl pointer-events-none" />

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-[11px] uppercase tracking-wider mb-2.5 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t('profile.verifiedActiveMember', undefined, 'Verified Active Member')}</span>
              </div>

              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-emerald-400/80 font-bold">
                {t('profile.officialDigitalPass', undefined, 'OFFICIAL FARUKAT DIGITAL PASS')}
              </span>

              {/* Pass ID Display & Copy Button */}
              <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-emerald-500/30">
                <span className="font-mono text-base font-black tracking-widest text-[#fced9a]">
                  {fullThemedCardNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Copy Pass ID"
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 2. Public Member Card (Card Theme & User QR Code Only) */}
            <div className="w-full rounded-2xl bg-[#111111] border border-white/10 p-5 mb-4 shadow-xl flex flex-col items-center gap-4">
              {/* Member Identity (Display Name & Avatar Only) */}
              <div className="w-full flex items-center gap-3 pb-3 border-b border-white/10">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-[#e2b14c]/40 shrink-0 bg-[#1a1a1a]">
                  <img
                    src={member.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-base font-black tracking-tight text-white truncate">
                    {member.name}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-secondary)] tracking-wider">
                    {t('profile.digitalPassholder', undefined, 'Digital Passholder')}
                  </span>
                </div>
              </div>

              {/* Card Theme Edition */}
              <div className="w-full p-3.5 rounded-xl bg-[#181818] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Palette className="w-4 h-4 text-[#e2b14c]" />
                  <span className="text-xs font-mono uppercase tracking-wider">{t('profile.cardThemeEdition', undefined, 'Card Theme Edition')}</span>
                </div>
                <span className={`text-sm font-black tracking-wide ${themeStyle.textGold}`}>
                  {themeLabel}
                </span>
              </div>

              {/* Verified Public Stats Grid (Latest Level, XP, Theme) */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                {/* Current Level */}
                <div className="p-3 rounded-xl bg-[#181818] border border-white/5 flex flex-col">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] mb-1">
                    <Award className="w-3.5 h-3.5 text-[#e2b14c]" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">{t('profile.level', undefined, 'Level')}</span>
                  </div>
                  <span className="text-lg font-black text-white tracking-tight">
                    {t('profile.level', undefined, 'Level')} {member.level}
                  </span>
                </div>

                {/* Total Lifetime XP */}
                <div className="p-3 rounded-xl bg-[#181818] border border-white/5 flex flex-col">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#e2b14c]" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">{t('profile.totalXp', undefined, 'Total XP')}</span>
                  </div>
                  <span className="text-lg font-black text-[#fced9a] tracking-tight">
                    {member.lifetimeXp.toLocaleString()} {t('profile.xp', undefined, 'XP')}
                  </span>
                </div>

                {/* Card Edition / Theme */}
                <div className="p-3 rounded-xl bg-[#181818] border border-white/5 flex flex-col col-span-2">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] mb-1">
                    <Palette className="w-3.5 h-3.5 text-[#e2b14c]" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">{t('profile.equippedEdition', undefined, 'Equipped Edition')}</span>
                  </div>
                  <span className={`text-sm font-black tracking-wide ${themeStyle.textGold}`}>
                    {themeLabel}
                  </span>
                </div>

                {/* Member Since Date */}
                <div className="p-3 rounded-xl bg-[#181818] border border-white/5 flex flex-col col-span-2">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#e2b14c]" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">{t('profile.memberSince', undefined, 'Member Since')}</span>
                  </div>
                  <span className="text-sm font-bold text-white tracking-wide">
                    {member.memberSince || '2026'}
                  </span>
                </div>
              </div>

              {/* User Own QR Code */}
              <div className="w-full flex flex-col items-center p-4 rounded-xl bg-black/60 border border-white/10 gap-3">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-secondary)] font-bold">
                  {t('profile.userVerificationQrCode', undefined, 'User Verification QR Code')}
                </span>
                <div className="p-3 bg-white rounded-xl shadow-md">
                  <QRCodeSVG
                    value={getVerificationUrl(fullThemedCardNumber)}
                    size={120}
                    level="H"
                    fgColor="#000000"
                    bgColor="#ffffff"
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--text-secondary)] tracking-wider text-center">
                  {t('profile.scanToVerifyPass', undefined, 'Scan to publicly verify this pass')}
                </span>
              </div>
            </div>

            {/* 3. Action / Referral Section */}
            {isLoggedIn ? (
              /* If visitor is already an authenticated member */
              <div className="w-full rounded-2xl bg-[#121212] border border-white/10 p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{t('profile.alreadyMember', undefined, 'Already a FARUKAT Member')}</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">{t('profile.activeSession', undefined, 'Active Session')}</span>
                </div>

                {onViewMemberProfile && (
                  <button
                    type="button"
                    onClick={() => onViewMemberProfile(member)}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#e2b14c] hover:brightness-110 text-black font-black text-xs uppercase tracking-wider transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{t('profile.viewPublicProfile', { name: member.name }, `View ${member.name}'s Public Profile`)}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {onGoToApp && (
                  <button
                    type="button"
                    onClick={onGoToApp}
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-[var(--text-secondary)] hover:text-white font-bold text-xs uppercase tracking-wider transition border border-white/5 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{t('profile.returnToHub', undefined, 'Return to Cinema Hub')}</span>
                  </button>
                )}
              </div>
            ) : (
              /* If visitor is a new non-user (Growth & Referral Funnel) */
              <div className="w-full rounded-2xl bg-gradient-to-b from-[#18150e] to-[#0f0e0a] border border-[#e2b14c]/40 p-5 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#e2b14c]/20 border border-[#e2b14c]/30 text-[#e2b14c]">
                    <Film className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black tracking-tight text-white uppercase">
                    {t('profile.joinJourneyTitle', undefined, 'Join FARUKAT and start your own journey')}
                  </h2>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t('profile.joinJourneyDesc', undefined, 'Stream premier cinema, unlock behind-the-scenes sagas, and mint your own authentic 3D digital pass.')}
                </p>

                {/* Referral Attribution Notice */}
                <div className="px-3 py-1.5 rounded-lg bg-black/50 border border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[var(--text-secondary)]">{t('profile.referredBy', undefined, 'Referred by:')}</span>
                  <span className="font-bold text-[#e2b14c]">{fullThemedCardNumber}</span>
                </div>

                {/* Signup Button with Referral Parameter */}
                <button
                  type="button"
                  onClick={handleSignUpClick}
                  className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-gradient-to-r from-[#fced9a] via-[#e2b14c] to-[#996b17] text-black font-black text-xs uppercase tracking-wider transition hover:brightness-110 active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(226,177,76,0.35)]"
                >
                  <span>{t('profile.signUpNow', undefined, 'Sign Up Now')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick Share Link Button */}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-secondary)] hover:text-white transition py-2 px-3 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">{t('profile.verificationLinkCopied', undefined, 'Verification link copied!')}</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t('profile.copyVerificationLink', undefined, 'Copy verification link')}</span>
                  </>
                )}
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
};
