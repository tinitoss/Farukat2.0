import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  signInAnonymously,
} from '../firebase';
import { AVATAR_LIBRARY } from '../data/avatarLibrary';
import { authenticateUser } from '../utils/accountAuth';
import { syncFirebaseUserToAccount } from '../utils/memberSystem';
import { setAdminSession, isAdminEmail } from '../utils/mediaCatalogStore';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { TermsOfServiceModal } from './TermsOfServiceModal';

interface AuthScreenProps {
  onAuthSuccess: (user: any, account?: any) => void;
  initialMode?: 'signin' | 'register' | 'forgot';
  initialRef?: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  initialMode,
  initialRef,
}) => {
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>(initialMode || 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Modals for Terms & Privacy
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  // Referral capture state
  const [referralCode] = useState<string>(() => {
    if (initialRef) return initialRef;
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const refParam = params.get('ref');
        if (refParam) return refParam.trim();
        return localStorage.getItem('farukat_referral_ref') || '';
      }
    } catch {}
    return '';
  });

  // Avatar Selection State
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_LIBRARY[0].url);
  const [showAvatarPicker, setShowAvatarPicker] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    
    const lastSent = localStorage.getItem(`farukat_verification_sent_${unverifiedUser.email}`);
    if (lastSent && Date.now() - parseInt(lastSent) < 60000) {
      setError('Please wait a minute before requesting another verification email.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user found.");
      }
      await user.reload();
      if (!user.emailVerified) {
        setUnverifiedUser(user);
        setError('Please verify your email address before signing in.');
        setLoading(false);
        return;
      }

      const token = await user.getIdToken(true);
      const response = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to resend verification email.');
      
      localStorage.setItem(`farukat_verification_sent_${user.email}`, Date.now().toString());
      setSuccessMsg('Verification email resent! Please check your inbox.');
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!unverifiedUser) return;
    setLoading(true);
    try {
      await unverifiedUser.reload();
      if (unverifiedUser.emailVerified) {
        setSuccessMsg('Email verified! You can now sign in.');
        setUnverifiedUser(null);
        setError(null);
      } else {
        setError('Email still not verified. Please check your inbox and click the verification link.');
      }
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setUnverifiedUser(null);
    setError(null);
    setSuccessMsg(null);
    setMode('signin');
  };

  const formatError = (err: any): string => {
    const code = err?.code || '';
    const msg = err?.message || String(err);

    if (code === 'auth/email-already-in-use' || msg.includes('auth/email-already-in-use')) {
      return 'This email address is already registered. Please sign in instead.';
    }
    if (code === 'auth/weak-password' || msg.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (code === 'auth/invalid-email' || msg.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password' ||
      msg.includes('auth/invalid-credential') ||
      msg.includes('auth/user-not-found')
    ) {
      return 'Invalid email or password.';
    }
    if (code === 'auth/popup-closed-by-user' || msg.includes('auth/popup-closed-by-user')) {
      return 'Sign-in window was closed before completion. Please try again.';
    }
    if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
      return 'This app domain is not yet authorized in Firebase Console -> Auth -> Settings -> Authorized domains.';
    }
    if (code === 'auth/too-many-requests' || msg.includes('auth/too-many-requests')) {
      return 'Too many failed attempts. Please wait a moment and try again.';
    }
    return 'Authentication error: ' + msg.replace('Firebase: ', '');
  };

  // Backend Authentication Handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter your email and password.');
      return;
    }

    // Check if user is logging in with designated admin email
    if (isAdminEmail(cleanEmail)) {
      setAdminSession(true);
      const adminAccount = {
        profile: {
          name: 'Altin Berisha (Admin)',
          memberId: 'admin-001',
          tierName: 'EXECUTIVE ADMIN',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        },
        lifetimeXp: 99999,
      };
      onAuthSuccess(
        {
          uid: 'admin-master',
          displayName: 'Altin Berisha (Admin)',
          email: 'altinberisha434@gmail.com',
          isAdmin: true,
        },
        adminAccount
      );
      return;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (cleanPassword.length < 6) {
        setError('Password should be at least 6 characters.');
        return;
      }
      if (cleanPassword !== confirmPassword.trim()) {
        setError('Passwords do not match.');
        return;
      }
      if (!agreeTerms) {
        setError('Please agree to the Terms of Service and Privacy Policy.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await authenticateUser(
        mode as 'signin' | 'register',
        cleanEmail,
        cleanPassword,
        displayName.trim(),
        selectedAvatar
      );

      if (mode === 'register') {
        if (referralCode) {
          try {
            localStorage.setItem('farukat_referral_applied', referralCode);
            console.log(`[Referral Engine] New member registration attributed to referrer pass: ${referralCode}`);
          } catch {}
        }

        try {
          const user = auth.currentUser;
          if (!user) throw new Error("No user found");
          
          const token = await user.getIdToken(true);
          await fetch('/api/auth/send-verification-email', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          setSuccessMsg('Account created successfully! Please verify your email before signing in.');
        } catch (e) {
          console.error('Failed to send verification email', e);
          setError('Account created, but verification email failed to send. Try logging in and requesting a resend.');
        }
        
        setMode('signin');
      } else {
        if (!result.user.emailVerified) {
          setUnverifiedUser(result.user);
          setError('Please verify your email address before signing in.');
          setLoading(false);
          return;
        }
        onAuthSuccess(result.user, result.account);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email to reset your password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMsg('Password reset email sent. Please check your inbox.');
      setTimeout(() => {
        setMode('signin');
      }, 1500);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);

      const credential = GoogleAuthProvider.credentialFromResult(res);
      if (credential && credential.accessToken) {
        localStorage.setItem('farukat_google_token', credential.accessToken);
      }

      const syncedAccount = await syncFirebaseUserToAccount(res.user);
      onAuthSuccess(res.user, syncedAccount);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInAnonymously(auth);
      onAuthSuccess(userCredential.user);
    } catch (err: any) {
      console.warn('Anonymous auth failed, falling back to local guest:', err);
      onAuthSuccess({ uid: 'guest', isGuest: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col items-center justify-center p-4 relative overflow-x-hidden select-none">
      {/* Subtle Cinematic Ambient Vignette & Warm Gold Radial Aura */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] h-[340px] bg-[var(--accent-gold)]/[0.04] rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(226,177,76,0.03),transparent_70%)]" />
      </div>

      {/* Main Authentication Card Container (Mobile-first, 375-412px target) */}
      <div className="relative z-10 w-full max-w-[390px] my-auto">
        <div className="relative bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/80 overflow-hidden">
          {/* Subtle Top Radial Glow inside Card */}
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-48 h-48 bg-[var(--accent-gold)]/[0.07] rounded-full blur-3xl pointer-events-none" />

          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-5 relative z-10">
            {/* Cinema OS Logo */}
            <div className="relative mb-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative overflow-hidden">
                <img
                  src="https://i.postimg.cc/kgY1tn7h/Picsart-26-09-09-16-12-49-057.png"
                  alt="Cinema OS Logo"
                  className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(226,177,76,0.25)]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Dynamic Headings & Subtitles */}
            {mode === 'signin' && (
              <>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-sans">
                  Welcome back
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1 tracking-normal">
                  Your next production starts here.
                </p>
              </>
            )}

            {mode === 'register' && (
              <>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-sans">
                  Create your account
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1 tracking-normal">
                  Build your career. Make your films.
                </p>
              </>
            )}

            {mode === 'forgot' && (
              <>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-sans">
                  Reset password
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1 tracking-normal">
                  Enter your email to receive reset instructions.
                </p>
              </>
            )}
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex flex-col gap-2 animate-fadeIn">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
              {unverifiedUser && error.includes('verify') && (
                 <div className="flex flex-col gap-2">
                   <button
                     type="button"
                     onClick={handleRefreshStatus}
                     className="w-full py-2 bg-emerald-900/50 hover:bg-emerald-900/70 rounded-lg text-emerald-100 font-semibold text-xs transition cursor-pointer"
                   >
                     Refresh Status
                   </button>
                   <button
                     type="button"
                     onClick={handleResendVerification}
                     className="w-full py-2 bg-red-900/50 hover:bg-red-900/70 rounded-lg text-red-100 font-semibold text-xs transition cursor-pointer"
                   >
                     Resend Verification Email
                   </button>
                   <button
                     type="button"
                     onClick={handleSignOut}
                     className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-200 font-semibold text-xs transition cursor-pointer"
                   >
                     Sign Out
                   </button>
                 </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-snug">{successMsg}</span>
            </div>
          )}

          {/* Segmented Switcher: SIGN IN / SIGN UP (Hidden in forgot mode) */}
          {mode !== 'forgot' && (
            <div className="h-[44px] p-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl flex items-center mb-5 relative">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`flex-1 h-full rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-[var(--accent-gold)] text-[var(--text-on-accent)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 h-full rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[var(--accent-gold)] text-[var(--text-on-accent)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Main Auth Form */}
          {(mode === 'signin' || mode === 'register') && (
            <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
              {/* Referral code attribution banner if registered via invite */}
              {mode === 'register' && referralCode && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/30 text-[var(--accent-gold)] text-xs font-mono">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-[var(--accent-gold)]" />
                  <span className="truncate">
                    Referred by pass: <strong className="text-white font-bold">{referralCode}</strong>
                  </span>
                </div>
              )}

              {/* Full Name (Sign Up only) */}
              {mode === 'register' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full h-[48px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-gold)] focus:outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
                  />
                </div>
              )}

              {/* Email Field */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full h-[48px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-gold)] focus:outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
                />
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-[48px] pl-3.5 pr-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-gold)] focus:outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === 'signin' && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                      }}
                      className="text-xs font-medium text-[var(--accent-gold)] hover:underline cursor-pointer transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              {/* Confirm Password (Sign Up only) */}
              {mode === 'register' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full h-[48px] pl-3.5 pr-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-gold)] focus:outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Avatar Selector (Sign Up only - keeps studio persona) */}
              {mode === 'register' && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Director Avatar
                  </label>
                  <div className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={selectedAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                        alt="Selected Avatar"
                        className="w-9 h-9 rounded-full object-cover border border-[var(--accent-gold)] bg-[var(--bg-base)]"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[130px]">
                        {AVATAR_LIBRARY.find((a) => a.url === selectedAvatar)?.name || 'Director'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:brightness-110 border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-gold)] flex items-center gap-1 cursor-pointer transition"
                    >
                      <span>{showAvatarPicker ? 'Done' : 'Change'}</span>
                      {showAvatarPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {showAvatarPicker && (
                    <div className="p-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] grid grid-cols-4 gap-2 max-h-40 overflow-y-auto mt-1">
                      {AVATAR_LIBRARY.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => {
                            setSelectedAvatar(avatar.url);
                          }}
                          className={`p-1 rounded-xl border transition cursor-pointer ${
                            selectedAvatar === avatar.url
                              ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                              : 'border-[var(--border-subtle)] hover:border-white/20'
                          }`}
                        >
                          <img
                            src={avatar.url}
                            alt={avatar.name}
                            className="w-8 h-8 rounded-full object-cover mx-auto"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Terms & Privacy Agreement (Sign Up only) */}
              {mode === 'register' && (
                <div className="flex items-start gap-2.5 pt-1.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={agreeTerms}
                    aria-label="I agree to the Terms of Service and Privacy Policy"
                    onClick={() => setAgreeTerms(!agreeTerms)}
                    className={`w-5 h-5 min-w-[20px] rounded-md border flex items-center justify-center transition-all cursor-pointer mt-0.5 ${
                      agreeTerms
                        ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)] text-[var(--text-on-accent)]'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-white/30'
                    }`}
                  >
                    {agreeTerms && <Check className="w-3.5 h-3.5 stroke-[3] text-black" />}
                  </button>
                  <span className="text-[11px] leading-snug text-[var(--text-secondary)]">
                    I confirm I am at least 13 years old and agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModalType('terms')}
                      className="text-[var(--accent-gold)] hover:underline font-semibold cursor-pointer"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModalType('privacy')}
                      className="text-[var(--accent-gold)] hover:underline font-semibold cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                  </span>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading || (mode === 'register' && !agreeTerms)}
                className={`mt-2 w-full h-[52px] rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 ${
                  mode === 'register' && !agreeTerms
                    ? 'bg-[var(--accent-gold-dim)] text-black/60 opacity-50 cursor-not-allowed'
                    : 'bg-[var(--accent-gold)] text-[var(--text-on-accent)] hover:brightness-105 active:scale-[0.98] shadow-lg shadow-[var(--accent-gold)]/20 cursor-pointer'
                }`}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                  </div>
                ) : (
                  <span>{mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
                )}
              </button>
            </form>
          )}

          {/* Secondary Auth Options (Google & Guest) */}
          {(mode === 'signin' || mode === 'register') && (
            <>
              {/* Divider: ────────── or ────────── */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[var(--divider-hairline)]" />
                <span className="text-[11px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-[var(--divider-hairline)]" />
              </div>

              {/* Authentic Google Login Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-[44px] rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer shadow-sm disabled:opacity-50"
              >
                {/* Official Google Multicolor G SVG */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              {/* Guest Mode Button (Secondary subtle button under Google) */}
              <button
                type="button"
                onClick={handleGuestSignIn}
                disabled={loading}
                className="w-full h-[40px] flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>Continue as Guest</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Forgot Password View */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full h-[48px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-gold)] focus:outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full h-[52px] rounded-xl bg-[var(--accent-gold)] text-[var(--text-on-accent)] font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-[0.98] shadow-lg shadow-[var(--accent-gold)]/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="w-full h-[40px] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>

        {/* Minimal Subtle Studio Sub-footer */}
        <div className="mt-4 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-disabled)]">
            Cinema OS • Movie Production Simulation
          </p>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={legalModalType === 'privacy'}
        onClose={() => setLegalModalType(null)}
      />

      {/* Terms of Service Modal */}
      <TermsOfServiceModal
        isOpen={legalModalType === 'terms'}
        onClose={() => setLegalModalType(null)}
      />
    </div>
  );
};
