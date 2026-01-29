import React, { useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { getContractAddressesForChain, CHAIN_IDS } from "../Constants/ContractAddresses";
import "../Styles/ContractsModal.css";
import faviconLogo from "/favicon.png";

const DAV_VAULT_NETWORKS = [
  { key: "pulsechain", label: "PulseChain", chainId: CHAIN_IDS.PULSECHAIN },
  { key: "polygon", label: "Polygon", chainId: CHAIN_IDS.POLYGON },
  { key: "ethereum", label: "Ethereum", chainId: CHAIN_IDS.MAINNET },
  { key: "sonic", label: "Sonic", chainId: CHAIN_IDS.SONIC },
];

const DAV_VAULT_DAVS = ["DAV1", "DAV2", "DAV3"];

const DAV_VAULT_DAV_LABELS = {
  DAV1: "JP Morgain (DAV1)",
  DAV2: "GM Sachs (DAV2)",
  DAV3: "Deutsche Bros (DAV3)",
};

// Contract display names and icons mapping
const CONTRACT_CONFIG = {
  DAV_TOKEN: { name: "DAV Token", icon: "bi-coin" },
  STATE_TOKEN: { name: "STATE Token", icon: "bi-currency-exchange" },
  AUCTION: { name: "Auction (SWAP_V3)", icon: "bi-arrow-left-right" },
  SWAP_LENS: { name: "Swap Lens", icon: "bi-search" },
  BUY_BURN_CONTROLLER: { name: "Buy & Burn Controller", icon: "bi-fire" },
  AIRDROP_DISTRIBUTOR: { name: "Airdrop Distributor", icon: "bi-gift" },
  AUCTION_ADMIN: { name: "Auction Admin", icon: "bi-shield-lock" },
};

// Helper to truncate address for display
const truncateAddress = (address) => {
  if (!address) return "Not Deployed";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper to copy address to clipboard
const copyToClipboard = async (text, setCopied) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
};

const ContractsModal = ({ isOpen, onClose, embedded = false, uiVariant }) => {
  const walletChainId = useChainId() || CHAIN_IDS.PULSECHAIN;
  const isDavVaultVariant = uiVariant === "davVault" || (() => {
    try {
      if (typeof window === "undefined") return false;
      const p = window.location?.pathname || "";
      const href = window.location?.href || "";
      // Support both normal routing and any base-path deployments.
      return (
        p === "/dav-vault" ||
        p.startsWith("/dav-vault/") ||
        href.includes("/dav-vault") ||
        p === "/auction" ||
        p.startsWith("/auction/") ||
        href.includes("/auction")
      );
    } catch {
      return false;
    }
  })();
  const [davVaultNetworkKey, setDavVaultNetworkKey] = useState("pulsechain");
  const [davVaultDavKey, setDavVaultDavKey] = useState("DAV1");

  const selectedNetwork = isDavVaultVariant
    ? (DAV_VAULT_NETWORKS.find((n) => n.key === davVaultNetworkKey) || DAV_VAULT_NETWORKS[0])
    : null;
  const effectiveChainId = isDavVaultVariant ? selectedNetwork.chainId : walletChainId;
  const contracts = getContractAddressesForChain(effectiveChainId);
  const [copiedAddress, setCopiedAddress] = useState(null);

  useEffect(() => {
    setCopiedAddress(null);
  }, [effectiveChainId, davVaultDavKey]);

  // Escape key closes modal
  useEffect(() => {
    if (embedded) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (isOpen) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, embedded]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (embedded) return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, embedded]);

  if (!isOpen) return null;

  // Filter out contracts without addresses
  const deployedContracts = Object.entries(contracts)
    .filter(([key, address]) => address && CONTRACT_CONFIG[key])
    .map(([key, address]) => ({
      name: CONTRACT_CONFIG[key].name,
      icon: CONTRACT_CONFIG[key].icon,
      address,
      key,
    }));

  const showDavVaultComingSoon = isDavVaultVariant && !(davVaultNetworkKey === "pulsechain" && davVaultDavKey === "DAV1");

  const content = (
    <div className={`contracts-modal${embedded ? " contracts-embedded" : ""}`} role="document">
      <div className="contracts-header">
        <div className="contracts-header-left">
          <img src={faviconLogo} alt="STATE Protocol logo" className="contracts-logo" />
          <div className="contracts-title-wrap">
            <h5 className="contracts-title">Smart Contracts</h5>
            <div className="contracts-subtitle">
              STATE DEX Protocol • {isDavVaultVariant ? selectedNetwork?.label : "PulseChain"}
            </div>
          </div>
        </div>

        {isDavVaultVariant ? (
          <div className="contracts-header-controls" aria-label="Contracts filters">
            <select
              className="contracts-select"
              value={davVaultNetworkKey}
              onChange={(e) => setDavVaultNetworkKey(e.target.value)}
              aria-label="Select network"
            >
              {DAV_VAULT_NETWORKS.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <select
              className="contracts-select"
              value={davVaultDavKey}
              onChange={(e) => setDavVaultDavKey(e.target.value)}
              aria-label="Select DAV"
            >
              {DAV_VAULT_DAVS.map((d) => (
                <option key={d} value={d}>
                  {DAV_VAULT_DAV_LABELS[d] || d}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {onClose ? (
          <button
            type="button"
            className="contracts-close"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        ) : null}
      </div>

      <div className="contracts-body">
        {showDavVaultComingSoon ? (
          <div className="contracts-coming-soon" role="status" aria-live="polite">
            <div className="contracts-coming-network">{selectedNetwork?.label}</div>
            <div className="contracts-coming-dav">{davVaultDavKey}</div>
            <div className="contracts-coming-note">Coming Soon...</div>
          </div>
        ) : (
          <>
            <div className="contracts-notice">
              <div className="contracts-notice-icon">
                <i className="bi bi-patch-check-fill" aria-hidden="true"></i>
              </div>
              <div className="contracts-notice-text">
                <div className="contracts-notice-title">Verified & Renounced</div>
                <div className="contracts-notice-desc">
                  All contracts are verified on-chain and ownership has been renounced.
                  Review source code on Sourcify or explore on OtterScan.
                </div>
              </div>
            </div>

            <div className="contracts-list">
              {deployedContracts.map(({ name, icon, address, key }) => (
                <div key={key} className="contract-item">
                  <div className="contract-info">
                    <div className="contract-name">
                      <span className="contract-icon">
                        <i className={`bi ${icon}`} aria-hidden="true"></i>
                      </span>
                      {name}
                    </div>
                    <div
                      className="contract-address"
                      onClick={() => copyToClipboard(address, setCopiedAddress)}
                      title="Click to copy full address"
                    >
                      {copiedAddress === address ? (
                        <>
                          <i className="bi bi-check2" aria-hidden="true"></i>
                          Copied!
                        </>
                      ) : (
                        <>
                          {address}
                          <i className="bi bi-clipboard" aria-hidden="true"></i>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="contract-buttons">
                    <a
                      href={`https://repo.sourcify.dev/contracts/full_match/369/${address}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contract-btn sourcify-btn"
                      title="View source code on Sourcify"
                    >
                      <i className="bi bi-code-slash" aria-hidden="true"></i>
                      <span>Sourcify</span>
                    </a>
                    <a
                      href={`https://otter.pulsechain.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contract-btn otter-btn"
                      title="Explore on OtterScan"
                    >
                      <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                      <span>OtterScan</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="contracts-overlay" role="dialog" aria-modal="true">
      <div className="contracts-backdrop" onClick={onClose} />
      {content}
    </div>
  );
};

export default ContractsModal;
