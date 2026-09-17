import React, { useState, useEffect, useRef, TouchEvent } from 'react';

export const ONBOARDING_KEY = 'hasSeenFarukatOnboarding';

interface OnboardingTutorialProps {
  onComplete?: () => void;
  onClose?: () => void;
  forceOpen?: boolean;
}

const GOLD_ACCENT = '#e2b14c';

/* --- SVG Illustrations (unDraw Style: Black & Gold with clean geometric shapes) --- */

const HomeIllustration: React.FC<{ accent?: string }> = ({ accent = GOLD_ACCENT }) => (
  <svg
    viewBox="0 0 360 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[220px] sm:max-h-[250px] object-contain select-none"
    aria-hidden="true"
  >
    {/* Base subtle shadow ground */}
    <ellipse cx="180" cy="224" rx="140" ry="10" fill="#141414" />

    {/* TV / Cinema Monitor Stand */}
    <path d="M152 195 L208 195 L218 220 L142 220 Z" fill="#1e1e1e" />
    <rect x="174" y="175" width="12" height="24" rx="3" fill="#2a2a2a" />

    {/* Main Cinema Display Frame */}
    <rect x="30" y="24" width="300" height="156" rx="12" fill="#181818" stroke="#2c2c2c" strokeWidth="2" />

    {/* Inner Screen Area */}
    <rect x="36" y="30" width="288" height="144" rx="8" fill="#0d0d0d" />

    {/* Screen Top App Bar */}
    <rect x="46" y="38" width="40" height="6" rx="3" fill={accent} />
    <circle cx="294" cy="41" r="3" fill="#3a3a3a" />
    <circle cx="304" cy="41" r="3" fill="#3a3a3a" />
    <circle cx="314" cy="41" r="3" fill="#3a3a3a" />

    {/* Main Featured Banner on Screen */}
    <rect x="46" y="52" width="268" height="64" rx="6" fill="#161616" stroke="#242424" strokeWidth="1" />
    <path d="M46 96 Q120 75 180 88 T314 74 L314 116 L46 116 Z" fill="#202020" />
    <path d="M46 102 Q140 82 220 94 T314 86 L314 116 L46 116 Z" fill="#252525" opacity="0.6" />

    {/* Play Button Symbol on Featured Banner */}
    <circle cx="180" cy="84" r="16" fill={accent} />
    <polygon points="176,76 188,84 176,92" fill="#0d0d0d" />

    {/* Media Thumbnail Row (Home Feed Cards) */}
    <rect x="46" y="124" width="58" height="38" rx="4" fill="#1c1c1c" stroke="#2b2b2b" strokeWidth="1" />
    <rect x="52" y="148" width="32" height="4" rx="2" fill="#444444" />
    <rect x="52" y="154" width="20" height="3" rx="1.5" fill="#333333" />

    <rect x="111" y="124" width="58" height="38" rx="4" fill="#1c1c1c" stroke={accent} strokeWidth="1.5" />
    <rect x="117" y="148" width="34" height="4" rx="2" fill={accent} />
    <rect x="117" y="154" width="22" height="3" rx="1.5" fill="#444444" />

    <rect x="176" y="124" width="58" height="38" rx="4" fill="#1c1c1c" stroke="#2b2b2b" strokeWidth="1" />
    <rect x="182" y="148" width="30" height="4" rx="2" fill="#444444" />
    <rect x="182" y="154" width="18" height="3" rx="1.5" fill="#333333" />

    <rect x="241" y="124" width="73" height="38" rx="4" fill="#1c1c1c" stroke="#2b2b2b" strokeWidth="1" />
    <rect x="247" y="148" width="36" height="4" rx="2" fill="#444444" />
    <rect x="247" y="154" width="24" height="3" rx="1.5" fill="#333333" />

    {/* Floating Subtle Ambient Decorative Badges */}
    <circle cx="38" cy="20" r="3" fill={accent} opacity="0.8" />
    <circle cx="320" cy="18" r="2.5" fill="#ffffff" opacity="0.4" />
  </svg>
);

const SearchIllustration: React.FC<{ accent?: string }> = ({ accent = GOLD_ACCENT }) => (
  <svg
    viewBox="0 0 360 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[220px] sm:max-h-[250px] object-contain select-none"
    aria-hidden="true"
  >
    {/* Base shadow */}
    <ellipse cx="180" cy="224" rx="130" ry="10" fill="#141414" />

    {/* Top Search Input Box */}
    <rect x="52" y="24" width="256" height="44" rx="22" fill="#171717" stroke="#2c2c2c" strokeWidth="2" />
    <circle cx="76" cy="46" r="7" stroke={accent} strokeWidth="2.5" />
    <line x1="81" y1="51" x2="89" y2="59" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
    <rect x="98" y="43" width="76" height="6" rx="3" fill="#666666" />
    <line x1="178" y1="39" x2="178" y2="53" stroke={accent} strokeWidth="2" strokeLinecap="round" />

    {/* Background Catalog Card 1 (Left Behind) */}
    <g opacity="0.6">
      <rect x="36" y="92" width="86" height="106" rx="8" fill="#151515" stroke="#292929" strokeWidth="1.5" />
      <rect x="46" y="104" width="66" height="48" rx="4" fill="#202020" />
      <rect x="46" y="162" width="48" height="5" rx="2.5" fill="#444444" />
      <rect x="46" y="172" width="32" height="4" rx="2" fill="#333333" />
    </g>

    {/* Background Catalog Card 2 (Right Behind) */}
    <g opacity="0.6">
      <rect x="238" y="92" width="86" height="106" rx="8" fill="#151515" stroke="#292929" strokeWidth="1.5" />
      <rect x="248" y="104" width="66" height="48" rx="4" fill="#202020" />
      <rect x="248" y="162" width="52" height="5" rx="2.5" fill="#444444" />
      <rect x="248" y="172" width="34" height="4" rx="2" fill="#333333" />
    </g>

    {/* Central Target Search Result Card */}
    <rect x="122" y="80" width="116" height="128" rx="10" fill="#1b1b1b" stroke="#333333" strokeWidth="2" />
    <rect x="132" y="90" width="96" height="64" rx="6" fill="#262626" />
    <circle cx="180" cy="122" r="14" fill="#171717" stroke={accent} strokeWidth="1.5" />
    <polygon points="177,116 186,122 177,128" fill={accent} />
    <rect x="132" y="164" width="76" height="6" rx="3" fill="#ffffff" />
    <rect x="132" y="176" width="46" height="5" rx="2.5" fill={accent} />
    <rect x="132" y="186" width="60" height="4" rx="2" fill="#525252" />

    {/* Dynamic Magnifying Glass Overlay */}
    <g transform="translate(192, 118)">
      {/* Handle */}
      <line x1="38" y1="38" x2="68" y2="68" stroke="#1f1f1f" strokeWidth="10" strokeLinecap="round" />
      <line x1="38" y1="38" x2="68" y2="68" stroke="#383838" strokeWidth="6" strokeLinecap="round" />
      <line x1="58" y1="58" x2="66" y2="66" stroke={accent} strokeWidth="6" strokeLinecap="round" />

      {/* Glass Ring */}
      <circle cx="16" cy="16" r="32" fill="#000000" fillOpacity="0.4" stroke={accent} strokeWidth="5" />
      {/* Glint on glass */}
      <path d="M-6 -6 Q16 -18 34 -6" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </g>

    {/* Subtle Star/Spark Elements */}
    <circle cx="48" cy="74" r="2" fill={accent} />
    <circle cx="312" cy="78" r="2.5" fill="#ffffff" opacity="0.5" />
  </svg>
);

const ProfileIllustration: React.FC<{ accent?: string }> = ({ accent = GOLD_ACCENT }) => (
  <svg
    viewBox="0 0 360 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[220px] sm:max-h-[250px] object-contain select-none"
    aria-hidden="true"
  >
    {/* Base shadow */}
    <ellipse cx="180" cy="224" rx="125" ry="10" fill="#141414" />

    {/* Studio Passport / Membership Card Container */}
    <rect
      x="75"
      y="32"
      width="210"
      height="164"
      rx="16"
      fill="#171717"
      stroke="#2c2c2c"
      strokeWidth="2"
    />

    {/* Top Gold Foil Accent Header on Card */}
    <path
      d="M75 48 C75 39.16 82.16 32 91 32 L269 32 C277.84 32 285 39.16 285 48 L285 58 L75 58 Z"
      fill={accent}
    />
    <rect x="91" y="41" width="56" height="6" rx="3" fill="#0d0d0d" />
    <circle cx="265" cy="45" r="4" fill="#0d0d0d" />

    {/* Member Avatar Profile Circle */}
    <circle cx="117" cy="98" r="24" fill="#242424" stroke="#383838" strokeWidth="2" />
    {/* Avatar Silhouette */}
    <circle cx="117" cy="92" r="9" fill={accent} />
    <path d="M102 114 C102 106 109 104 117 104 C125 104 132 106 132 114 Z" fill={accent} />

    {/* Passport Identity Lines */}
    <rect x="153" y="80" width="76" height="7" rx="3.5" fill="#ffffff" />
    <rect x="153" y="93" width="54" height="5" rx="2.5" fill="#737373" />
    <rect x="153" y="104" width="42" height="4" rx="2" fill="#444444" />

    {/* Level Badge in Gold */}
    <rect x="238" y="78" width="36" height="18" rx="9" fill={accent} />
    <rect x="245" y="84" width="22" height="6" rx="2" fill="#0d0d0d" />

    {/* Divider Hairline */}
    <line x1="91" y1="130" x2="269" y2="130" stroke="#282828" strokeWidth="1" />

    {/* XP Progress Section */}
    <rect x="91" y="142" width="38" height="5" rx="2.5" fill="#737373" />
    <rect x="241" y="142" width="28" height="5" rx="2.5" fill={accent} />

    {/* XP Progress Bar (70% full) */}
    <rect x="91" y="154" width="178" height="8" rx="4" fill="#222222" />
    <rect x="91" y="154" width="128" height="8" rx="4" fill={accent} />

    {/* Verification Star / Studio Seal */}
    <circle cx="103" cy="178" r="6" fill="#242424" stroke={accent} strokeWidth="1" />
    <circle cx="121" cy="178" r="6" fill="#242424" stroke="#444444" strokeWidth="1" />
    <circle cx="139" cy="178" r="6" fill="#242424" stroke="#444444" strokeWidth="1" />
    <rect x="211" y="174" width="58" height="8" rx="4" fill="#222222" />

    {/* Floating Passport Accents */}
    <circle cx="56" cy="70" r="3" fill={accent} opacity="0.6" />
    <circle cx="304" cy="130" r="2" fill="#ffffff" opacity="0.4" />
  </svg>
);

const SettingsIllustration: React.FC<{ accent?: string }> = ({ accent = GOLD_ACCENT }) => (
  <svg
    viewBox="0 0 360 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[220px] sm:max-h-[250px] object-contain select-none"
    aria-hidden="true"
  >
    {/* Base shadow */}
    <ellipse cx="180" cy="224" rx="130" ry="10" fill="#141414" />

    {/* Settings Wizard Card */}
    <rect
      x="60"
      y="30"
      width="240"
      height="170"
      rx="16"
      fill="#161616"
      stroke="#2c2c2c"
      strokeWidth="2"
    />

    {/* Header bar */}
    <rect x="78" y="44" width="70" height="7" rx="3.5" fill="#ffffff" />
    <circle cx="266" cy="47" r="5" fill="#262626" stroke={accent} strokeWidth="1.5" />

    {/* Setting Row 1: Audio / Playback Slider */}
    <rect x="78" y="70" width="60" height="5" rx="2.5" fill="#737373" />
    {/* Slider Track */}
    <rect x="78" y="82" width="204" height="6" rx="3" fill="#262626" />
    <rect x="78" y="82" width="138" height="6" rx="3" fill={accent} />
    {/* Slider Knob */}
    <circle cx="216" cy="85" r="9" fill={accent} stroke="#0d0d0d" strokeWidth="2" />

    {/* Setting Row 2: Privacy Toggle (Active ON) */}
    <rect x="78" y="112" width="80" height="5" rx="2.5" fill="#737373" />
    <rect x="78" y="122" width="54" height="4" rx="2" fill="#444444" />
    {/* Active Toggle Pill */}
    <rect x="238" y="110" width="44" height="22" rx="11" fill={accent} />
    <circle cx="268" cy="121" r="8" fill="#0d0d0d" />

    {/* Setting Row 3: Accessibility Switch (Default) */}
    <rect x="78" y="150" width="92" height="5" rx="2.5" fill="#737373" />
    <rect x="78" y="160" width="64" height="4" rx="2" fill="#444444" />
    {/* Inactive Toggle Pill */}
    <rect x="238" y="148" width="44" height="22" rx="11" fill="#262626" />
    <circle cx="250" cy="159" r="8" fill="#737373" />

    {/* Subtle Gear Elements in Background */}
    <g transform="translate(30, 90)" opacity="0.3">
      <circle cx="0" cy="0" r="16" stroke="#444444" strokeWidth="3" strokeDasharray="6 4" />
      <circle cx="0" cy="0" r="8" fill="#444444" />
    </g>

    <g transform="translate(325, 65)" opacity="0.4">
      <circle cx="0" cy="0" r="14" stroke={accent} strokeWidth="3" strokeDasharray="5 3" />
      <circle cx="0" cy="0" r="6" fill={accent} />
    </g>
  </svg>
);

/* --- Slide Definitions --- */

interface SlideItem {
  id: number;
  headline: string;
  body: string;
  Illustration: React.FC<{ accent?: string }>;
}

const SLIDES: SlideItem[] = [
  {
    id: 1,
    headline: 'Everything in One Place',
    body: 'Browse all movies, series, and originals from your Home feed.',
    Illustration: HomeIllustration,
  },
  {
    id: 2,
    headline: 'Find Anything, Fast',
    body: 'Search across every project \u2014 movies, series, and studios \u2014 in seconds.',
    Illustration: SearchIllustration,
  },
  {
    id: 3,
    headline: 'Your Studio Passport',
    body: 'Track your XP, level up, see your watch history, and hold your membership card.',
    Illustration: ProfileIllustration,
  },
  {
    id: 4,
    headline: 'Make It Yours',
    body: 'Fine-tune privacy, playback, and accessibility \u2014 right from your Profile.',
    Illustration: SettingsIllustration,
  },
];

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  onComplete,
  onClose,
  forceOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  // Touch Swipe tracking
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setCurrentSlide(0);
      return;
    }
    const hasSeen = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeen) {
      setIsOpen(true);
      setCurrentSlide(0);
    }
  }, [forceOpen]);

  // Keyboard navigation for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentSlide((prev) => Math.min(prev + 1, SLIDES.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
    if (onClose) onClose();
    if (onComplete) onComplete();
  };

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const swipeThreshold = 45;

    if (diff > swipeThreshold) {
      // Swiped Left -> Next Slide
      if (currentSlide < SLIDES.length - 1) {
        setCurrentSlide((prev) => prev + 1);
      }
    } else if (diff < -swipeThreshold) {
      // Swiped Right -> Previous Slide
      if (currentSlide > 0) {
        setCurrentSlide((prev) => prev - 1);
      }
    }
  };

  if (!isOpen) return null;

  const isLastSlide = currentSlide === SLIDES.length - 1;

  return (
    <div
      id="onboarding-tutorial-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome and Tutorial Flow"
      className="fixed inset-0 z-[100] bg-[#0A0A0A] text-[#e5e5e5] flex flex-col justify-between select-none overflow-hidden"
    >
      {/* Top Bar: Skip link (reachable on every slide) */}
      <header className="w-full flex items-center justify-between px-6 pt-5 pb-2 z-30">
        <div className="w-12" aria-hidden="true" /> {/* Spacer balance */}

        <button
          id="onboarding-skip-btn"
          onClick={handleDismiss}
          className="px-3 py-2 -mr-3 text-sm font-medium text-neutral-400 hover:text-[#e2b14c] active:text-[#e2b14c] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center tracking-wide"
          title="Skip tutorial and enter app"
        >
          Skip
        </button>
      </header>

      {/* Main Centered Content Carousel */}
      <main
        className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="w-full flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {SLIDES.map((slide) => {
            const SlideIllustration = slide.Illustration;
            return (
              <div
                key={slide.id}
                className="w-full min-w-full flex flex-col items-center justify-center px-6 py-4"
              >
                {/* 1. Illustration (moderate size ~40% screen height with breathing room) */}
                <div className="w-full max-w-[320px] h-[210px] sm:h-[240px] flex items-center justify-center">
                  <SlideIllustration accent={GOLD_ACCENT} />
                </div>

                {/* 2. Headline (bold, white, consistent vertical rhythm) */}
                <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white text-center mt-6 sm:mt-8">
                  {slide.headline}
                </h2>

                {/* 3. Body copy (one sentence, muted gray, max ~2 lines) */}
                <p className="text-sm text-neutral-400 font-normal leading-relaxed text-center max-w-[280px] sm:max-w-xs mt-2.5 sm:mt-3">
                  {slide.body}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* Fixed Bottom Bar: Connected Line Progress Track on left, Next pill on right */}
      <footer className="w-full max-w-md mx-auto px-6 py-5 sm:py-6 flex items-center justify-between z-30 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Connected Line Stepper: thin track with filled gold progress segment and overlaid dots */}
        <div
          className="relative flex items-center w-36 sm:w-40 h-10"
          role="progressbar"
          aria-label="Tutorial Setup Progress"
          aria-valuenow={currentSlide + 1}
          aria-valuemin={1}
          aria-valuemax={SLIDES.length}
        >
          {/* Thin Background Track */}
          <div className="absolute left-3.5 right-3.5 top-1/2 -translate-y-1/2 h-[2px] bg-neutral-800 rounded-full overflow-hidden">
            {/* Filled Progress Segment in Gold Accent */}
            <div
              className="h-full bg-[#e2b14c] transition-all duration-300 ease-out rounded-full"
              style={{
                width: `${(currentSlide / (SLIDES.length - 1)) * 100}%`,
              }}
            />
          </div>

          {/* Step Dots Overlaid Directly on Top of Track */}
          <div className="relative w-full flex items-center justify-between z-10">
            {SLIDES.map((_, idx) => {
              const isPassed = idx < currentSlide;
              const isActive = idx === currentSlide;

              return (
                <button
                  key={idx}
                  id={`onboarding-dot-${idx + 1}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Go to slide ${idx + 1}`}
                  onClick={() => setCurrentSlide(idx)}
                  className="group relative flex items-center justify-center w-7 h-10 cursor-pointer focus:outline-none min-h-[40px]"
                >
                  {/* Formal Node Indicator with dark cutout ring */}
                  <span
                    className={`rounded-full transition-all duration-300 flex items-center justify-center ${
                      isActive
                        ? 'w-3.5 h-3.5 bg-[#e2b14c] ring-4 ring-[#0A0A0A] shadow-[0_0_8px_rgba(226,177,76,0.5)]'
                        : isPassed
                        ? 'w-2.5 h-2.5 bg-[#e2b14c] ring-4 ring-[#0A0A0A]'
                        : 'w-2 h-2 bg-[#171717] border border-neutral-600 ring-4 ring-[#0A0A0A] group-hover:border-neutral-400'
                    }`}
                  >
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button: "Next" or "Let's Go" pill in gold accent with black text */}
        <button
          id={isLastSlide ? 'onboarding-letsgo-btn' : 'onboarding-next-btn'}
          onClick={handleNext}
          className="bg-[#e2b14c] hover:bg-[#d4a23b] active:scale-95 text-black font-semibold text-sm px-6 py-2.5 rounded-full transition-all duration-150 min-h-[44px] flex items-center justify-center shadow-md cursor-pointer tracking-wide"
        >
          {isLastSlide ? "Let's Go" : 'Next'}
        </button>
      </footer>
    </div>
  );
};
