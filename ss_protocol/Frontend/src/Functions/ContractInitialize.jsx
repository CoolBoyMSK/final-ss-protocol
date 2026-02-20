import { ethers } from "ethers";
import { createContext, useEffect, useState, useMemo, useRef } from "react";
// Import ABIs to re-instantiate contracts at resolved on-chain addresses (fresh)
import DavTokenABI from "../ABI/DavToken.json";
import StateTokenABI from "../ABI/StateToken.json";
import PropTypes from "prop-types";
import {
  getContractConfigs,
  isChainSupported,
} from "../Constants/ContractConfig";
import { CHAIN_IDS, getContractAddresses } from "../Constants/ContractAddresses";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { getRuntimeConfigSync, setRuntimeSelection } from "../Constants/RuntimeConfig";
import { useDeploymentStore } from "../stores";
import { clearAllContractCache, clearAllPendingRequests } from "../utils/contractCache";

const ContractContext = createContext(null);

const normalizeAddressSafe = (value) => {
  try {
    return ethers.getAddress(value);
  } catch {
    return value;
  }
};

const buildViewMethodSet = (abi) => {
  try {
    const iface = new ethers.Interface(abi);
    const methods = new Set();
    for (const fragment of iface.fragments || []) {
      if (fragment?.type !== "function") continue;
      if (fragment.stateMutability === "view" || fragment.stateMutability === "pure") {
        if (fragment.name) methods.add(fragment.name);
      }
    }
    return methods;
  } catch {
    return new Set();
  }
};

const bindContractMethod = (method, targetContract) => {
  if (typeof method !== "function") return method;

  const bound = method.bind(targetContract);
  const helperMethods = [
    "staticCall",
    "send",
    "estimateGas",
    "populateTransaction",
    "staticCallResult",
  ];

  for (const helper of helperMethods) {
    try {
      if (typeof method[helper] === "function") {
        bound[helper] = method[helper].bind(method);
      }
    } catch {
      // ignore helper assignment failures
    }
  }

  return bound;
};

const createHybridContract = ({ address, abi, readRunner, writeRunner }) => {
  if (!address || !abi || !readRunner) return null;

  const normalizedAddress = normalizeAddressSafe(address);
  const readContract = new ethers.Contract(normalizedAddress, abi, readRunner);
  const safeWriteRunner = writeRunner || readRunner;
  const writeContract = new ethers.Contract(normalizedAddress, abi, safeWriteRunner);
  const viewMethods = buildViewMethodSet(abi);

  return new Proxy(writeContract, {
    get(target, prop, receiver) {
      if (prop === "runner") return readContract.runner;

      if (prop === "connect") {
        return (nextRunner) => {
          const isSigner = !!nextRunner && typeof nextRunner.sendTransaction === "function";
          return createHybridContract({
            address: normalizedAddress,
            abi,
            readRunner: isSigner ? readRunner : (nextRunner || readRunner),
            writeRunner: isSigner ? nextRunner : safeWriteRunner,
          });
        };
      }

      if (prop === "getFunction") {
        return (fn) => {
          try {
            const fragment = writeContract.interface.getFunction(fn);
            const isView = fragment?.stateMutability === "view" || fragment?.stateMutability === "pure";
            return isView ? readContract.getFunction(fn) : writeContract.getFunction(fn);
          } catch {
            return writeContract.getFunction(fn);
          }
        };
      }

      if (typeof prop === "string" && viewMethods.has(prop)) {
        const readValue = readContract[prop];
        if (typeof readValue === "function") return bindContractMethod(readValue, readContract);
        return readValue;
      }

      const writeValue = Reflect.get(target, prop, receiver);
      if (typeof writeValue === "function") return bindContractMethod(writeValue, target);
      return writeValue;
    },
  });
};

export const ContractProvider = ({ children }) => {
  ContractProvider.propTypes = {
    children: PropTypes.node.isRequired,
  };

  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const selectedDavId = useDeploymentStore((state) => state.selectedDavId);
  const hydrateSelectedDavId = useDeploymentStore((state) => state.hydrateSelectedDavId);

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [AllContracts, setContracts] = useState({});
  const initRequestRef = useRef(0);

  useEffect(() => {
    hydrateSelectedDavId();
  }, [hydrateSelectedDavId]);

  useEffect(() => {
    // Always initialize contracts so the app works in read-only mode even without a wallet
    const runtimeCfg = getRuntimeConfigSync();
    const defaultChainId = Number(runtimeCfg?.selection?.chainId || CHAIN_IDS.PULSECHAIN);
    const desiredChainId = isChainSupported(chainId) ? chainId : defaultChainId;

    setRuntimeSelection({
      chainId: desiredChainId,
      davId: selectedDavId || 'DAV1',
    });

    if (!isChainSupported(chainId)) {
      console.warn(`Connected chain ${chainId} is not supported. Using configured runtime chain ${desiredChainId}.`);
    }
    initializeContracts({
      activeChainId: desiredChainId,
      davId: selectedDavId || 'DAV1',
    });
    // Re-init on wallet connect/disconnect, chain changes, or wallet client changes
  }, [isConnected, address, chainId, walletClient, selectedDavId, hydrateSelectedDavId]);
  const initializeContracts = async ({ activeChainId, davId }) => {
    const requestId = ++initRequestRef.current;
    try {
      setLoading(true);
      // Clear stale contract cache from previous deployment/chain
      clearAllContractCache();
      clearAllPendingRequests();
      // Resolve a reliable read RPC URL from runtime config
      const runtimeCfg = getRuntimeConfigSync();
      const fallbackRpcUrl = runtimeCfg?.network?.rpcUrl || "https://rpc.pulsechain.com";

      // Build an EIP-1193 provider from available sources (walletClient or window.ethereum)
      let browserProvider = null;
      let signer = null;
      let userAddress = null;
      try {
        // Prefer walletClient if available (viem wallet client implements request and works as EIP-1193)
        if (walletClient && typeof walletClient.request === "function") {
          browserProvider = new ethers.BrowserProvider(walletClient);
        } else if (walletClient?.transport && typeof walletClient.transport.request === "function") {
          browserProvider = new ethers.BrowserProvider(walletClient.transport);
        } else if (typeof window !== "undefined" && window.ethereum) {
          browserProvider = new ethers.BrowserProvider(window.ethereum);
        }
        // Try to get signer only if we have a browser provider and a connected wallet
        if (browserProvider && isConnected) {
          signer = await browserProvider.getSigner().catch(() => null);
          if (signer) {
            userAddress = await signer.getAddress().catch(() => null);
          }
        }
      } catch (provErr) {
        console.warn("BrowserProvider not available or signer not accessible; continuing in read-only mode.", provErr);
      }

      // Always have a read-only provider as a fallback (PulseChain)
      const readOnlyProvider = new ethers.JsonRpcProvider(fallbackRpcUrl);

      // Determine the active chain we intend to use for contracts (strictly selected chain)
      const effectiveChainId = Number(activeChainId || runtimeCfg?.selection?.chainId || CHAIN_IDS.PULSECHAIN);
      const effectiveDavId = String(davId || 'DAV1').toUpperCase();

      // Keep signer for writes only when wallet is on the active chain
      const writeRunner = (signer && chainId === effectiveChainId) ? signer : null;

      const contractInstances = Object.fromEntries(
        Object.entries(getContractConfigs(effectiveChainId, effectiveDavId)).map(([key, { address, abi }]) => {
          if (!address) return [key, null];
          try {
            return [
              key,
              createHybridContract({
                address,
                abi,
                readRunner: readOnlyProvider,
                writeRunner,
              }),
            ];
          } catch (e) {
            console.warn(`Contract init failed for ${key} at ${address}`);
            return [key, null];
          }
        })
      );

      // Resolve DAV/STATE from on-chain Auction (SWAP) contract to avoid stale config
      try {
        const swap = contractInstances.AuctionContract;
        if (swap) {
          const [onChainDav, onChainState, onChainAirdrop] = await Promise.all([
            swap.dav?.().catch(() => null),
            swap.stateToken?.().catch(() => null),
            swap.airdropDistributor?.().catch(() => null),
          ]);

          if (onChainDav && ethers.isAddress(onChainDav)) {
            contractInstances.davContract = createHybridContract({
              address: onChainDav,
              abi: DavTokenABI,
              readRunner: readOnlyProvider,
              writeRunner,
            });
            // Stash resolved address for consumers that need raw values
            contractInstances._davAddress = onChainDav;
          }
          if (onChainState && ethers.isAddress(onChainState)) {
            contractInstances.stateContract = createHybridContract({
              address: onChainState,
              abi: StateTokenABI,
              readRunner: readOnlyProvider,
              writeRunner,
            });
            contractInstances._stateAddress = onChainState;
          }
          if (onChainAirdrop && ethers.isAddress(onChainAirdrop) && onChainAirdrop !== ethers.ZeroAddress) {
            // Prefer the distributor address configured on-chain over static config
            contractInstances.airdropDistributor = createHybridContract({
              address: onChainAirdrop,
              abi: (await import("../ABI/AirdropDistributor.json")).default,
              readRunner: readOnlyProvider,
              writeRunner,
            });
            contractInstances._airdropDistributorAddress = onChainAirdrop;
          } else if (contractInstances.airdropDistributor) {
            // Keep the static config instance if on-chain resolution failed
            console.log("Using static airdropDistributor config (on-chain resolution failed or returned zero address)");
          }
        }
      } catch (e) {
        console.warn("Failed to resolve on-chain DAV/STATE addresses from Auction contract", e);
      }

      try {
        console.debug("Contract initialization complete:", {
          account: userAddress || "read-only",
          auction: contractInstances?.AuctionContract?.target,
          dav: contractInstances?.davContract?.target,
          state: contractInstances?.stateContract?.target,
          mode: signer ? "signer" : "read-only",
        });
      } catch { }

      // Expose the read-only provider for consistent reads (even if a signer exists on another chain)
      if (requestId !== initRequestRef.current) return;
      setProvider(readOnlyProvider);
      setSigner(signer || null);
      setAccount(userAddress || null);
      setContracts(contractInstances);
    } catch (err) {
      if (requestId !== initRequestRef.current) return;
      console.error("Failed to initialize contracts:", err);
    } finally {
      if (requestId !== initRequestRef.current) return;
      setLoading(false);
    }
  };


  const contracts = useMemo(() => ({
    state: AllContracts.stateContract,
    dav: AllContracts.davContract,
    Fluxin: AllContracts.FluxinContract,
    Xerion: AllContracts.XerionContract,
    // Admin-only extras
    auction: AllContracts.AuctionContract,
    swapLens: AllContracts.swapLens,
    buyBurnController: AllContracts.buyBurnController,
    airdropDistributor: AllContracts.airdropDistributor,
    // Expose resolved addresses when available (ethers v6 Contract.target also works)
    addresses: {
      dav: AllContracts?._davAddress || AllContracts?.davContract?.target,
      state: AllContracts?._stateAddress || AllContracts?.stateContract?.target,
      airdropDistributor: AllContracts?._airdropDistributorAddress || AllContracts?.airdropDistributor?.target,
    },
  }), [AllContracts]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    loading,
    provider,
    signer,
    account,
    AllContracts,
    contracts,
  }), [loading, provider, signer, account, AllContracts, contracts]);

  return (
    <ContractContext.Provider value={contextValue}>
      {children}
    </ContractContext.Provider>
  );
};

export { ContractContext };
