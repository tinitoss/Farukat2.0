import { 
  initTursoTables,
  getTursoClient,
  updateTursoUserProfile,
  getOrCreateUserProfile,
  lookupTursoMember,
  getAllTursoMembers,
  getUserXp,
  awardUserXp,
  processReferralSignup,
  toggleLike,
  getContentLikes,
  getUserLikedContentIds,
  createComment,
  getCommentsForContent,
  deleteComment,
  updateWatchProgress,
  getUserWatchProgressList,
  claimWatchReward,
  saveUserFcmToken,
  saveTursoMediaCatalogState,
  getTursoMediaCatalogState,
  syncTursoWatchPartyRoom,
  getTursoWatchPartyRoom,
  updateTursoWatchPartyPlayback
} from '../src/server/tursoDb';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<any>) {
  try {
    const details = await fn();
    results.push({ name, passed: true, details });
    console.log(`✅ [PASS] ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err?.message || String(err) });
    console.error(`❌ [FAIL] ${name}:`, err?.message || err);
  }
}

async function main() {
  console.log('=== STARTING COMPLETE TURSO DATABASE & API TEST SUITE ===\n');

  // Test 1: Initialize Database Tables
  await runTest('1. Initialize Turso Tables (initTursoTables)', async () => {
    const res = await initTursoTables();
    return { initialized: res };
  });

  // Test 2: User Profile Upsert & Retrieval
  const testUserId = `test_user_${Date.now()}`;
  const testCardNumber = `FK-TEST-${Math.floor(1000 + Math.random() * 9000)}`;

  await runTest('2. User Profile Upsert (updateTursoUserProfile)', async () => {
    const profile = await updateTursoUserProfile({
      userId: testUserId,
      username: 'Test Cinephile',
      avatar: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Test',
      cardNumber: testCardNumber,
      tier: 'GOLD',
      proMember: true,
      bio: 'Testing Turso Integration',
      lifetimeXp: 500,
      level: 5
    });
    if (!profile || profile.userId !== testUserId) {
      throw new Error(`Profile userId mismatch: ${JSON.stringify(profile)}`);
    }
    return profile;
  });

  // Test 3: Get or Create User Profile
  await runTest('3. Get or Create User Profile (getOrCreateUserProfile)', async () => {
    const profile = await getOrCreateUserProfile(testUserId, 'Test Cinephile');
    if (!profile || profile.username !== 'Test Cinephile') {
      throw new Error('Failed to retrieve existing profile');
    }
    return profile;
  });

  // Test 4: Member Lookup by Card Number or ID
  await runTest('4. Member Lookup (lookupTursoMember)', async () => {
    const byCard = await lookupTursoMember(testCardNumber);
    if (!byCard || byCard.userId !== testUserId) {
      throw new Error(`Failed to lookup by card number ${testCardNumber}`);
    }
    const byId = await lookupTursoMember(testUserId);
    if (!byId || byId.cardNumber !== testCardNumber) {
      throw new Error(`Failed to lookup by user ID ${testUserId}`);
    }
    return { byCard, byId };
  });

  // Test 5: Community Members List
  await runTest('5. Community Members Directory (getAllTursoMembers)', async () => {
    const members = await getAllTursoMembers();
    if (!Array.isArray(members)) {
      throw new Error('getAllTursoMembers did not return an array');
    }
    const found = members.some((m) => m.userId === testUserId || m.cardNumber === testCardNumber);
    if (!found) {
      throw new Error(`Test user not found in community list of ${members.length} members`);
    }
    return { memberCount: members.length };
  });

  // Test 6: XP Balance & Level Calculation
  await runTest('6. XP Balance Retrieval (getUserXp)', async () => {
    const xp = await getUserXp(testUserId);
    if (xp.xp < 500) {
      throw new Error(`Expected at least 500 XP, got ${xp.xp}`);
    }
    return xp;
  });

  // Test 7: XP Award Transaction
  await runTest('7. Award XP Transaction (awardUserXp)', async () => {
    const result = await awardUserXp(testUserId, 'Test Watch Action', 50, 'media_123');
    if (!result.success || (result.xp || 0) < 550) {
      throw new Error(`Failed to award XP. Result: ${JSON.stringify(result)}`);
    }
    return result;
  });

  // Test 8: Content Likes (Toggle & Count)
  const testContentId = `content_test_${Date.now()}`;
  await runTest('8. Content Likes Toggle & Count (toggleLike & getContentLikes)', async () => {
    const likeRes = await toggleLike(testContentId, testUserId);
    if (!likeRes.liked || likeRes.likesCount < 1) {
      throw new Error(`Expected content to be liked with count >= 1: ${JSON.stringify(likeRes)}`);
    }

    const checkCount = await getContentLikes(testContentId, testUserId);
    if (!checkCount.isLiked || checkCount.likesCount !== likeRes.likesCount) {
      throw new Error(`getContentLikes mismatch: ${JSON.stringify(checkCount)}`);
    }

    const userLikes = await getUserLikedContentIds(testUserId);
    if (!userLikes.includes(testContentId)) {
      throw new Error(`User liked content IDs missing ${testContentId}`);
    }

    return { likeRes, checkCount, userLikesCount: userLikes.length };
  });

  // Test 9: Comments Creation, Listing, and Deletion
  let createdCommentId = '';
  await runTest('9. Comments CRUD (createComment, getCommentsForContent, deleteComment)', async () => {
    const comment = await createComment(
      testContentId,
      testUserId,
      'Test User',
      'https://api.dicebear.com/7.x/open-peeps/svg?seed=Comment',
      'This is an automated test comment'
    );
    if (!comment || !comment.id) {
      throw new Error(`Failed to create comment: ${JSON.stringify(comment)}`);
    }
    createdCommentId = comment.id;

    const list = await getCommentsForContent(testContentId);
    if (!list || !list.some((c) => c.id === createdCommentId)) {
      throw new Error(`Created comment ${createdCommentId} not found in comments list`);
    }

    const deleted = await deleteComment(createdCommentId, testUserId);
    if (!deleted) {
      throw new Error(`Failed to delete comment ${createdCommentId}`);
    }

    const listAfter = await getCommentsForContent(testContentId);
    if (listAfter.some((c) => c.id === createdCommentId)) {
      throw new Error(`Comment ${createdCommentId} still present after deletion`);
    }

    return { createdCommentId, listBeforeCount: list.length, listAfterCount: listAfter.length };
  });

  // Test 10: Watch Progress Sync & List
  await runTest('10. Watch Progress Sync (updateWatchProgress & getUserWatchProgressList)', async () => {
    const res = await updateWatchProgress(testUserId, testContentId, 120, 600, false);
    if (!res.success) {
      throw new Error(`Failed to sync watch progress: ${JSON.stringify(res)}`);
    }

    const list = await getUserWatchProgressList(testUserId);
    const item = list.find((p) => p.contentId === testContentId);
    if (!item || item.progressSeconds !== 120) {
      throw new Error(`Watch progress item not recorded correctly: ${JSON.stringify(item)}`);
    }
    return { listCount: list.length, item };
  });

  // Test 11: Claim Watch Reward
  await runTest('11. Claim Watch Reward (claimWatchReward)', async () => {
    const claim = await claimWatchReward(testUserId, testContentId, 'first_25_percent');
    if (!claim.success || !claim.awarded) {
      throw new Error(`Failed to claim watch reward: ${JSON.stringify(claim)}`);
    }
    // Claiming again should not re-award
    const secondClaim = await claimWatchReward(testUserId, testContentId, 'first_25_percent');
    if (secondClaim.awarded) {
      throw new Error(`Duplicate reward should not be awarded: ${JSON.stringify(secondClaim)}`);
    }
    return { firstClaim: claim, secondClaim };
  });

  // Test 12: FCM Token Registration
  await runTest('12. FCM Device Token Persistence (saveUserFcmToken)', async () => {
    const token = `fcm_test_token_${Date.now()}`;
    await saveUserFcmToken(testUserId, token);
    return { tokenSaved: true };
  });

  // Test 13: Media Catalog State Persistence
  await runTest('13. Media Catalog State (saveTursoMediaCatalogState & getTursoMediaCatalogState)', async () => {
    const testVideo = {
      id: `custom_test_${Date.now()}`,
      title: 'Turso Test Film',
      originalSection: 'movie',
      category: 'movie',
      rating: '9.5',
      year: '2026',
      duration: '45min',
      description: 'Test film sync'
    };

    const saveRes = await saveTursoMediaCatalogState({
      customVideos: [testVideo]
    });
    if (!saveRes.success) {
      throw new Error(`Failed to save catalog state: ${JSON.stringify(saveRes)}`);
    }

    const catalog = await getTursoMediaCatalogState();
    if (!catalog.customVideos || !catalog.customVideos.some((v: any) => v.id === testVideo.id)) {
      throw new Error(`Custom video ${testVideo.id} not found in retrieved catalog`);
    }
    return { customVideosCount: catalog.customVideos.length };
  });

  // Test 14: Watch Party Room Synchronization & Playback State
  const testPartyId = `party_${Date.now()}`;
  await runTest('14. Watch Party Room State (syncTursoWatchPartyRoom & getTursoWatchPartyRoom)', async () => {
    const partyData = {
      partyId: testPartyId,
      hostUserId: testUserId,
      hostName: 'Test Host',
      mediaId: testContentId,
      mediaTitle: 'Test Movie',
      status: 'playing',
      isPlaying: true,
      currentPosition: 42.5,
      totalPausedDuration: 0,
      viewersCount: 3
    };

    const syncRes = await syncTursoWatchPartyRoom(partyData);
    if (!syncRes) {
      throw new Error('Failed to sync watch party room to Turso');
    }

    const fetchedParty = await getTursoWatchPartyRoom(testPartyId);
    if (!fetchedParty || fetchedParty.partyId !== testPartyId) {
      throw new Error(`Failed to fetch party room ${testPartyId}`);
    }

    const playbackRes = await updateTursoWatchPartyPlayback(testPartyId, {
      isPlaying: false,
      currentPosition: 105.0,
      totalPausedDuration: 10
    });
    if (!playbackRes) {
      throw new Error('Failed to update watch party playback');
    }

    const updatedParty = await getTursoWatchPartyRoom(testPartyId);
    if (!updatedParty || updatedParty.currentPosition !== 105.0) {
      throw new Error(`Playback position update failed: ${JSON.stringify(updatedParty)}`);
    }

    return { fetchedParty, updatedParty };
  });

  // Test 15: HTTP Server API Endpoints
  console.log('\n--- TESTING LIVE HTTP SERVER API ENDPOINTS (http://localhost:3000) ---');

  await runTest('15. HTTP API: /api/turso/catalog', async () => {
    const res = await fetch('http://localhost:3000/api/turso/catalog');
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data: any = await res.json();
    if (!data.success || !Array.isArray(data.customVideos)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }
    return { status: res.status, customVideos: data.customVideos.length };
  });

  await runTest('16. HTTP API: /api/turso/members', async () => {
    const res = await fetch('http://localhost:3000/api/turso/members');
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data: any = await res.json();
    if (!data.success || !Array.isArray(data.members)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }
    return { status: res.status, membersCount: data.members.length };
  });

  await runTest('17. HTTP API: /api/turso/member/verify', async () => {
    const res = await fetch(`http://localhost:3000/api/turso/member/verify?id=${encodeURIComponent(testCardNumber)}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data: any = await res.json();
    if (!data.success || !data.member || data.member.userId !== testUserId) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }
    return { status: res.status, member: data.member };
  });

  await runTest('18. HTTP API: /api/turso/likes', async () => {
    const res = await fetch(`http://localhost:3000/api/turso/likes?contentId=${encodeURIComponent(testContentId)}&userId=${encodeURIComponent(testUserId)}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data: any = await res.json();
    if (!data.success || typeof data.likesCount !== 'number') {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }
    return { status: res.status, likesCount: data.likesCount, isLiked: data.isLiked };
  });

  await runTest('19. HTTP API: /api/turso/watch-party/state', async () => {
    const res = await fetch(`http://localhost:3000/api/turso/watch-party/state?partyId=${encodeURIComponent(testPartyId)}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data: any = await res.json();
    if (!data.partyId || data.partyId !== testPartyId) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }
    return { status: res.status, partyId: data.partyId, currentPosition: data.currentPosition };
  });

  // Summary
  console.log('\n======================================================');
  console.log('                 TURSO TEST SUMMARY                   ');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS : ${total}`);
  console.log(`PASSED      : ${passed}`);
  console.log(`FAILED      : ${failed}`);

  if (failed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TURSO DATABASE AND API TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
