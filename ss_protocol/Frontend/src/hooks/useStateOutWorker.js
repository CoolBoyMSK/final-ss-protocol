/**
 * useStateOutWorker Hook
 * Provides a React hook to calculate "STATE out to users" via Web Worker
 * 
 * Features:
 * - Background calculation via Web Worker (doesn't block UI)
 * - Reset/checkpoint support via localStorage
 * - Progress reporting during scan
 * - Aggressive caching of results
 * - Smart default start block (recent blocks only for speed)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getContractAddress, CHAIN_IDS } from '../Constants/ContractAddresses';
import { getRuntimeConfigSync } from '../Constants/RuntimeConfig';
import { useDeploymentStore } from '../stores';

// LocalStorage keys
const STORAGE_KEY_RESET_BLOCK_BASE = 'stateOutResetBlock';
const STORAGE_KEY_CACHED_RESULT_BASE = 'stateOutCachedResult';

// Default: start from ~7 days ago (faster initial load)
// PulseChain: ~3 second blocks, 7 days = ~201,600 blocks
const DEFAULT_LOOKBACK_BLOCKS = 201600;

/**
 * Hook to calculate STATE out to users since last reset
 * @param {object} options - Configuration options
 * @param {number} options.chainId - Chain ID (default: 369 for PulseChain)
 * @param {boolean} options.autoStart - Auto-start calculation on mount
 * @param {number} options.refreshInterval - Auto-refresh interval in ms (0 = disabled)
 */
export function useStateOutWorker(options = {}) {
  const {
    chainId = CHAIN_IDS.PULSECHAIN,
    autoStart = false,
    refreshInterval = 0
  } = options;
  const selectedDavId = useDeploymentStore((state) => state.selectedDavId);

  const storageKeyResetBlock = `${STORAGE_KEY_RESET_BLOCK_BASE}_${Number(chainId || 0)}_${String(selectedDavId || 'DAV1').toUpperCase()}`;
  const storageKeyCachedResult = `${STORAGE_KEY_CACHED_RESULT_BASE}_${Number(chainId || 0)}_${String(selectedDavId || 'DAV1').toUpperCase()}`;

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [resetBlock, setResetBlock] = useState(null);
  
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const hasInitialized = useRef(false);

  // Get contract addresses
  const getAddresses = useCallback(() => {
    const cfg = getRuntimeConfigSync();
    return {
      rpcUrl: cfg?.network?.rpcUrl || 'https://rpc.pulsechain.com',
      swapV3Address: cfg?.contracts?.core?.SWAP_V3?.address || 
                     getContractAddress(chainId, 'AUCTION'),
      stateAddress: cfg?.contracts?.core?.STATE_V3?.address ||
                    getContractAddress(chainId, 'STATE_TOKEN')
    };
  }, [chainId]);

  // Initialize worker
  useEffect(() => {
    // Create worker - don't use type: 'module' since worker has no ES imports
    try {
      workerRef.current = new Worker(
        new URL('../workers/stateOutCalculator.worker.js', import.meta.url)
      );
      console.log('[StateOutWorker] Worker object created');
    } catch (err) {
      console.error('[StateOutWorker] Failed to create worker:', err);
      return;
    }

    // Handle messages from worker
    workerRef.current.onmessage = (event) => {
      const { type, result: workerResult, error: workerError, progress: workerProgress, requestId } = event.data;

      console.log('[StateOutWorker] Received message:', type, workerResult || workerError || workerProgress);

      if (type === 'WORKER_READY') {
        console.log('[StateOutWorker] Worker is ready!');
      }

      if (type === 'PROGRESS') {
        setProgress(workerProgress || 0);
      }

      if (type === 'STATE_OUT_RESULT') {
        console.log('[StateOutWorker] Got result:', workerResult);
        setResult(workerResult);
        setLoading(false);
        setProgress(100);
        // Cache result for 30 minutes
        try {
          localStorage.setItem(storageKeyCachedResult, JSON.stringify({
            ...workerResult,
            cachedAt: Date.now()
          }));
        } catch {}
      }

      if (type === 'STATE_OUT_ERROR') {
        console.error('[StateOutWorker] Error:', workerError);
        setError(workerError);
        setLoading(false);
      }
    };

    workerRef.current.onerror = (err) => {
      console.error('[StateOutWorker] Worker error event:', err);
      setError(err.message || 'Worker error');
      setLoading(false);
    };

    // Load reset block from storage
    let savedResetBlock = null;
    try {
      const saved = localStorage.getItem(storageKeyResetBlock);
      if (saved) {
        savedResetBlock = parseInt(saved, 10);
        setResetBlock(savedResetBlock);
      }
      
      // Load cached result - use if less than 30 minutes old (as initial display while recalculating)
      const cachedResult = localStorage.getItem(storageKeyCachedResult);
      if (cachedResult) {
        const parsed = JSON.parse(cachedResult);
        if (parsed.cachedAt && Date.now() - parsed.cachedAt < 30 * 60 * 1000) {
          setResult(parsed);
          // Note: Don't set hasInitialized - let auto-start trigger a fresh calculation
        }
      }
    } catch {}

    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [getAddresses, storageKeyResetBlock, storageKeyCachedResult]);

  // Calculate STATE out
  const calculate = useCallback(async (fromBlockOverride) => {
    if (!workerRef.current) {
      console.warn('[StateOutWorker] Worker not initialized');
      return;
    }
    if (loading) {
      console.warn('[StateOutWorker] Already loading, skipping');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    console.log('[StateOutWorker] Starting calculation...');
    
    // Determine start block
    let fromBlock = fromBlockOverride ?? resetBlock;
    const addrs = getAddresses();
    
    // If no reset block set, use smart default (recent blocks only)
    if (fromBlock == null || fromBlock === 0) {
      try {
        const response = await fetch(addrs.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          })
        });
        const data = await response.json();
        const currentBlock = parseInt(data.result, 16);
        fromBlock = Math.max(0, currentBlock - DEFAULT_LOOKBACK_BLOCKS);
        console.log('[StateOutWorker] Using default lookback, fromBlock:', fromBlock, 'currentBlock:', currentBlock);
      } catch (err) {
        console.error('[StateOutWorker] Failed to get current block:', err);
        fromBlock = 0;
      }
    }
    
    console.log('[StateOutWorker] Posting message to worker, fromBlock:', fromBlock);
    requestIdRef.current += 1;
    workerRef.current.postMessage({
      type: 'CALCULATE_STATE_OUT',
      options: {
        rpcUrl: addrs.rpcUrl,
        swapV3Address: addrs.swapV3Address,
        stateAddress: addrs.stateAddress,
        fromBlock,
        toBlock: 'latest'
      },
      requestId: requestIdRef.current
    });
  }, [loading, resetBlock, getAddresses]);

  // Reset counter (set new checkpoint block)
  const resetCounter = useCallback(async () => {
    try {
      const addrs = getAddresses();
      // Get current block from RPC
      const response = await fetch(addrs.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      });
      const data = await response.json();
      const currentBlock = parseInt(data.result, 16);
      
      // Save reset block
      localStorage.setItem(storageKeyResetBlock, currentBlock.toString());
      setResetBlock(currentBlock);
      
      // Clear cached result and set to 0
      const newResult = {
        totalStateOutWei: '0',
        totalStateOut: 0,
        eventCount: 0,
        fromBlock: currentBlock,
        toBlock: currentBlock,
        timestamp: Date.now(),
        cachedAt: Date.now()
      };
      localStorage.setItem(storageKeyCachedResult, JSON.stringify(newResult));
      setResult(newResult);
      
      return currentBlock;
    } catch (err) {
      console.error('Failed to reset counter:', err);
      throw err;
    }
  }, [getAddresses, storageKeyResetBlock, storageKeyCachedResult]);

  // Clear reset (start from default lookback)
  const clearReset = useCallback(() => {
    localStorage.removeItem(storageKeyResetBlock);
    localStorage.removeItem(storageKeyCachedResult);
    setResetBlock(null);
    setResult(null);
  }, [storageKeyResetBlock, storageKeyCachedResult]);

  useEffect(() => {
    hasInitialized.current = false;
    setLoading(false);
    setProgress(0);
    setError(null);
    setResult(null);
    setResetBlock(null);
  }, [chainId, selectedDavId]);

  // Auto-start calculation (only once per mount)
  useEffect(() => {
    if (autoStart && !loading && !hasInitialized.current) {
      hasInitialized.current = true;
      // Small delay to ensure worker is ready
      const timer = setTimeout(() => {
        calculate();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoStart, loading, calculate]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0 && !loading) {
      const interval = setInterval(() => {
        calculate();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loading, calculate]);

  return {
    loading,
    progress,
    error,
    result,
    resetBlock,
    calculate,
    resetCounter,
    clearReset,
    // Convenience getters
    totalStateOut: result?.totalStateOut ?? null,
    totalStateOutWei: result?.totalStateOutWei ?? null,
    eventCount: result?.eventCount ?? 0,
    lastUpdated: result?.timestamp ? new Date(result.timestamp) : null
  };
}

export default useStateOutWorker;
