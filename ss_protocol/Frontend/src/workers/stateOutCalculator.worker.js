/**
 * STATE Out Calculator Web Worker
 * Calculates "STATE out to users" from auction events in background thread
 * 
 * This worker scans TokensSwapped events from SWAP_V3 contract and sums only:
 * - Normal Auction Step 2: burnTokensForState() → user receives STATE
 * - Reverse Auction Step 1: reverseSwapTokensForState() → user receives STATE
 * 
 * Uses pure fetch API (no external dependencies) for Web Worker compatibility
 */

// Default RPC endpoints for fallback if request doesn't pass one
const DEFAULT_RPC_ENDPOINTS = [
  'https://rpc.pulsechain.com',
  'https://pulsechain-rpc.publicnode.com',
  'https://rpc-pulsechain.g4mm4.io'
];

let activeRpcEndpoints = [...DEFAULT_RPC_ENDPOINTS];

// Contract addresses must be passed from main thread runtime config
const DEFAULT_SWAP_V3_ADDRESS = '';
const DEFAULT_STATE_ADDRESS = '';

// TokensSwapped event topic (keccak256 of signature)
// event TokensSwapped(address indexed user, address indexed inputToken, address indexed stateToken, uint256 amountIn, uint256 amountOut)
const TOKENS_SWAPPED_TOPIC = '0xad56699d0f375866eb895ed27203058a36a713382aaded78eb6b67da266d4332';

let currentRpcIndex = 0;

function getCurrentRpc() {
  return activeRpcEndpoints[currentRpcIndex];
}

function switchRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % activeRpcEndpoints.length;
  console.log('[Worker] Switched to RPC:', getCurrentRpc());
  return getCurrentRpc();
}

function normalizeRpcEndpoints(options = {}) {
  const fromArray = Array.isArray(options.rpcUrls) ? options.rpcUrls.filter(Boolean) : [];
  const fromSingle = options.rpcUrl ? [options.rpcUrl] : [];
  const next = [...fromArray, ...fromSingle];
  activeRpcEndpoints = next.length ? next : [...DEFAULT_RPC_ENDPOINTS];
  currentRpcIndex = 0;
}

function toStateTopicPadded(address) {
  const clean = String(address || '').toLowerCase().replace(/^0x/, '');
  if (clean.length !== 40) return null;
  return `0x${'0'.repeat(24)}${clean}`;
}

/**
 * Make JSON-RPC call
 */
async function rpcCall(method, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(getCurrentRpc(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'RPC error');
      }
      
      return data.result;
    } catch (err) {
      console.warn(`[Worker] RPC call failed (attempt ${i + 1}):`, err.message);
      if (i < retries - 1) {
        switchRpc();
        await new Promise(r => setTimeout(r, 500));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Get current block number
 */
async function getBlockNumber() {
  const result = await rpcCall('eth_blockNumber', []);
  return parseInt(result, 16);
}

/**
 * Get logs for a block range
 */
async function getLogs(fromBlock, toBlock, address, topics) {
  const params = [{
    address,
    fromBlock: '0x' + fromBlock.toString(16),
    toBlock: '0x' + toBlock.toString(16),
    topics
  }];
  
  return await rpcCall('eth_getLogs', params);
}

/**
 * Fetch logs in chunks with progress updates
 */
async function fetchLogsInChunks(fromBlock, toBlock, address, topics, chunkSize = 50000) {
  const allLogs = [];
  const totalBlocks = toBlock - fromBlock;
  let processedBlocks = 0;
  
  let currentFrom = fromBlock;
  
  while (currentFrom <= toBlock) {
    const currentTo = Math.min(currentFrom + chunkSize - 1, toBlock);
    
    try {
      const logs = await getLogs(currentFrom, currentTo, address, topics);
      if (logs && logs.length > 0) {
        allLogs.push(...logs);
      }
    } catch (err) {
      console.warn(`[Worker] Failed to fetch ${currentFrom}-${currentTo}:`, err.message);
      // Try with smaller chunk
      if (chunkSize > 5000) {
        const smallerLogs = await fetchLogsInChunks(currentFrom, currentTo, address, topics, Math.floor(chunkSize / 5));
        allLogs.push(...smallerLogs);
      }
    }
    
    processedBlocks += (currentTo - currentFrom + 1);
    const progress = Math.min(99, Math.round((processedBlocks / totalBlocks) * 100));
    self.postMessage({ type: 'PROGRESS', progress });
    
    currentFrom = currentTo + 1;
  }
  
  return allLogs;
}

/**
 * Parse amountOut from log data
 * Data format: 0x + 64 hex chars (amountIn) + 64 hex chars (amountOut)
 */
function parseAmountOut(data) {
  if (!data || data.length < 130) return 0n;
  
  // amountOut is the second 32-byte value (chars 66-130)
  const amountOutHex = data.slice(66, 130);
  return BigInt('0x' + amountOutHex);
}

/**
 * Format wei to ether (18 decimals)
 */
function formatEther(wei) {
  const weiStr = wei.toString();
  if (weiStr === '0') return 0;
  
  const padded = weiStr.padStart(19, '0');
  const intPart = padded.slice(0, -18) || '0';
  const decPart = padded.slice(-18);
  
  return parseFloat(intPart + '.' + decPart);
}

/**
 * Calculate STATE out to users since a given block
 */
async function calculateStateOutSinceBlock(options = {}) {
  const {
    swapV3Address = DEFAULT_SWAP_V3_ADDRESS,
    stateAddress = DEFAULT_STATE_ADDRESS,
    fromBlock = 0,
    toBlock = 'latest'
  } = options;

  normalizeRpcEndpoints(options);

  if (!swapV3Address || !stateAddress) {
    throw new Error('Missing swapV3Address/stateAddress for stateOut calculation');
  }

  const stateTopicPadded = toStateTopicPadded(stateAddress);
  if (!stateTopicPadded) {
    throw new Error('Invalid stateAddress for topic filtering');
  }

  console.log('[Worker] calculateStateOutSinceBlock called with:', { swapV3Address, stateAddress, fromBlock, toBlock });

  // Get current block if toBlock is 'latest'
  let endBlock = toBlock;
  if (toBlock === 'latest') {
    endBlock = await getBlockNumber();
    console.log('[Worker] Current block:', endBlock);
  }
  
  // Topics filter:
  // topic0 = event signature
  // topic1 = user (any)
  // topic2 = inputToken (any)  
  // topic3 = stateToken = STATE address (user receives STATE)
  const topics = [
    TOKENS_SWAPPED_TOPIC,
    null,
    null,
    stateTopicPadded
  ];
  
  console.log('[Worker] Fetching logs from block', fromBlock, 'to', endBlock);
  
  // Fetch logs
  const logs = await fetchLogsInChunks(fromBlock, endBlock, swapV3Address.toLowerCase(), topics, 50000);
  
  console.log('[Worker] Found', logs.length, 'events');
  
  // Sum amountOut (STATE sent to user)
  let totalStateOutWei = 0n;
  let eventCount = 0;
  
  for (const log of logs) {
    try {
      const amountOut = parseAmountOut(log.data);
      if (amountOut > 0n) {
        totalStateOutWei += amountOut;
        eventCount++;
      }
    } catch (err) {
      console.warn('[Worker] Error parsing log:', err);
    }
  }
  
  // The events log amount AFTER 0.5% fee deduction
  // To get original STATE out (including fee), divide by 0.995
  // Original = AmountAfterFee / 0.995
  const totalStateOutAfterFee = formatEther(totalStateOutWei);
  const totalStateOut = totalStateOutAfterFee / 0.995; // Add back the 0.5% fee
  
  console.log('[Worker] Total STATE out (after fee):', totalStateOutAfterFee, 'from', eventCount, 'events');
  console.log('[Worker] Total STATE out (including 0.5% fee):', totalStateOut);
  
  return {
    totalStateOutWei: totalStateOutWei.toString(),
    totalStateOut, // This now includes the 0.5% fee
    totalStateOutAfterFee, // Original amount without fee adjustment
    eventCount,
    fromBlock,
    toBlock: endBlock,
    timestamp: Date.now()
  };
}

// Handle messages from main thread
self.onmessage = async function(event) {
  const { type, options, requestId } = event.data;
  
  console.log('[Worker] Received message:', type, options);
  
  if (type === 'CALCULATE_STATE_OUT') {
    try {
      console.log('[Worker] Starting calculation...');
      self.postMessage({ type: 'PROGRESS', progress: 0, requestId });
      const result = await calculateStateOutSinceBlock(options);
      console.log('[Worker] Calculation complete:', result);
      self.postMessage({
        type: 'STATE_OUT_RESULT',
        result,
        requestId
      });
    } catch (error) {
      console.error('[Worker] Error:', error);
      self.postMessage({
        type: 'STATE_OUT_ERROR',
        error: error.message || String(error),
        requestId
      });
    }
  }
};

// Signal worker is ready
console.log('[Worker] STATE Out Calculator Worker initialized (pure fetch version)');
self.postMessage({ type: 'WORKER_READY' });
