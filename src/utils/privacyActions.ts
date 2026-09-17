import { XpAccount, WatchProgress } from '../types';
import { auth } from '../firebase';
import { deleteUser as deleteFirebaseAuthUser } from 'firebase/auth';

export async function exportUserData(account: XpAccount, history: WatchProgress[], favorites: string[], likes: string[]): Promise<void> {
  const exportData = {
    exportDate: new Date().toISOString(),
    platform: "Farukat",
    operator: "Prizren, Kosovo",
    contact: "babajem16@gmail.com",
    account: {
      memberId: account.profile?.memberId,
      name: account.profile?.name,
      email: account.profile?.email || auth.currentUser?.email || "guest",
      memberSince: account.profile?.memberSince,
      lifetimeXp: account.lifetimeXp,
      currentLevel: account.currentLevel,
      stats: account.stats,
      profile: account.profile,
    },
    watchHistory: history.map(h => ({
      mediaId: h.mediaId,
      episodeId: h.episodeId,
      currentTime: h.currentTime,
      duration: h.duration,
      completed: h.completed,
      lastWatchedAt: new Date(h.lastWatchedAt).toISOString(),
    })),
    favorites: favorites,
    likes: likes,
    savedAt: new Date().toISOString()
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `farukat_data_export_${account.profile?.memberId || 'user'}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export async function deleteUserAccount(): Promise<boolean> {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await deleteFirebaseAuthUser(currentUser);
    }
    // Clear local storage and session state
    localStorage.removeItem('farukat_xp_account_v2');
    localStorage.removeItem('farukat_watch_history_v1');
    localStorage.removeItem('farukat_favorites_v1');
    localStorage.removeItem('farukat_likes_v1');
    localStorage.removeItem('farukat_admin_session');
    return true;
  } catch (err) {
    console.error("Failed to delete account:", err);
    throw err;
  }
}
