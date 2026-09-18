import { auth } from '../firebase';
import {
  getTursoLikes,
  toggleTursoLike,
  getTursoUserLikes,
  getTursoComments,
  addTursoComment,
  deleteTursoComment,
  toggleTursoCommentLike,
  getTursoCommentLikes
} from './tursoClient';

export interface SheetDbComment {
  commentId: string;
  contentId: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  parentCommentId?: string | null;
  createdAt: string;
  isPro?: boolean;
  likesCount: number;
  userLiked: boolean;
}

// In-memory cache to ensure snappy performance
const likesCountCache = new Map<string, { count: number; timestamp: number; userLiked?: boolean }>();
const commentsCache = new Map<string, { comments: SheetDbComment[]; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 seconds

export function clearSocialCache(): void {
  likesCountCache.clear();
  commentsCache.clear();
}

/**
 * Fetch all likes for a content item from Turso with local memory cache
 */
export async function fetchLikesForContent(contentId: string, currentUserId?: string): Promise<{ likesCount: number; userLiked: boolean }> {
  try {
    const cached = likesCountCache.get(contentId);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return { likesCount: cached.count, userLiked: !!cached.userLiked };
    }

    const data = await getTursoLikes(contentId, currentUserId || auth.currentUser?.uid);
    const likesCount = data.likesCount || 0;
    const userLiked = !!data.userLiked;

    likesCountCache.set(contentId, { count: likesCount, userLiked, timestamp: now });
    return { likesCount, userLiked };
  } catch (err) {
    console.warn(`[Turso Social] Fetch likes fallback for ${contentId}:`, err);
    const cached = likesCountCache.get(contentId);
    return { likesCount: cached?.count || 0, userLiked: !!cached?.userLiked };
  }
}

// Pending like debounce map for atomic batching
interface LikeDebounceTask {
  contentId: string;
  initialUserLiked: boolean;
  initialLikesCount: number;
  currentUserLiked: boolean;
  currentLikesCount: number;
  timer: any;
  resolvers: Array<(val: { active: boolean; likesCount: number }) => void>;
  rejecters: Array<(err: any) => void>;
}

const likeDebounceMap = new Map<string, LikeDebounceTask>();

/**
 * Toggle a like in Turso database with optimistic cache update and debouncing
 */
export async function toggleLikeInDb(contentId: string, currentUserId?: string): Promise<{ active: boolean; likesCount: number }> {
  if (!auth.currentUser) {
    throw new Error('Must be signed in to like content.');
  }

  return new Promise((resolve, reject) => {
    let task = likeDebounceMap.get(contentId);

    const cached = likesCountCache.get(contentId);
    const startCount = cached ? cached.count : 0;
    const startLiked = cached ? !!cached.userLiked : false;

    if (!task) {
      const nextLiked = !startLiked;
      const nextCount = nextLiked ? startCount + 1 : Math.max(0, startCount - 1);

      // Optimistic memory update immediately
      likesCountCache.set(contentId, { count: nextCount, userLiked: nextLiked, timestamp: Date.now() });

      task = {
        contentId,
        initialUserLiked: startLiked,
        initialLikesCount: startCount,
        currentUserLiked: nextLiked,
        currentLikesCount: nextCount,
        timer: null,
        resolvers: [resolve],
        rejecters: [reject]
      };
      likeDebounceMap.set(contentId, task);
    } else {
      task.resolvers.push(resolve);
      task.rejecters.push(reject);
      if (task.timer) {
        clearTimeout(task.timer);
      }

      task.currentUserLiked = !task.currentUserLiked;
      task.currentLikesCount = task.currentUserLiked
        ? task.currentLikesCount + 1
        : Math.max(0, task.currentLikesCount - 1);

      // Update optimistic cache immediately
      likesCountCache.set(contentId, { count: task.currentLikesCount, userLiked: task.currentUserLiked, timestamp: Date.now() });
    }

    // Debounce timer (350ms)
    task.timer = setTimeout(async () => {
      likeDebounceMap.delete(contentId);

      // Check if net state changed compared to initial state before rapid tapping
      if (task!.initialUserLiked === task!.currentUserLiked) {
        const result = { active: task!.currentUserLiked, likesCount: task!.currentLikesCount };
        task!.resolvers.forEach(r => r(result));
        return;
      }

      try {
        const res = await toggleTursoLike(contentId);
        const finalCount = res.likesCount ?? task!.currentLikesCount;
        const finalActive = res.active ?? task!.currentUserLiked;

        likesCountCache.set(contentId, { count: finalCount, userLiked: finalActive, timestamp: Date.now() });
        const result = { active: finalActive, likesCount: finalCount };
        task!.resolvers.forEach(r => r(result));
      } catch (err) {
        // Rollback optimistic cache on write error
        likesCountCache.set(contentId, { count: task!.initialLikesCount, userLiked: task!.initialUserLiked, timestamp: Date.now() });
        task!.rejecters.forEach(rj => rj(err));
      }
    }, 350);
  });
}

/**
 * Fetch comments for a content item from Turso with pagination (top 10 by default)
 */
export async function fetchCommentsForContent(
  contentId: string,
  currentUserId?: string,
  forceRefresh = false,
  limit = 10,
  offset = 0
): Promise<SheetDbComment[] & { hasMore?: boolean }> {
  const effectiveUid = currentUserId || auth.currentUser?.uid || '';
  const cacheKey = `farukat_comments_${contentId}_${offset}_${effectiveUid}`;
  try {
    const cached = commentsCache.get(`${contentId}_${offset}_${effectiveUid}`);
    const now = Date.now();
    if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      const res = [...cached.comments] as SheetDbComment[] & { hasMore?: boolean };
      res.hasMore = cached.comments.length >= limit;
      return res;
    }

    const data = await getTursoComments(contentId, undefined, limit, offset, effectiveUid);
    const comments: SheetDbComment[] = (data.comments || []).map((c: any) => ({
      commentId: c.commentId || c.id,
      contentId: c.contentId || c.content_id,
      userId: c.userId || c.user_id,
      username: c.username || 'Cinema Member',
      avatar: c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      text: c.text,
      parentCommentId: c.parentCommentId || c.parent_comment_id || null,
      createdAt: c.createdAt || c.created_at,
      likesCount: Number(c.likesCount ?? c.likes_count ?? 0),
      userLiked: Boolean(c.userLiked || c.user_liked)
    }));

    commentsCache.set(`${contentId}_${offset}_${effectiveUid}`, { comments, timestamp: now });
    try {
      localStorage.setItem(cacheKey, JSON.stringify(comments));
    } catch {}

    const res = [...comments] as SheetDbComment[] & { hasMore?: boolean };
    res.hasMore = comments.length >= limit;
    return res;
  } catch (err) {
    console.warn(`[Turso Social] Fetch comments notice for ${contentId}:`, err);
    try {
      const localRaw = localStorage.getItem(cacheKey);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        const res = [...parsed] as SheetDbComment[] & { hasMore?: boolean };
        res.hasMore = parsed.length >= limit;
        return res;
      }
    } catch {}
    const fallback = commentsCache.get(`${contentId}_${offset}_${effectiveUid}`)?.comments || [];
    const res = [...fallback] as SheetDbComment[] & { hasMore?: boolean };
    res.hasMore = fallback.length >= limit;
    return res;
  }
}

/**
 * Add a comment or reply in Turso database with instant optimistic rendering
 */
export async function addCommentToDb(
  contentId: string,
  userIdParam: string,
  username: string,
  avatar: string,
  text: string,
  parentCommentId?: string | null
): Promise<SheetDbComment> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Comment text cannot be empty.');
  }

  if (!auth.currentUser) {
    throw new Error('Must be signed in to post reviews.');
  }

  const effectiveName = username || auth.currentUser.displayName || 'Cinema Member';
  const effectiveAvatar = avatar || auth.currentUser.photoURL || 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FarukatViewer';
  const parentId = parentCommentId && parentCommentId.trim() ? parentCommentId.trim() : null;

  const res = await addTursoComment(contentId, trimmed, effectiveName, effectiveAvatar, parentId);
  const newComment: SheetDbComment = {
    commentId: res.commentId || ((parentId ? 'rep_' : 'cmt_') + Date.now()),
    contentId,
    userId: auth.currentUser.uid,
    username: effectiveName,
    avatar: effectiveAvatar,
    text: trimmed,
    parentCommentId: parentId,
    createdAt: new Date().toISOString(),
    likesCount: 0,
    userLiked: false
  };

  // Update memory and local cache across user sessions
  const effectiveUid = auth.currentUser.uid;
  const existing = commentsCache.get(`${contentId}_${effectiveUid}`)?.comments || [];
  const updatedComments = [newComment, ...existing];
  commentsCache.set(`${contentId}_${effectiveUid}`, { comments: updatedComments, timestamp: Date.now() });
  try {
    localStorage.setItem(`farukat_comments_${contentId}_${effectiveUid}`, JSON.stringify(updatedComments));
  } catch {}

  return newComment;
}

/**
 * Delete a comment from Turso database
 */
export async function deleteCommentFromDb(commentId: string, currentUserId: string, contentId: string): Promise<boolean> {
  const effectiveUid = currentUserId || auth.currentUser?.uid || '';
  if (contentId) {
    const existing = commentsCache.get(`${contentId}_${effectiveUid}`)?.comments || [];
    const filtered = existing.filter(c => c.commentId !== commentId);
    commentsCache.set(`${contentId}_${effectiveUid}`, { comments: filtered, timestamp: Date.now() });
    try {
      localStorage.setItem(`farukat_comments_${contentId}_${effectiveUid}`, JSON.stringify(filtered));
    } catch {}
  }

  try {
    await deleteTursoComment(commentId);
    return true;
  } catch (err) {
    console.error('[Turso Social] Delete comment error:', err);
    return false;
  }
}

/**
 * Toggle like for a specific comment in Turso database with per-user tracking & optimistic updates
 */
export async function toggleCommentLikeInDb(
  commentId: string,
  contentId: string,
  currentUserId?: string
): Promise<{ active: boolean; likesCount: number }> {
  if (!auth.currentUser) {
    throw new Error('Must be signed in to like comments.');
  }

  const effectiveUid = currentUserId || auth.currentUser.uid;
  const cacheKey = `${contentId}_${effectiveUid}`;
  const cachedComments = commentsCache.get(cacheKey)?.comments || [];
  
  // Find current comment in cache
  const targetComment = cachedComments.find(c => c.commentId === commentId);
  const prevLiked = Boolean(targetComment?.userLiked);
  const prevCount = targetComment?.likesCount || 0;

  const optimisticActive = !prevLiked;
  const optimisticCount = optimisticActive ? prevCount + 1 : Math.max(0, prevCount - 1);

  // Optimistic update in cache
  if (cachedComments.length > 0) {
    const updated = cachedComments.map(c => 
      c.commentId === commentId 
        ? { ...c, userLiked: optimisticActive, likesCount: optimisticCount }
        : c
    );
    commentsCache.set(cacheKey, { comments: updated, timestamp: Date.now() });
    try {
      localStorage.setItem(`farukat_comments_${contentId}_${effectiveUid}`, JSON.stringify(updated));
    } catch {}
  }

  try {
    const res = await toggleTursoCommentLike(commentId);
    const trueActive = Boolean(res.active ?? res.liked ?? res.userLiked ?? optimisticActive);
    const trueCount = Number(res.likesCount ?? optimisticCount);

    // Save true server response in cache
    const currentCached = commentsCache.get(cacheKey)?.comments || [];
    const finalComments = currentCached.map(c =>
      c.commentId === commentId
        ? { ...c, userLiked: trueActive, likesCount: trueCount }
        : c
    );
    commentsCache.set(cacheKey, { comments: finalComments, timestamp: Date.now() });
    try {
      localStorage.setItem(`farukat_comments_${contentId}_${effectiveUid}`, JSON.stringify(finalComments));
    } catch {}

    return { active: trueActive, likesCount: trueCount };
  } catch (err) {
    console.error(`[Turso Social] Toggle comment like failed for ${commentId}:`, err);
    // Rollback cache
    if (cachedComments.length > 0) {
      const rolledBack = cachedComments.map(c => 
        c.commentId === commentId 
          ? { ...c, userLiked: prevLiked, likesCount: prevCount }
          : c
      );
      commentsCache.set(cacheKey, { comments: rolledBack, timestamp: Date.now() });
      try {
        localStorage.setItem(`farukat_comments_${contentId}_${effectiveUid}`, JSON.stringify(rolledBack));
      } catch {}
    }
    throw err;
  }
}

/**
 * Fetch all content IDs liked by current user from Turso
 */
export async function fetchUserLikes(): Promise<string[]> {
  try {
    if (!auth.currentUser) return [];
    const res = await getTursoUserLikes();
    return res.likes || [];
  } catch (err) {
    console.warn('[Turso Social] Fetch user likes error:', err);
    return [];
  }
}
