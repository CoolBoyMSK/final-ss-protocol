let runtimeConfig = null;
let runtimeRegistry = null;
let loadPromise = null;

let selectedDavId = 'DAV1';
let selectedChainId = null;

const DEFAULTS = {
  network: { chainId: 369, name: 'PulseChain Mainnet', rpcUrl: 'https://rpc.pulsechain.com', explorerUrl: 'https://scan.pulsechain.com', symbolPrefix: 'p' },
  contracts: {
    core: {
      SWAP_V3: { address: '0x8172716bD7117461D4b20bD0434358F74244d4ec' },
      STATE_V3: { address: '0x4e90670b4cDE8FF7cdDEeAf99AEFD68a114d9C01', symbol: 'pSTATE1', name: 'PulseSTATE1', decimals: 18 },
      DAV_V3: { address: '0x92263Be97A691216f831CBb20760Eed0b4A96AC5', symbol: 'pDAV1', name: 'PulseDAV1', decimals: 18 },
    },
    support: {
      SwapLens: { address: '0x9683fC01A08Db24133B60cE51B4BEB616508a97E' },
      BuyAndBurnController: { address: '0xf1Df5CD347A498768A44F7e0549F833525e3b751' }
    },
    stages: {
      AirdropDistributor: { address: '0x813Aefbee80B02142a994D92B8b4F7b7C4F90Be9' },
      AuctionAdmin: { address: '0xEab50ADaB223f96f139B75430dF7274aE66560Db' }
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
      rpcUrl: 'https://rpc.pulsechain.com',
      explorerUrl: 'https://scan.pulsechain.com',
      deployments: { DAV1: { contracts: DEFAULTS.contracts, dex: DEFAULTS.dex } }
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

const composeRuntimeFromRegistry = (registry, chainId, davId) => {
  const safeRegistry = registry || DEFAULT_REGISTRY;
  const availableNetworks = safeRegistry?.networks || {};
  const fallbackChainId = Number(safeRegistry?.defaultSelection?.chainId || 369);
  const effectiveChainId = Number(chainId || fallbackChainId);

  const networkEntry = availableNetworks[String(effectiveChainId)] || null;

  const resolvedDavId = davId || safeRegistry?.defaultSelection?.davId || 'DAV1';
  const deployment = networkEntry?.deployments?.[resolvedDavId] || { contracts: {}, dex: {} };

  const synthesizedNetwork = {
    chainId: Number(networkEntry?.chainId || effectiveChainId || 0),
    name: networkEntry?.name || KNOWN_CHAIN_NAMES[Number(effectiveChainId || 0)] || `Chain ${effectiveChainId || 0}`,
    rpcUrl: networkEntry?.rpcUrl || '',
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
