import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell } from 'lucide-react';

export const FcmToast: React.FC = () => {
  const [message, setMessage] = useState<{ title: string, body: string } | null>(null);

  useEffect(() => {
    const handleMessage = (e: any) => {
      const { title, body } = e.detail || {};
      if (title || body) {
        setMessage({ title: title || '', body: body || '' });
        setTimeout(() => setMessage(null), 4000);
      }
    };
    
    window.addEventListener('fcm-foreground-message', handleMessage);
    return () => window.removeEventListener('fcm-foreground-message', handleMessage);
  }, []);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-[var(--bg-card)] border border-[#e2b14c]/50 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)] shadow-[#e2b14c]/10 flex items-start gap-3 min-w-[280px] max-w-sm">
            <div className="w-8 h-8 rounded-full bg-[#e2b14c]/20 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-4 h-4 text-[#e2b14c]" />
            </div>
            <div>
              {message.title && <h4 className="text-sm font-bold text-white mb-0.5">{message.title}</h4>}
              {message.body && <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{message.body}</p>}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
