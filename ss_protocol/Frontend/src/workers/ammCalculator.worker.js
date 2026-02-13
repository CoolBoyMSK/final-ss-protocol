/**
 * AMM Calculator Web Worker
 * Runs all expensive AMM calculations in background thread
 * to prevent UI blocking and memory issues
 */

import { ethers } from 'ethers';

// PulseX Router ABI (minimal)
const PULSEX_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
];

const DEFAULT_ROUTER_ADDRESS = '';
// Defaults only (can be overridden per request via options)
const DEFAULT_WPLS_ADDRESS = '';
const DEFAULT_STATE_ADDRESS = '';

// RPC endpoint for background calculations
const DEFAULT_RPC_URL = 'https://rpc.pulsechain.com';

let provider = null;
let routerContract = null;
let providerRpcUrl = null;
let routerAddress = null;

function normalizeAddress(address) {
  if (!address) return '';
  try {
    return ethers.getAddress(address);
  } catch {
    return '';
  }
}

// Initialize provider and contract
function initProvider(activeRpcUrl, activeRouterAddress) {
  if (!provider || providerRpcUrl !== activeRpcUrl) {
    provider = new ethers.JsonRpcProvider(activeRpcUrl);
    providerRpcUrl = activeRpcUrl;
    routerContract = null;
    routerAddress = null;
  }
  if (!routerContract || routerAddress !== activeRouterAddress) {
    routerContract = new ethers.Contract(
      activeRouterAddress,
      PULSEX_ROUTER_ABI,
      provider
    );
    routerAddress = activeRouterAddress;
  }
  return { provider, routerContract };
}

// Calculate TOKEN -> STATE output (wei)
async function calculateTokenStateWei(tokenAddress, balance, stateAddress, activeRpcUrl, activeRouterAddress, decimals = 18) {
  if (!balance || balance === '0' || !tokenAddress) return 0n;

  try {
    const { routerContract } = initProvider(activeRpcUrl, activeRouterAddress);
    const balanceWei = ethers.parseUnits(String(balance), decimals);
    if (balanceWei === 0n) return 0n;

    const path = [tokenAddress, stateAddress];
    const amounts = await routerContract.getAmountsOut(balanceWei, path);
    return amounts[amounts.length - 1] || 0n;
  } catch {
    return 0n;
  }
}

function formatWeiToIntegerWithCommas(wei) {
  try {
    if (wei === 0n) return '0';
    const full = ethers.formatEther(wei);
    const intPart = full.split('.')[0] || '0';
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } catch {
    return '0';
  }
}

function formatWeiToDisplay(wei) {
  try {
    if (wei === 0n) return '0';
    const full = ethers.formatEther(wei);
    const [intPart, decPart = ''] = full.split('.');
    const intNum = intPart || '0';
    if (intNum !== '0') {
      return intNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    const dec4 = (decPart + '0000').slice(0, 4);
    return `0.${dec4}`;
  } catch {
    return '0';
  }
}

async function calculateAllAmmValuesWithOptions(tokens, tokenBalances, options) {
  const onlyTotal = Boolean(options?.onlyTotal);
  const activeRpcUrl = options?.rpcUrl || DEFAULT_RPC_URL;
  const activeRouterAddress = normalizeAddress(options?.routerAddress || DEFAULT_ROUTER_ADDRESS);

  if (!activeRouterAddress) {
    throw new Error('Missing routerAddress for AMM worker');
  }

  const stateAddress = normalizeAddress(options?.stateAddress || DEFAULT_STATE_ADDRESS);
  const wplsAddress = normalizeAddress(options?.wplsAddress || DEFAULT_WPLS_ADDRESS);
  if (!stateAddress || !wplsAddress) {
    throw new Error('Missing stateAddress/wplsAddress for AMM worker');
  }
  const results = {};
  let totalStateWei = 0n;

  // Full parallel calculation (fastest wall-clock time; may increase RPC load)
  const perTokenResults = await Promise.all(tokens.map(async (token) => {
    const tokenName = token.tokenName;
    const balance = tokenBalances?.[tokenName];

    if (tokenName === 'DAV') {
      return { tokenName, numeric: 0, display: '-----', stateWei: 0n };
    }

    if (tokenName === 'STATE') {
      const result = { numeric: 0, display: onlyTotal ? '0' : '0', stateWei: 0n, plsWei: 0n };
      try {
        const stateWei = ethers.parseUnits(String(balance || '0'), 18);
        return { tokenName, ...result, stateWei };
      } catch {
        return { tokenName, ...result, stateWei: 0n };
      }
    }

    if (!balance || !token.TokenAddress) {
      return { tokenName, numeric: 0, display: '0', stateWei: 0n };
    }

    // Always compute TOKEN -> STATE for totals.
    // Only compute TOKEN -> WPLS display values when needed.
    const stateWei = await calculateTokenStateWei(token.TokenAddress, balance, stateAddress, activeRpcUrl, activeRouterAddress);
    return { tokenName, numeric: 0, display: onlyTotal ? '0' : '0', stateWei };
  }));

  const stateWeiByToken = {};
  for (const result of perTokenResults) {
    stateWeiByToken[result.tokenName] = result.stateWei || 0n;
    if (result.tokenName !== 'DAV') {
      totalStateWei += result.stateWei || 0n;
    }
  }

  // Convert aggregated STATE total into PLS once
  let totalSum = '0';
  let totalPlsWei = 0n;
  try {
    if (totalStateWei > 0n) {
      const { routerContract } = initProvider(activeRpcUrl, activeRouterAddress);
      const path = [stateAddress, wplsAddress];
      const amounts = await routerContract.getAmountsOut(totalStateWei, path);
      totalPlsWei = amounts[amounts.length - 1] || 0n;
      totalSum = formatWeiToIntegerWithCommas(totalPlsWei);
    }
  } catch {
    totalSum = '0';
    totalPlsWei = 0n;
  }

  if (!onlyTotal) {
    for (const token of tokens) {
      const tokenName = token.tokenName;
      if (tokenName === 'DAV') {
        results[tokenName] = '-----';
        continue;
      }

      const tokenStateWei = stateWeiByToken[tokenName] || 0n;
      if (tokenStateWei === 0n) {
        results[tokenName] = '0';
        continue;
      }

      if (tokenName === 'STATE') {
        // STATE row shows STATE -> PLS (matches STATE/WPLS DEX)
        try {
          const { routerContract } = initProvider(activeRpcUrl, activeRouterAddress);
          const path = [stateAddress, wplsAddress];
          const amounts = await routerContract.getAmountsOut(tokenStateWei, path);
          const plsWei = amounts[amounts.length - 1] || 0n;
          results[tokenName] = formatWeiToDisplay(plsWei);
        } catch {
          results[tokenName] = '0';
        }
        continue;
      }

      // Non-STATE tokens show TOKEN -> STATE value
      results[tokenName] = formatWeiToDisplay(tokenStateWei);
    }
  }

  return {
    values: results,
    totalSum,
    timestamp: Date.now()
  };
}

// Handle messages from main thread
self.onmessage = async function(event) {
  const { type, tokens, tokenBalances, options, requestId } = event.data;
  
  if (type === 'CALCULATE_AMM') {
    try {
      const result = await calculateAllAmmValuesWithOptions(tokens, tokenBalances, options);
      self.postMessage({
        type: 'AMM_RESULT',
        result,
        requestId
      });
    } catch (error) {
      self.postMessage({
        type: 'AMM_ERROR',
        error: error.message,
        requestId
      });
    }
  }
};

// Signal worker is ready
self.postMessage({ type: 'WORKER_READY' });
