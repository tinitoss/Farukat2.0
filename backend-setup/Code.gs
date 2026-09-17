/**
 * FARUKAT - GOOGLE APPS SCRIPT BACKEND
 * 
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete the default code and paste this entire file.
 * 4. Run the `initSetup` function once to generate all database sheets.
 * 5. Deploy > New Deployment > Select "Web App".
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 6. Copy the resulting Web App URL and place it in your app's .env file as VITE_APPS_SCRIPT_URL.
 */

const CONFIG = {
  // Folder ID to store uploaded signatures/images. Leave blank to store in root.
  DRIVE_FOLDER_ID: "", 
};

/**
 * 1. INITIALIZATION 
 * Run this function once to create the database schema.
 */
function initSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const schemas = {
    'Users': ['userId', 'email', 'name', 'profileImageUrl', 'cardNumber', 'memberId', 'memberSince', 'currentXp', 'lifetimeXp', 'level', 'membershipTier', 'status', 'signatureUrl', 'createdAt', 'updatedAt'],
    'XP_Transactions': ['transactionId', 'userId', 'amount', 'type', 'reason', 'createdAt'],
    'Follows': ['followerId', 'followingCardNumber', 'createdAt'],
    'Achievements': ['achievementId', 'name', 'description', 'requirement', 'xpReward', 'icon', 'active'],
    'User_Achievements': ['userId', 'achievementId', 'unlockedAt'],
    'Notifications': ['notificationId', 'userId', 'type', 'message', 'read', 'createdAt']
  };
  
  for (const [sheetName, headers] of Object.entries(schemas)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    // Set headers if empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }
  
  // Populate default achievements if empty
  const achSheet = ss.getSheetByName('Achievements');
  if (achSheet.getLastRow() <= 1) {
    const defaultAchievements = [
      ['ach_first_login', 'First Login', 'Welcome to Farukat VIP', 50, 'shield', 'TRUE'],
      ['ach_engagement', 'Community Contributor', 'Followed a member or liked a comment', 25, 'star', 'TRUE'],
      ['ach_watchlist', 'Cinephile', 'Added a movie to watchlist', 10, 'film', 'TRUE']
    ];
    for (const ach of defaultAchievements) {
      achSheet.appendRow(ach);
    }
  }
  
  Logger.log("Database initialized successfully!");
}

/**
 * 2. WEB APP HANDLERS
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const uid = payload.uid;
    
    if (!uid) throw new Error("Missing userId (uid)");
    
    let result = {};
    
    // Concurrency Lock
    const lock = LockService.getScriptLock();
    lock.waitLock(5000); 
    
    try {
      switch (action) {
        case 'getUserData':
          result = handleGetUserData(payload);
          break;
        case 'recordXP':
          result = handleRecordXP(payload);
          break;
        case 'followUser':
          result = handleFollowUser(payload);
          break;
        case 'unfollowUser':
          result = handleUnfollowUser(payload);
          break;
        case 'getCommunity':
          result = handleGetCommunity(payload);
          break;
        case 'saveSignature':
          result = handleSaveSignature(payload);
          break;
        case 'updateProfile':
          result = handleUpdateProfile(payload);
          break;
        default:
          throw new Error("Unknown action: " + action);
      }
    } finally {
      lock.releaseLock();
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Farukat API is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 3. ROUTE HANDLERS
 */

function handleGetUserData(payload) {
  const { uid, email, name, photoURL } = payload;
  const user = getOrCreateUser(uid, email, name, photoURL);
  const follows = getFollowing(uid);
  const followers = getFollowerCount(user.cardNumber);
  const unlocked = getUserAchievements(uid);
  
  return {
    ...user,
    following: follows,
    followersCount: followers,
    achievements: unlocked
  };
}

function handleRecordXP(payload) {
  const { uid, reason, type } = payload;
  
  // Backend dictates XP amount based on reason to prevent cheating
  let amount = 10; 
  if (reason.includes("Daily Login")) amount = 25;
  if (reason.includes("Followed") || reason.includes("Comment")) amount = 15;
  if (reason.includes("Watchlist")) amount = 10;
  
  const user = getUser(uid);
  if (!user) throw new Error("User not found");
  
  addXpTransaction(uid, amount, type, reason);
  
  // Recalculate User Totals
  return recalculateUserLevelAndTier(uid);
}

function handleFollowUser(payload) {
  const { uid, targetCardNumber } = payload;
  const user = getUser(uid);
  if (!user) throw new Error("User not found");
  if (user.cardNumber === targetCardNumber) throw new Error("Cannot follow yourself");
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Follows');
  const data = sheet.getDataRange().getValues();
  
  // Check duplicate
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uid && data[i][1] === targetCardNumber) {
      throw new Error("Already following");
    }
  }
  
  sheet.appendRow([uid, targetCardNumber, new Date().toISOString()]);
  
  // Auto-reward XP for engagement
  addXpTransaction(uid, 15, 'engagement', 'Followed VIP Member');
  const updatedUser = recalculateUserLevelAndTier(uid);
  
  return {
    following: getFollowing(uid),
    xpUpdated: updatedUser
  };
}

function handleUnfollowUser(payload) {
  const { uid, targetCardNumber } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Follows');
  const data = sheet.getDataRange().getValues();
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === uid && data[i][1] === targetCardNumber) {
      sheet.deleteRow(i + 1);
    }
  }
  
  return {
    following: getFollowing(uid)
  };
}

function handleGetCommunity(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const members = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const member = {};
    headers.forEach((h, j) => member[h] = row[j]);
    
    // Only return public info
    members.push({
      cardNumber: member.cardNumber,
      name: member.name,
      avatarUrl: member.profileImageUrl,
      tier: member.membershipTier,
      level: member.level,
      lifetimeXp: member.lifetimeXp,
      memberSince: member.memberSince,
      status: member.status,
      isOfficial: member.level >= 8,
      badge: `Level ${member.level} ${member.membershipTier}`,
      followers: getFollowerCount(member.cardNumber)
    });
  }
  
  return members;
}

function handleSaveSignature(payload) {
  const { uid, base64Image } = payload;
  if (!base64Image) throw new Error("No image data");
  
  // Extract base64 part
  const base64Data = base64Image.split(',')[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', `signature_${uid}.png`);
  
  let folder;
  if (CONFIG.DRIVE_FOLDER_ID) {
    folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  } else {
    folder = DriveApp.getRootFolder();
  }
  
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  const fileUrl = file.getDownloadUrl().replace('&gd=true', '');
  
  // Update User record
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uid) {
      sheet.getRange(i + 1, 13).setValue(fileUrl); // signatureUrl is column 13 (M)
      return { signatureUrl: fileUrl };
    }
  }
  
  throw new Error("User not found");
}

function handleUpdateProfile(payload) {
  const { uid, name, avatarUrl } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uid) {
      if (name) sheet.getRange(i + 1, 3).setValue(name);
      if (avatarUrl) sheet.getRange(i + 1, 4).setValue(avatarUrl);
      sheet.getRange(i + 1, 15).setValue(new Date().toISOString()); // updatedAt
      return getOrCreateUser(uid);
    }
  }
  throw new Error("User not found");
}


/**
 * 4. DATABASE HELPERS
 */
function getOrCreateUser(uid, email = "", name = "VIP Member", photoURL = "") {
  let user = getUser(uid);
  if (user) return user;
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  
  const cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const cardNumber = `FK-${cleanUid.slice(0, 4) || '8F42'}-${cleanUid.slice(4, 8) || '19C7'}`;
  const memberId = `FK-${uid.slice(0, 4).toUpperCase()}-VIP`;
  const now = new Date().toISOString();
  
  const newRow = [
    uid, email, name, photoURL, cardNumber, memberId, 
    "Oct 2024", // memberSince
    0, 0, 1, "STANDARD", "Active", "", now, now
  ];
  
  sheet.appendRow(newRow);
  
  addXpTransaction(uid, 50, 'bonus', 'Welcome Bonus');
  return recalculateUserLevelAndTier(uid);
}

function getUser(uid) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uid) {
      const user = {};
      headers.forEach((h, j) => user[h] = data[i][j]);
      return user;
    }
  }
  return null;
}

function addXpTransaction(uid, amount, type, reason) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('XP_Transactions');
  const txId = Utilities.getUuid();
  sheet.appendRow([txId, uid, amount, type, reason, new Date().toISOString()]);
}

function recalculateUserLevelAndTier(uid) {
  const txSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('XP_Transactions');
  const data = txSheet.getDataRange().getValues();
  
  let currentXp = 0;
  let lifetimeXp = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === uid) {
      const amount = Number(data[i][2]);
      const type = data[i][3];
      
      if (type !== 'SPEND') lifetimeXp += amount;
      if (type === 'SPEND') {
        currentXp -= amount;
      } else {
        currentXp += amount;
      }
    }
  }
  
  // Level Math
  const LEVEL_TIERS = [
    { level: 1, minXp: 0, tier: 'STANDARD' },
    { level: 2, minXp: 75, tier: 'BRONZE' },
    { level: 3, minXp: 200, tier: 'SILVER' },
    { level: 4, minXp: 400, tier: 'GOLD' },
    { level: 5, minXp: 700, tier: 'PLATINUM' },
    { level: 6, minXp: 1100, tier: 'OBSIDIAN' },
    { level: 7, minXp: 1600, tier: 'DIAMOND' },
    { level: 8, minXp: 2300, tier: 'DIAMOND' },
    { level: 9, minXp: 3200, tier: 'DIAMOND' },
  ];
  
  let newLevel = 1;
  let newTier = 'STANDARD';
  
  for (const t of LEVEL_TIERS) {
    if (lifetimeXp >= t.minXp) {
      newLevel = t.level;
      newTier = t.tier;
    }
  }
  
  // Update User Sheet
  const uSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const uData = uSheet.getDataRange().getValues();
  for (let i = 1; i < uData.length; i++) {
    if (uData[i][0] === uid) {
      uSheet.getRange(i + 1, 8).setValue(currentXp);   // currentXp
      uSheet.getRange(i + 1, 9).setValue(lifetimeXp);  // lifetimeXp
      uSheet.getRange(i + 1, 10).setValue(newLevel);   // level
      uSheet.getRange(i + 1, 11).setValue(newTier);    // tier
      uSheet.getRange(i + 1, 15).setValue(new Date().toISOString()); // updatedAt
      
      return getUser(uid); // Return updated user
    }
  }
}

function getFollowing(uid) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Follows');
  const data = sheet.getDataRange().getValues();
  const following = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uid) {
      following.push(data[i][1]); // card number
    }
  }
  return following;
}

function getFollowerCount(cardNumber) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Follows');
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === cardNumber) count++;
  }
  return count;
}

function getUserAchievements(uid) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('User_Achievements');
  const data = sheet.getDataRange().getValues();
  const unlocked = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uid) unlocked.push(data[i][1]);
  }
  return unlocked;
}
