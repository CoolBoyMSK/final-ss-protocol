let runtimeConfig = null;
let runtimeRegistry = null;
let loadPromise = null;

let selectedDavId = 'DAV1';
let selectedChainId = null;

export const PULSECHAIN_RPC_URLS = [
  'https://pulsechain-rpc.publicnode.com',
  'https://rpc-pulsechain.g4mm4.io',
  'https://rpc.pulsechain.com',
];

const DEFAULT_RPC_URL = 'https://pulsechain-rpc.publicnode.com';

const DEFAULTS = {
  network: { chainId: 369, name: 'PulseChain Mainnet', rpcUrl: DEFAULT_RPC_URL, rpcUrls: PULSECHAIN_RPC_URLS, explorerUrl: 'https://scan.pulsechain.com', symbolPrefix: 'p' },
  contracts: {
    core: {
      SWAP_V3: { address: '0xFEF68179BE7150eAd7a766331d0087Ee26f06098' },
      STATE_V3: { address: '0x322cEA42A77C2f18B8e79Cc46efBacf73b6a8E6B', symbol: 'pSTATE01', name: 'PulseSTATE01', decimals: 18 },
      DAV_V3: { address: '0x354BfD4318bfA8FA53f738376E3Bac62B94De677', symbol: 'pDAV01', name: 'PulseDAV01', decimals: 18 },
    },
    support: {
      SwapLens: { address: '0x50069641aB76E36E9cD41e11293bc354b5a6f27A' },
      BuyAndBurnController: { address: '0xEa6d3ECE832743fbE7416D0841674625609CFDcA' }
    },
    stages: {
      AirdropDistributor: { address: '0x5F85b7c4493EA9363DD353eaA16472c5Ac437509' },
      AuctionAdmin: { address: '0x5A7Ab76985b5Fe102a5d77fA052566A92c3844B3' }
    },
  },
  dex: {
    router: { address: '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02' },
    factory: { address: '0x1715a3E4A142d8b698131108995174F37aEBA10D' },
    baseToken: { address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', symbol: 'WPLS', decimals: 18 },
  },
  selection: { davId: 'DAV1' }
};

const DEFAULT_REGISTRY = {
  version: 1,
  defaultSelection: { chainId: 369, davId: 'DAV1' },
  networks: {
    '369': {
      chainId: 369,
      name: 'PulseChain Mainnet',
      symbolPrefix: 'p',
      rpcUrl: DEFAULT_RPC_URL,
      rpcUrls: PULSECHAIN_RPC_URLS,
      explorerUrl: 'https://scan.pulsechain.com',
      deployments: {
        DAV1: { contracts: DEFAULTS.contracts, dex: DEFAULTS.dex },
        DAV2: {
          contracts: {
            core: {
              SWAP_V3: { address: '' },
              STATE_V3: { address: '', symbol: 'pSTATE02', name: 'PulseSTATE02', decimals: 18 },
              DAV_V3: { address: '', symbol: 'pDAV02', name: 'PulseDAV02', decimals: 18 },
            },
            support: {
              SwapLens: { address: '' },
              BuyAndBurnController: { address: '' }
            },
            stages: {
              AirdropDistributor: { address: '' },
              AuctionAdmin: { address: '' }
            },
          },
          dex: DEFAULTS.dex,
        },
        DAV3: {
          contracts: {
            core: {
              SWAP_V3: { address: '' },
              STATE_V3: { address: '', symbol: 'pSTATE03', name: 'PulseSTATE03', decimals: 18 },
              DAV_V3: { address: '', symbol: 'pDAV03', name: 'PulseDAV03', decimals: 18 },
            },
            support: {
              SwapLens: { address: '' },
              BuyAndBurnController: { address: '' }
            },
            stages: {
              AirdropDistributor: { address: '' },
              AuctionAdmin: { address: '' }
            },
          },
          dex: DEFAULTS.dex,
        },
      }
    }
  }
};

const KNOWN_CHAIN_NAMES = {
  1: 'Ethereum Mainnet',
  137: 'Polygon Mainnet',
  146: 'Sonic Mainnet',
  369: 'PulseChain Mainnet',
  943: 'PulseChain Testnet',
};

const readAddress = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.address || '';
  return '';
};

const hasAddress = (value) => {
  const addr = readAddress(value);
  return Boolean(addr && /^0x[a-fA-F0-9]{40}$/.test(addr));
};

const normalizeRpcUrls = (...rpcSources) => [...new Set(rpcSources
  .flatMap((source) => {
    if (Array.isArray(source)) return source;
    if (typeof source === 'string' && source) return [source];
    return [];
  })
  .filter(Boolean))];

const composeRuntimeFromRegistry = (registry, chainId, davId) => {
  const safeRegistry = registry || DEFAULT_REGISTRY;
  const availableNetworks = safeRegistry?.networks || {};
  const fallbackChainId = Number(safeRegistry?.defaultSelection?.chainId || 369);
  const effectiveChainId = Number(chainId || fallbackChainId);

  const networkEntry = availableNetworks[String(effectiveChainId)] || null;

  const resolvedDavId = davId || safeRegistry?.defaultSelection?.davId || 'DAV1';
  const deployment = networkEntry?.deployments?.[resolvedDavId] || { contracts: {}, dex: {} };
  const resolvedRpcUrls = normalizeRpcUrls(
    networkEntry?.rpcUrls,
    networkEntry?.rpcUrl,
    Number(networkEntry?.chainId || effectiveChainId || 0) === 369 ? PULSECHAIN_RPC_URLS : []
  );

  const synthesizedNetwork = {
    chainId: Number(networkEntry?.chainId || effectiveChainId || 0),
    name: networkEntry?.name || KNOWN_CHAIN_NAMES[Number(effectiveChainId || 0)] || `Chain ${effectiveChainId || 0}`,
    rpcUrl: resolvedRpcUrls[0] || networkEntry?.rpcUrl || '',
    rpcUrls: resolvedRpcUrls,
    explorerUrl: networkEntry?.explorerUrl || '',
    symbolPrefix: networkEntry?.symbolPrefix || 'p',
  };

  return {
    network: synthesizedNetwork,
    contracts: {
      core: {
        SWAP_V3: { address: readAddress(deployment?.contracts?.core?.SWAP_V3) || '' },
        STATE_V3: {
          address: readAddress(deployment?.contracts?.core?.STATE_V3) || '',
          name: deployment?.contracts?.core?.STATE_V3?.name || '',
          symbol: deployment?.contracts?.core?.STATE_V3?.symbol || '',
          decimals: deployment?.contracts?.core?.STATE_V3?.decimals ?? DEFAULTS.contracts.core.STATE_V3.decimals,
        },
        DAV_V3: {
          address: readAddress(deployment?.contracts?.core?.DAV_V3) || '',
          name: deployment?.contracts?.core?.DAV_V3?.name || '',
          symbol: deployment?.contracts?.core?.DAV_V3?.symbol || '',
          decimals: deployment?.contracts?.core?.DAV_V3?.decimals ?? DEFAULTS.contracts.core.DAV_V3.decimals,
        },
      },
      support: {
        SwapLens: { address: readAddress(deployment?.contracts?.support?.SwapLens) || '' },
        BuyAndBurnController: { address: readAddress(deployment?.contracts?.support?.BuyAndBurnController) || '' },
      },
      stages: {
        AirdropDistributor: { address: readAddress(deployment?.contracts?.stages?.AirdropDistributor) || '' },
        AuctionAdmin: { address: readAddress(deployment?.contracts?.stages?.AuctionAdmin) || '' },
      },
    },
    dex: {
      router: { address: readAddress(deployment?.dex?.router) || '' },
      factory: { address: readAddress(deployment?.dex?.factory) || '' },
      baseToken: {
        address: readAddress(deployment?.dex?.baseToken) || '',
        symbol: deployment?.dex?.baseToken?.symbol || '',
        decimals: deployment?.dex?.baseToken?.decimals ?? 18,
      },
    },
    selection: {
      chainId: Number(synthesizedNetwork.chainId || effectiveChainId || 0),
      davId: resolvedDavId,
    },
  };
};

export async function loadRuntimeConfig() {
  if (runtimeConfig) return runtimeConfig;
  if (!loadPromise) {
    loadPromise = fetch('/deployments/registry.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((registryJson) => {
      runtimeRegistry = registryJson || DEFAULT_REGISTRY;

      runtimeConfig = composeRuntimeFromRegistry(
        runtimeRegistry,
        selectedChainId || runtimeRegistry?.defaultSelection?.chainId || 369,
        selectedDavId || runtimeRegistry?.defaultSelection?.davId || 'DAV1'
      );

      return runtimeConfig;
    });
  }
  return loadPromise;
}

export function setRuntimeSelection({ chainId, davId } = {}) {
  if (chainId !== undefined && chainId !== null) {
    selectedChainId = Number(chainId);
  }
  if (davId) {
    selectedDavId = String(davId).toUpperCase();
  }

  const baseRegistry = runtimeRegistry || DEFAULT_REGISTRY;
  runtimeConfig = composeRuntimeFromRegistry(
    baseRegistry,
    selectedChainId || baseRegistry?.defaultSelection?.chainId || 369,
    selectedDavId || baseRegistry?.defaultSelection?.davId || 'DAV1'
  );

  return runtimeConfig;
}

export function getRuntimeSelection() {
  const cfg = getRuntimeConfigSync();
  return {
    chainId: cfg?.selection?.chainId || cfg?.network?.chainId || selectedChainId || 369,
    davId: cfg?.selection?.davId || selectedDavId || 'DAV1',
  };
}

export function getDeploymentRegistrySync() {
  return runtimeRegistry || DEFAULT_REGISTRY;
}

export function resolveDeployment(chainId, davId) {
  const registry = getDeploymentRegistrySync();
  return composeRuntimeFromRegistry(registry, chainId, davId);
}

export function getRuntimeConfigSync() {
  if (!runtimeConfig) {
    runtimeConfig = composeRuntimeFromRegistry(
      runtimeRegistry || DEFAULT_REGISTRY,
      selectedChainId || 0,
      selectedDavId || 'DAV1'
    );
  }
  return runtimeConfig || composeRuntimeFromRegistry(DEFAULT_REGISTRY, selectedChainId || 0, selectedDavId || 'DAV1');
}

export function getRpcUrlsForChain(chainId, davId = selectedDavId || 'DAV1') {
  return resolveDeployment(chainId, davId)?.network?.rpcUrls || [];
}

export function getAddress(path, fallback) {
  const cfg = getRuntimeConfigSync();
  try {
    const parts = path.split('.');
    let cur = cfg;
    for (const p of parts) cur = cur?.[p];
    const addr = cur?.address || cur;
    return addr || fallback;
  } catch {
    return fallback;
  }
}

export function getDavDisplaySymbol(chainId, davId = 'DAV1') {
  const resolved = resolveDeployment(chainId, davId);
  return resolved?.contracts?.core?.DAV_V3?.symbol || '';
}

export function getStateDisplaySymbol(chainId, davId = 'DAV1') {
  const resolved = resolveDeployment(chainId, davId);
  return resolved?.contracts?.core?.STATE_V3?.symbol || '';
}

export function getDeploymentStatus(chainId, davId = 'DAV1') {
  const resolved = resolveDeployment(chainId, davId);
  const missing = [];

  if (!hasAddress(resolved?.contracts?.core?.SWAP_V3)) missing.push('SWAP_V3');
  if (!hasAddress(resolved?.contracts?.core?.STATE_V3)) missing.push('STATE_V3');
  if (!hasAddress(resolved?.contracts?.core?.DAV_V3)) missing.push('DAV_V3');

  const ready = missing.length === 0;
  const davSymbol = resolved?.contracts?.core?.DAV_V3?.symbol || '';
  const davName = resolved?.contracts?.core?.DAV_V3?.name || '';

  return {
    ready,
    missing,
    chainId: resolved?.network?.chainId || Number(chainId || 0),
    networkName: resolved?.network?.name || `Chain ${Number(chainId || 0)}`,
    davId,
    davSymbol,
    davName,
  };
}

export function isDeploymentReady(chainId, davId = 'DAV1') {
  return getDeploymentStatus(chainId, davId).ready;
}
