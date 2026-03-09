let runtimeConfig = null;
let runtimeRegistry = null;
let loadPromise = null;

let selectedDavId = 'DAV1';
let selectedChainId = null;

const DEFAULTS = {
  network: { chainId: 369, name: 'PulseChain Mainnet', rpcUrl: 'https://rpc.pulsechain.com', explorerUrl: 'https://scan.pulsechain.com', symbolPrefix: 'p' },
  contracts: {
    core: {
      SWAP_V3: { address: '0x80f7352418C347fF23e3A8E21DfcEd08931f78ec' },
      STATE_V3: { address: '0xa79B49ec357325df046E72B4f935166AF5575CB8', symbol: 'pSTATE01', name: 'PulseSTATE01', decimals: 18 },
      DAV_V3: { address: '0x7caeF01F0CBB521fafEA7758db40C95C862e89eB', symbol: 'pDAV01', name: 'PulseDAV01', decimals: 18 },
    },
    support: {
      SwapLens: { address: '0x29F839A07dB4793e5d01829Af97258E67D391511' },
      BuyAndBurnController: { address: '0xF6C7e2B15Fb178ca1e9B5C9f28Cf73b1536C3826' }
    },
    stages: {
      AirdropDistributor: { address: '0xE3c22409c7FEa056784Df7b5D4B2135e1e6d6BB4' },
      AuctionAdmin: { address: '0x026334e7558dEa67e2ebCCE71762eE0D318035a1' }
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
      deployments: {
        DAV1: { contracts: DEFAULTS.contracts, dex: DEFAULTS.dex },
        DAV2: {
          contracts: {
            core: {
              SWAP_V3: { address: '0x9a1d8396CDa5C5C2DAFcF2cB321CeEeDde832540' },
              STATE_V3: { address: '0xBCE4C1Fa04564625F82a440A9df0aa066540d1aE', symbol: 'pSTATE02', name: 'PulseSTATE02', decimals: 18 },
              DAV_V3: { address: '0x7148d23D57CA014DE64E77119230dF1DAD783E7E', symbol: 'pDAV02', name: 'PulseDAV02', decimals: 18 },
            },
            support: {
              SwapLens: { address: '0x484890A1f4D0c7c5B8D00D162Ddbcf11f5Ab12F6' },
              BuyAndBurnController: { address: '0xAe3aB505e63beAd1F31BF1cA522B31c043289157' }
            },
            stages: {
              AirdropDistributor: { address: '0xEd58521795eF5A93781Fd546D8E589215d332150' },
              AuctionAdmin: { address: '0x7E32C593248acD38A5050bA7291798cb05383aAB' }
            },
          },
          dex: DEFAULTS.dex,
        },
        DAV3: {
          contracts: {
            core: {
              SWAP_V3: { address: '0x724A1c1819de38C91eDAa8b05279fD6F1dcE185D' },
              STATE_V3: { address: '0x867FF7f2Fd12AB05CCF5dbaf32480D4D3B571c5d', symbol: 'pSTATE03', name: 'PulseSTATE03', decimals: 18 },
              DAV_V3: { address: '0x6b2f153fa4520C7B6d9D78CFD281143a74289641', symbol: 'pDAV03', name: 'PulseDAV03', decimals: 18 },
            },
            support: {
              SwapLens: { address: '0x7A8e5bB41A18C0bD6C8dAE908F1515088E1b064e' },
              BuyAndBurnController: { address: '0x801760291a11Ec154be4c63629D2326140c54b6C' }
            },
            stages: {
              AirdropDistributor: { address: '0xF75df9Ea4Fa86Be748AE2C9Cf2679c4299403256' },
              AuctionAdmin: { address: '0x61B9062e4b773020e7dd768d2bCe8a951Ba26C5D' }
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
