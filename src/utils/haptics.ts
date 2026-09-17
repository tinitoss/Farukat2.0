import { XpAccount } from '../types';

export function triggerHaptic(account?: XpAccount | null, type: 'light' | 'medium' | 'heavy' = 'light') {
  if (!account?.stats?.enableHaptics) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (type) {
      case 'light':
        navigator.vibrate(20);
        break;
      case 'medium':
        navigator.vibrate(50);
        break;
      case 'heavy':
        navigator.vibrate([30, 50, 30]);
        break;
      default:
        navigator.vibrate(20);
    }
  }
}
