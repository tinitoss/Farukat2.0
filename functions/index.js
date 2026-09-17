const functions = require('firebase-functions');
const admin = require('firebase-admin');

try {
  admin.initializeApp();
} catch (e) {
  console.log('Firebase Admin already initialized');
}

const db = admin.firestore();

/**
 * Custom Claim Trigger: Triggers on new user creation.
 * Verifies if the authenticated user's email is the single super admin: altinberisha434@gmail.com
 * If true, sets custom user claims: { admin: true } and updates Firestore role fields.
 */
exports.setAdminClaimOnCreate = functions.auth.user().onCreate(async (user) => {
  if (user.email && user.email.toLowerCase() === 'altinberisha434@gmail.com') {
    try {
      await admin.auth().setCustomUserClaims(user.uid, { admin: true });
      console.log(`[AUTH CLAIMS] Admin claim set for super admin UID: ${user.uid}`);

      // Ensure the profile in Firestore reflects the Admin status
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.set({
        role: 'admin',
        profile: {
          role: 'admin',
          status: 'Active',
          tier: 'DIAMOND',
          isOfficial: true
        }
      }, { merge: true });

      // Write an initial system audit log
      await db.collection('adminAuditLogs').add({
        adminId: 'SYSTEM',
        adminEmail: 'SYSTEM',
        action: 'PROMOTED_SUPER_ADMIN',
        targetId: user.uid,
        reason: 'Auto-promotion of single super admin on user registration',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error('[AUTH CLAIMS ERROR] Failed to set super admin claim:', err);
    }
  }
});

/**
 * Helper to enforce that the caller of a callable cloud function is an authenticated admin.
 */
function verifyAdminCaller(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }
  if (context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'The caller is not authorized as an administrator.'
    );
  }
}

/**
 * Privilege: manageUserStatus
 * Privileged operation to Ban, Timeout, Warn, Verify/Unverify users.
 */
exports.manageUserStatus = functions.https.onCall(async (data, context) => {
  verifyAdminCaller(context);

  const { targetUserId, actionType, durationMs, reason } = data;
  if (!targetUserId || !actionType) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing targetUserId or actionType.');
  }

  const targetUserRef = db.collection('users').doc(targetUserId);
  const targetUserSnap = await targetUserRef.get();

  if (!targetUserSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target user does not exist.');
  }

  const updates = {};
  const currentTimestamp = Date.now();

  switch (actionType) {
    case 'BAN':
      updates['profile.status'] = 'Suspended';
      updates['profile.banned'] = true;
      break;
    case 'UNBAN':
      updates['profile.status'] = 'Active';
      updates['profile.banned'] = false;
      updates['profile.timeoutUntil'] = null;
      break;
    case 'TIMEOUT':
      const timeoutUntil = currentTimestamp + (durationMs || 3600000); // Default 1 hour
      updates['profile.status'] = 'Suspended';
      updates['profile.timeoutUntil'] = timeoutUntil;
      break;
    case 'WARN':
      updates['profile.warned'] = true;
      updates['profile.warningReason'] = reason || 'Violation of terms.';
      break;
    case 'VERIFY':
      updates['profile.verified'] = true;
      updates['profile.isOfficial'] = true;
      break;
    case 'UNVERIFY':
      updates['profile.verified'] = false;
      updates['profile.isOfficial'] = false;
      break;
    default:
      throw new functions.https.HttpsError('invalid-argument', `Invalid actionType: ${actionType}`);
  }

  await targetUserRef.update(updates);

  // Immutable Audit Logging
  await db.collection('adminAuditLogs').add({
    adminId: context.auth.uid,
    adminEmail: context.auth.token.email,
    action: `USER_${actionType}`,
    targetId: targetUserId,
    reason: reason || 'No specific reason provided.',
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: `Successfully executed user status update: ${actionType}` };
});

/**
 * Privilege: adjustUserXP
 * Privileged operation to Add or Remove XP from any user's profile with absolute audit tracing.
 */
exports.adjustUserXP = functions.https.onCall(async (data, context) => {
  verifyAdminCaller(context);

  const { targetUserId, amount, reason } = data;
  if (!targetUserId || typeof amount !== 'number') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing targetUserId or amount.');
  }

  const targetUserRef = db.collection('users').doc(targetUserId);
  const targetUserSnap = await targetUserRef.get();

  if (!targetUserSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target user does not exist.');
  }

  const userData = targetUserSnap.data();
  const currentXp = typeof userData.currentXp === 'number' ? userData.currentXp : 0;
  const lifetimeXp = typeof userData.lifetimeXp === 'number' ? userData.lifetimeXp : 0;
  const weeklyXpAmount = userData.weeklyXp?.xpEarned || 0;

  const newXp = Math.max(0, currentXp + amount);
  const newLifetime = Math.max(0, lifetimeXp + amount);
  const newWeekly = Math.max(0, weeklyXpAmount + amount);

  await targetUserRef.set({
    currentXp: newXp,
    lifetimeXp: newLifetime,
    weeklyXp: {
      xpEarned: newWeekly,
      lastCalculatedAt: Date.now()
    }
  }, { merge: true });

  // Immutable Audit Logging
  await db.collection('adminAuditLogs').add({
    adminId: context.auth.uid,
    adminEmail: context.auth.token.email,
    action: amount >= 0 ? 'XP_ADD' : 'XP_REMOVE',
    targetId: targetUserId,
    reason: reason || `Admin adjusted XP by ${amount}`,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, newXp, newLifetime };
});

/**
 * Privilege: moderateContent
 * Hide, unhide, or delete comments or toggle video moderation visibility.
 */
exports.moderateContent = functions.https.onCall(async (data, context) => {
  verifyAdminCaller(context);

  const { contentType, contentId, actionType, reason } = data;
  if (!contentType || !contentId || !actionType) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing contentType, contentId, or actionType.');
  }

  if (contentType === 'comment') {
    const commentRef = db.collection('comments').doc(contentId);
    if (actionType === 'DELETE') {
      await commentRef.delete();
    } else {
      await commentRef.update({
        moderationStatus: actionType === 'HIDE' ? 'hidden' : 'visible'
      });
    }
  } else if (contentType === 'video' || contentType === 'series') {
    const videoRef = db.collection('moderatedContent').doc(contentId);
    if (actionType === 'HIDE') {
      await videoRef.set({
        mediaId: contentId,
        moderationStatus: 'hidden',
        moderatedAt: Date.now()
      });
    } else {
      await videoRef.delete();
    }
  } else {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid contentType.');
  }

  // Immutable Audit Logging
  await db.collection('adminAuditLogs').add({
    adminId: context.auth.uid,
    adminEmail: context.auth.token.email,
    action: `${contentType.toUpperCase()}_MODERATION_${actionType}`,
    targetId: contentId,
    reason: reason || `Admin moderated content type: ${contentType}`,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

/**
 * Privilege: resolveReport
 * Process user flags and update report statuses.
 */
exports.resolveReport = functions.https.onCall(async (data, context) => {
  verifyAdminCaller(context);

  const { reportId, status, notes } = data;
  if (!reportId || !status) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing reportId or status.');
  }

  const reportRef = db.collection('reports').doc(reportId);
  await reportRef.update({
    status: status, // 'RESOLVED' or 'DISMISSED'
    resolvedAt: Date.now(),
    resolutionNotes: notes || ''
  });

  // Immutable Audit Logging
  await db.collection('adminAuditLogs').add({
    adminId: context.auth.uid,
    adminEmail: context.auth.token.email,
    action: `REPORT_RESOLVED_${status}`,
    targetId: reportId,
    reason: notes || `Report resolved as ${status}`,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});
