const fs = require('fs');
const content = fs.readFileSync('src/components/AppPreferencesPage.tsx', 'utf8');
const searchStr = `  return (
    <div className="w-full max-w-lg mx-auto text-[var(--text-primary)] space-y-6 pb-8">
      {/* Header Title (Clean, no version badge) */}
      <div className="flex items-center gap-3 border-b border-[var(--glass-light)] pb-4">`;
const replaceStr = `  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-background)] flex flex-col animate-fadeIn">
      {/* Absolute Back Button Top Left */}
      <div className="absolute top-[env(safe-area-inset-top,0px)] left-0 p-4 z-50">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 active:scale-95 transition"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] pb-8 w-full max-w-lg mx-auto text-[var(--text-primary)] space-y-6">
      {/* Header Title (Clean, no version badge) */}
      <div className="flex items-center gap-3 border-b border-[var(--glass-light)] pb-4">`;

if (content.includes(searchStr)) {
  fs.writeFileSync('src/components/AppPreferencesPage.tsx', content.replace(searchStr, replaceStr));
  console.log('Patched top successfully');
} else {
  console.log('Search string not found');
}
