/**
 * Verbose Firebase Error Interceptor Utility
 * 
 * Intercepts raw Firebase client and admin error codes, decodes them into
 * human-readable diagnostic messages, logs full contextual telemetry to console,
 * and marks circuit breakers when quotas are exhausted.
 */

import { markQuotaExceeded } from './quotaHelper';

export interface InterceptedFirebaseError {
  rawCode: string;
  rawMessage: string;
  context: string;
  category: 'QUOTA' | 'PERMISSIONS' | 'AUTH' | 'INDEX' | 'NETWORK' | 'UNKNOWN';
  title: string;
  humanExplanation: string;
  recommendedAction: string;
  timestamp: string;
}

const ERROR_CODE_MAP: Record<
  string,
  {
    category: InterceptedFirebaseError['category'];
    title: string;
    humanExplanation: string;
    recommendedAction: string;
  }
> = {
  // Firestore Quota Limits
  'resource-exhausted': {
    category: 'QUOTA',
    title: 'Daily Quota Exceeded (Resource Exhausted)',
    humanExplanation: 'The Firebase Firestore project has exceeded its daily free tier write/read limit.',
    recommendedAction: 'Automated local storage circuit breaker engaged. Local transactions will persist seamlessly until quota resets at midnight PST.',
  },
  '8': {
    category: 'QUOTA',
    title: 'Daily Write/Read Quota Limit',
    humanExplanation: 'Free daily write/read units per project cap reached.',
    recommendedAction: 'Local storage fallback is maintaining state. No action needed.',
  },

  // Security Rules & Permissions
  'permission-denied': {
    category: 'PERMISSIONS',
    title: 'Permission Denied',
    humanExplanation: 'Firestore Security Rules (firestore.rules) denied permission for this read or write operation.',
    recommendedAction: 'Verify user authentication token and update rules in firestore.rules if this collection should be accessible.',
  },
  '7': {
    category: 'PERMISSIONS',
    title: 'Permission Denied',
    humanExplanation: 'Access blocked by security policies.',
    recommendedAction: 'Check user credentials and security rules.',
  },

  // Composite Indexes & State Preconditions
  'failed-precondition': {
    category: 'INDEX',
    title: 'Missing Composite Index or Invalid State',
    humanExplanation: 'The Firestore query requires a composite index that has not been created yet in the Firebase Console.',
    recommendedAction: 'Open the URL printed in the raw error message to build the required composite index instantly in Firebase Console.',
  },
  '9': {
    category: 'INDEX',
    title: 'Failed Precondition',
    humanExplanation: 'Query requires an index or document preconditions were not met.',
    recommendedAction: 'Check composite index configurations in Firestore.',
  },

  // Firebase Authentication Rate Limits & Auth Errors
  'auth/too-many-requests': {
    category: 'AUTH',
    title: 'Authentication Rate Limited',
    humanExplanation: 'Too many sign-in or token validation requests were made from this IP address in a short interval.',
    recommendedAction: 'Wait 1-2 minutes before attempting another authentication action.',
  },
  'auth/quota-exceeded': {
    category: 'AUTH',
    title: 'Authentication Quota Exceeded',
    humanExplanation: 'Monthly sign-in or phone verification quotas reached for Firebase Auth Spark tier.',
    recommendedAction: 'Review sign-in loops or upgrade project auth tier.',
  },
  'auth/user-not-found': {
    category: 'AUTH',
    title: 'User Not Found',
    humanExplanation: 'No user account exists with the provided email address or UID.',
    recommendedAction: 'Check the email address or register a new user account.',
  },
  'auth/wrong-password': {
    category: 'AUTH',
    title: 'Incorrect Password',
    humanExplanation: 'The password supplied is invalid for this account.',
    recommendedAction: 'Verify user password or trigger password reset flow.',
  },
  'auth/invalid-credential': {
    category: 'AUTH',
    title: 'Invalid Credentials',
    humanExplanation: 'The authentication credentials provided are malformed or expired.',
    recommendedAction: 'Re-authenticate or sign in again.',
  },
  'auth/network-request-failed': {
    category: 'NETWORK',
    title: 'Auth Network Request Failed',
    humanExplanation: 'Unable to reach Firebase Authentication servers due to network issues or proxy block.',
    recommendedAction: 'Check connection or CORS configuration.',
  },

  // Service Availability
  'unavailable': {
    category: 'NETWORK',
    title: 'Service Temporarily Unavailable',
    humanExplanation: 'Firebase servers are currently unreachable or experiencing temporary downtime.',
    recommendedAction: 'Operations will automatically retry or defer to local cache.',
  },
  'unauthenticated': {
    category: 'AUTH',
    title: 'User Unauthenticated',
    humanExplanation: 'This operation requires a valid signed-in Firebase Auth user.',
    recommendedAction: 'Ensure user is signed in before executing transaction.',
  },
};

/**
 * Intercepts and parses raw Firebase errors into detailed diagnostic logs
 */
export function interceptFirebaseError(error: any, contextName = 'Firebase Operation'): InterceptedFirebaseError {
  const rawCode = String(error?.code || error?.status || 'unknown');
  const rawMessage = String(error?.message || error || 'No error message provided');

  let normalizedCode = rawCode.toLowerCase();
  if (rawMessage.includes('resource-exhausted') || rawMessage.includes('quota limit exceeded') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    normalizedCode = 'resource-exhausted';
    markQuotaExceeded(error);
  } else if (rawMessage.includes('permission-denied') || rawMessage.includes('PERMISSION_DENIED')) {
    normalizedCode = 'permission-denied';
  } else if (rawMessage.includes('failed-precondition') || rawMessage.includes('requires an index')) {
    normalizedCode = 'failed-precondition';
  }

  const lookupKey = Object.keys(ERROR_CODE_MAP).find(k => normalizedCode.includes(k.toLowerCase())) || 'unknown';
  const metadata = ERROR_CODE_MAP[lookupKey] || {
    category: 'UNKNOWN',
    title: 'Unhandled Firebase Error',
    humanExplanation: `An unexpected Firebase error occurred: ${rawMessage}`,
    recommendedAction: 'Check browser dev console or run "node firebaseDiagnostics.js" for details.',
  };

  const intercepted: InterceptedFirebaseError = {
    rawCode,
    rawMessage,
    context: contextName,
    category: metadata.category,
    title: metadata.title,
    humanExplanation: metadata.humanExplanation,
    recommendedAction: metadata.recommendedAction,
    timestamp: new Date().toISOString(),
  };

  // Verbose Console Diagnostic Logging
  console.group(`[Firebase Error Interceptor] ${contextName}: ${intercepted.title}`);
  console.warn(`[Error Code]: ${intercepted.rawCode}`);
  console.warn(`[Category]: ${intercepted.category}`);
  console.warn(`[Explanation]: ${intercepted.humanExplanation}`);
  console.warn(`[Recommendation]: ${intercepted.recommendedAction}`);
  console.warn(`[Raw Error]:`, error);
  console.groupEnd();

  return intercepted;
}

/**
 * Wrapper function for executing Firebase operations (Market, Auth, Boutique) with built-in error interception
 */
export async function withErrorInterceptor<T>(
  fn: () => Promise<T>,
  contextName = 'Firebase Action',
  fallbackValue: T | null = null
): Promise<{ data: T | null; error: InterceptedFirebaseError | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err: any) {
    const intercepted = interceptFirebaseError(err, contextName);
    return { data: fallbackValue, error: intercepted };
  }
}
