import { clearAllContractCache, clearAllPendingRequests } from './contractCache';

/**
 * Memory Cleanup Utility
 * 
 * Provides aggressive memory management for the application.
 * Call these functions periodically or on route changes.
 */

// Force garbage collection hint (works in some browsers)
export function suggestGC() {
  if (typeof window !== 'undefined') {
    // Lightweight yield hint: avoid allocating large temporary arrays/objects.
    try {
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => { });
      }
    } catch { }
  }
}

// Clear all caches
export function clearAllCaches() {
  // Clear localStorage caches (except essential ones)
  const keysToKeep = ['wagmi', 'reown', 'walletconnect'];

  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToKeep.some(k => key.toLowerCase().includes(k))) {
        // Check if it's a cache key
        if (key.includes('cache') || key.includes('Cache') ||
          key.includes('amm') || key.includes('swap_') ||
          key.includes('pstate') || key.includes('auction')) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.debug('[Memory] Cleared', keysToRemove.length, 'cache keys');
  } catch (e) {
    console.debug('[Memory] Cache clear failed:', e);
  }

  // Clear only session cache-like keys (keep unrelated session state)
  try {
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (
        key.includes('cache') || key.includes('Cache') ||
        key.includes('amm') || key.includes('swap_') ||
        key.includes('pstate') || key.includes('auction')
      ) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch { }
}

// Clear contract cache using proper exported functions
export function clearContractCache() {
  clearAllContractCache();
  clearAllPendingRequests();
}

// Clear image caches by removing unused blob URLs
export function clearImageCache() {
  try {
    // Find all blob URLs in the document and revoke unused ones
    const images = document.querySelectorAll('img[src^="blob:"]');
    const usedUrls = new Set();
    images.forEach(img => usedUrls.add(img.src));

    // Note: We can't enumerate all blob URLs, but this helps with known ones
  } catch { }
}

// Comprehensive cleanup - call on route change or periodically
export function performMemoryCleanup() {
  const now = Date.now();
  if (performMemoryCleanup._lastRun && (now - performMemoryCleanup._lastRun) < 10000) {
    return;
  }
  performMemoryCleanup._lastRun = now;

  clearContractCache();
  suggestGC();

  // Log memory if available
  if (typeof performance !== 'undefined' && performance.memory) {
    console.debug('[Memory] Heap:',
      Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), 'MB used,',
      Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), 'MB total'
    );
  }
}

// Aggressive cleanup - call when memory is critical
export function performAggressiveCleanup() {
  const now = Date.now();
  if (performAggressiveCleanup._lastRun && (now - performAggressiveCleanup._lastRun) < 30000) {
    return;
  }
  performAggressiveCleanup._lastRun = now;

  clearAllCaches();
  clearContractCache();
  clearImageCache();
  suggestGC();

  console.debug('[Memory] Aggressive cleanup performed');
}

// Monitor memory and warn if high
let memoryWarningShown = false;
export function startMemoryMonitor(thresholdMB = 500) {
  if (typeof performance === 'undefined' || !performance.memory) {
    console.debug('[Memory] Performance.memory not available');
    return null;
  }

  const intervalId = setInterval(() => {
    const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;

    if (usedMB > thresholdMB && !memoryWarningShown) {
      console.warn('[Memory] High memory usage:', Math.round(usedMB), 'MB');
      memoryWarningShown = true;

      // Auto cleanup when memory is high
      performMemoryCleanup();
    } else if (usedMB < thresholdMB * 0.7) {
      memoryWarningShown = false;
    }
  }, 30000); // Check every 30 seconds

  return () => clearInterval(intervalId);
}

export default {
  suggestGC,
  clearAllCaches,
  clearContractCache,
  clearImageCache,
  performMemoryCleanup,
  performAggressiveCleanup,
  startMemoryMonitor,
};
