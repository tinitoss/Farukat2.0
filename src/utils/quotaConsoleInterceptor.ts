// Intercept and swallow expected Firestore Quota limit and gRPC stream reset console errors before any Firebase package evaluates
if (typeof window !== 'undefined') {
  const isIgnoredFirestoreMessage = (args: any[]): boolean => {
    if (!args || !args.length) return false;
    try {
      const fullStr = args
        .map((a) => {
          if (!a) return '';
          if (typeof a === 'string') return a;
          try {
            return `${a.message || ''} ${a.code || ''} ${a.name || ''} ${a.stack || ''} ${JSON.stringify(a)}`;
          } catch (e) {
            return String(a);
          }
        })
        .join(' ')
        .toLowerCase();

      return (
        fullStr.includes('resource-exhausted') ||
        fullStr.includes('resource_exhausted') ||
        fullStr.includes('quota limit exceeded') ||
        fullStr.includes('quota exceeded') ||
        fullStr.includes('exceeded quota') ||
        fullStr.includes('grpcconnection') ||
        fullStr.includes('rpc \'listen\'') ||
        fullStr.includes('rpc \'write\'') ||
        fullStr.includes('econnreset') ||
        fullStr.includes('unavailable') ||
        fullStr.includes('code: 14') ||
        fullStr.includes('code 14') ||
        fullStr.includes('backoff delay')
      );
    } catch (err) {
      return false;
    }
  };

  const markQuota = () => {
    // No-op to prevent locking UI
  };

  const methods = ['error', 'warn', 'log', 'info', 'debug'] as const;
  methods.forEach((method) => {
    const orig = (console as any)[method];
    (console as any)[method] = function (...args: any[]) {
      if (isIgnoredFirestoreMessage(args)) {
        markQuota();
        return;
      }
      if (orig) {
        orig.apply(console, args);
      }
    };
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isIgnoredFirestoreMessage([event.reason, event.reason?.message, event.reason?.stack])) {
      event.preventDefault();
      markQuota();
    }
  });

  window.addEventListener(
    'error',
    (event) => {
      if (isIgnoredFirestoreMessage([event.message, event.error])) {
        event.preventDefault();
        markQuota();
      }
    },
    true
  );
}


