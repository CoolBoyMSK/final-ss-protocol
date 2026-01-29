import "bootstrap/dist/css/bootstrap.min.css";
import "../Styles/DetailsInfo.css";
import "../Styles/SearchInfo.css";
import MetaMaskIcon from "../assets/metamask-icon.png";
import gecko from "../assets/gecko.svg";
import { useSwapContract } from "../Functions/SwapContractFunctions";
import { useTokenStore } from "../stores";
import PropTypes from "prop-types";
import { useContext, useEffect, useState, useMemo, useCallback, memo, useRef } from "react";
import { TokensDetails } from "../data/TokensDetails";
import { useDAvContract } from "../Functions/DavTokenFunctions";
import IOSpinner from "../Constants/Spinner";
import toast from "react-hot-toast";
import dav from "../assets/davlogo.png";
import state from "../assets/statelogo.png";
import useTokenBalances from "./Swap/UserTokenBalances";
import { ContractContext } from "../Functions/ContractInitialize";
import { useAllTokens } from "./Swap/Tokens";
import { useChainId } from "wagmi";
import { geckoPoolUrl } from "../Constants/ExternalLinks";
import { useStatePoolAddress } from "../Functions/useStatePoolAddress";
import SwapComponent from "./Swap/SwapModel";
import DexModal from "./Swap/DexModal";
import { explorerUrls } from "../Constants/ContractAddresses";
import { chainCurrencyMap } from "../../WalletConfig";
import { formatWithCommas } from "../Constants/Utils";
import { isImageUrl, notifySuccess } from "../Constants/Constants";
import { generateIdenticon } from "../utils/identicon";
import { useBackgroundAmmCalculator } from "../hooks/useBackgroundAmmCalculator";
import { useLocation } from "react-router-dom";

// Memoized token row component - OPTIMIZED: receives pre-calculated AMM value as prop
const TokenRow = memo(({
  token,
  tokenBalances,
  pstateToPlsRatio,
  chainId,
  totalStateBurned,
  showDot,
  handleAddToken,
  DavAddress,
  setDavAndStateIntoSwap,
  nativeSymbol,
  explorerUrl,
  combinedDeployedLP,
  statePoolAddress,
  preCalculatedAmmValue, // NEW: Pre-calculated AMM value from parent
  compactInfoPage
}) => {
  const handleCopyAddress = useCallback(() => {
    navigator.clipboard.writeText(token.TokenAddress);
    notifySuccess(`${token.tokenName} Address copied to clipboard!`)
  }, [token.TokenAddress, token.tokenName]);
  // REMOVED: useSwapContract() and useStatePoolAddress() hooks - these caused memory issues
  // when called in every TokenRow. statePoolAddress is now passed as a prop.
  // REMOVED: Per-row AMM calculation - now done in parent and passed as preCalculatedAmmValue

  // Map chain to the TOKENS key used for the wrapped native asset (used by SwapComponent)
  const nativeWrappedKey = useMemo(() => {
    if (chainId === 369) return "Wrapped Pulse"; // PulseChain
    if (chainId === 146) return "Wrapped Sonic"; // Sonic
    if (chainId === 137) return "Wrapped Matic"; // Polygon
    return "Wrapped Ether"; // Default fallback
  }, [chainId]);

  const handleAddTokenClick = useCallback((e) => {
    // Prevent event bubbling
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const symbol = token.tokenName === "DAV"
      ? (chainId === 137 ? "mDAV" : "pDAV")
      : token.tokenName === "STATE"
        ? (chainId === 137 ? "mSTATE" : "pSTATE")
        : token.tokenName;
    
    console.log("handleAddTokenClick called:", {
      address: token.TokenAddress,
      symbol: symbol,
      tokenName: token.tokenName,
      chainId: chainId
    });

    if (!handleAddToken) {
      console.error("handleAddToken function is not available");
      toast.error("Unable to add token - function not available");
      return;
    }

    handleAddToken(
      token.TokenAddress,
      symbol
    );
  }, [handleAddToken, token.TokenAddress, token.tokenName, chainId]);

  const savedStateTokenBalance = (() => {
    try {
      const saved = localStorage.getItem("stateTokenBalance");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return parsed.balance ?? null;
    } catch {
      return null;
    }
  })();
  const [showDex, setShowDex] = useState(false);
  const [dexToken, setDexToken] = useState(null);

  // Show integer current ratio (skip decimals)
  const displayRatio = useMemo(() => {
    const n = Number(token.ratio);
    if (!Number.isFinite(n)) return token.ratio ?? "-";
    return Math.floor(n);
  }, [token.ratio]);

  // AMM value is now passed as prop from parent (preCalculatedAmmValue)
  // This eliminates per-row RPC calls and makes loading instant

  if (compactInfoPage) {
    return (
      <tr>
        <td className="text-center align-middle">
          <div className="d-flex flex-column align-items-center">
            <span style={{ fontSize: "1rem", lineHeight: "1" }}>
              {token.tokenName === "DAV" ? (
                <img
                  src={dav}
                  style={{ width: "30px", height: "30px", borderRadius: "50%" }}
                  alt="DAV logo"
                />
              ) : token.tokenName === "STATE" ? (
                <img
                  src={state}
                  style={{ width: "30px", height: "30px", borderRadius: "50%" }}
                  alt="STATE logo"
                />
              ) : (
                <img
                  src={isImageUrl(token.emoji) ? token.emoji : generateIdenticon(token.TokenAddress)}
                  style={{ width: "30px", height: "30px", borderRadius: "50%" }}
                  alt={`${token.tokenName} icon`}
                />
              )}
            </span>
            <span>{token.displayName || token.tokenName}</span>
          </div>
        </td>

        <td className="text-center">
          <div className="d-flex justify-content-center align-items-center gap-3">
            {/* Gecko: hide for DAV; show for others when we have a pool/pair */}
            {token.tokenName !== "DAV" && (token.PairAddress || (token.tokenName === "STATE" && statePoolAddress)) ? (
              <a
                href={geckoPoolUrl(chainId, token.tokenName === "STATE" ? statePoolAddress : token.PairAddress)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "15px", color: "white" }}
                title="View on GeckoTerminal"
              >
                <img src={gecko} alt="Gecko" style={{ width: "20px", height: "20px" }} />
              </a>
            ) : null}

            <a
              href={`${explorerUrl}${token.TokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "15px", color: "white" }}
              title="View on Explorer"
            >
              <i className="bi bi-box-arrow-up-right"></i>
            </a>

            <i
              className="fa-solid fa-copy"
              onClick={handleCopyAddress}
              title="Copy Address"
              style={{ fontSize: "15px", color: "white", cursor: "pointer" }}
            ></i>

            <img
              src={MetaMaskIcon}
              onClick={handleAddTokenClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleAddTokenClick(e);
                }
              }}
              alt="Add to MetaMask"
              title="Add to MetaMask"
              role="button"
              tabIndex={0}
              style={{ width: "20px", height: "20px", cursor: "pointer", userSelect: "none" }}
            />
          </div>
        </td>

        <td className="text-center">
          <div className="mx-2">
            {(() => {
              const v = preCalculatedAmmValue;
              if (!v) return "Loading...";
              if (v === "Loading..." || v === "-----") return v;
              const unit = token.tokenName === "STATE" ? nativeSymbol : "STATE";
              return `${v} ${unit}`;
            })()}
            {(() => {
              const rawBal = tokenBalances?.[token.tokenName];
              if (rawBal == null) return null;
              const num = Number(rawBal);
              if (!Number.isFinite(num)) return null;
              const factor = 100;
              const floored = Math.floor(num * factor) / factor;
              const withTwo = floored.toFixed(2);
              const [intPart, decPart] = withTwo.split('.');
              const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              const formatted = `${formattedInt}.${decPart}`;
              return (
                <div className="small text-white" style={{ lineHeight: 1.1, marginTop: 2 }}>
                  ({formatted} {token.tokenName})
                </div>
              );
            })()}
          </div>
        </td>

        <td className="text-center">
          {token.tokenName === "DAV" ? (
            <span>—</span>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                setDexToken(token.tokenName);
                setShowDex(true);
              }}
            >
              DEX
            </button>
          )}
        </td>

        {/* Modal */}
        {showDex && (
          <td colSpan="100%" style={{ position: 'relative' }}>
            <DexModal
              isOpen={showDex}
              onClose={() => setShowDex(false)}
              token={token}
              preselectToken={dexToken || token.tokenName}
            />
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr>
      <td className="text-center align-middle">
        <div className="d-flex flex-column align-items-center">
          <span style={{ fontSize: "1rem", lineHeight: "1" }}>
            {token.tokenName === "DAV" ? (
              <img
                src={dav}
                style={{ width: "30px", height: "30px", borderRadius: "50%" }}
                alt="DAV logo"
              />
            ) : token.tokenName === "STATE" ? (
              <img
                src={state}
                style={{ width: "30px", height: "30px", borderRadius: "50%" }}
                alt="STATE logo"
              />
            ) : (
              <img
                src={isImageUrl(token.emoji) ? token.emoji : generateIdenticon(token.TokenAddress)}
                style={{ width: "30px", height: "30px", borderRadius: "50%" }}
                alt={`${token.tokenName} icon`}
              />
            )}
          </span>
          <span>
            {token.displayName || token.tokenName}
          </span>
        </div>
      </td>
      <td className="text-center">
        <div className="mx-2">
          {token.tokenName === "DAV" ? (
            "------"
          ) : token.tokenName === "STATE" ? (
            (() => {
              const r = Number(pstateToPlsRatio || 0);
              if (!Number.isFinite(r) || r <= 0) return "Loading...";
              const s = r.toFixed(3); // exactly 3 decimals
              return (
                <span>
                  {`1:${s}`}
                </span>
              );
            })()
          ) : (
            <span style={{ color: showDot ? "#28a745" : "inherit" }}>
              {`1:${formatWithCommas(displayRatio)}`}
            </span>
          )}
        </div>
      </td>
      <td className="text-center">
        <div className="mx-4">
          {token.tokenName === "DAV" || token.tokenName === "STATE" ? (
            "-----"
          ) : (
            (() => {
              const c = token.Cycle;
              // If already formatted like "0/20", show as-is
              if (typeof c === 'string' && c.includes('/')) {
                const parts = c.split('/');
                const num = Number(parts[0]?.trim());
                const denom = Number(parts[1]?.trim());
                const cappedNum = Number.isFinite(num) ? Math.min(num, 20) : 0;
                const useDenom = Number.isFinite(denom) ? denom : 20;
                return `${cappedNum}/${useDenom}`;
              }
              // If not started marker
              if (String(c).toLowerCase() === 'not started') return 'Not Started';
              const n = Number(c);
              if (Number.isFinite(n)) {
                const capped = Math.min(n, 20);
                return `${capped}/20`;
              }
              return '0/20';
            })()
          )}
        </div>
      </td>
      <td className="text-center">
        <div className="mx-4">
          {token.tokenName === "DAV" ? (
            "-----"
          ) : token.tokenName === "STATE" ? (
            <>
              <span>
                {formatWithCommas(token.DavVault)}
              </span>
              {/* Refresh UI removed; integration retained and moved to Buy & Burn 'STATE Out' */}
            </>
          ) : (
            formatWithCommas(token.DavVault)
          )}
        </div>
      </td>


      <td className="text-center">
        <div className="mx-4">
          {token.tokenName === "DAV" ? (
            "-----"
          ) : token.tokenName === "STATE" ? (
            Number(token.burned || 0) + Number(totalStateBurned) === 0 ? (
              <span className="blink-new">NEW</span>
            ) : (
              formatWithCommas(
                Number(token.burned || 0) + Number(totalStateBurned)
              )
            )
          ) : (
            Number(token.burned || 0) === 0 ? (
              <span className="blink-new">NEW</span>
            ) : (
              formatWithCommas(token.burned || 0)
            )
          )}
        </div>
      </td>
      <td className="text-center">
        <div className="mx-4">
          {token.tokenName === "DAV"
            ? "-----"
            : formatWithCommas(token.BurnedLp)}
        </div>
      </td>
      <td className="text-center">
        <div className="d-flex justify-content-center align-items-center gap-3">
          <div className="d-flex flex-column align-items-center">
            {token.tokenName === "DAV" ? (
              <span>-----</span>
            ) : token.tokenName === "STATE" ? (
              <a
                href={geckoPoolUrl(chainId, statePoolAddress)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "15px", color: "white" }}
              >
                <img
                  src={gecko}
                  alt="Gecko"
                  style={{ width: "20px", height: "20px" }}
                />
              </a>
            ) : (
              <a
                href={geckoPoolUrl(chainId, token.PairAddress)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "15px", color: "white" }}
              >
                <img
                  src={gecko}
                  alt="Gecko"
                  style={{ width: "20px", height: "20px" }}
                />
              </a>
            )}
          </div>
          <div className="d-flex flex-column align-items-center">
            <a
              href={`${explorerUrl}${token.TokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "15px", color: "white" }}
            >
              <i className="bi bi-box-arrow-up-right"></i>
            </a>
          </div>
          <div
            className="d-flex flex-column align-items-center"
            style={{ cursor: "pointer" }}
          >
            <i
              className="fa-solid fa-copy"
              onClick={handleCopyAddress}
              title="Copy Address"
              style={{
                fontSize: "15px",
                color: "white",
                cursor: "pointer",
              }}
            ></i>
          </div>
          <div
            className="d-flex align-items-center"
            style={{ marginRight: "-10px" }}
          >
            <img
              src={MetaMaskIcon}
              onClick={handleAddTokenClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleAddTokenClick(e);
                }
              }}
              alt="Add to MetaMask"
              title="Add to MetaMask"
              role="button"
              tabIndex={0}
              style={{
                width: "20px",
                height: "20px",
                cursor: "pointer",
                userSelect: "none",
              }}
            />
          </div>
          <div
            className="d-flex flex-column align-items-center"
            style={{ minWidth: "80px" }}
          >
            {token.tokenName === "DAV" ? (
              token.isRenounced === true && (
                <span>Renounced</span>
              )
            ) : token.tokenName === "STATE" ? (
              DavAddress === "0x0000000000000000000000000000000000000000" ? (
                <button
                  className="btn btn-sm swap-btn btn-primary"
                  onClick={() => setDavAndStateIntoSwap()}
                >
                  Add
                </button>
              ) : token.isRenounced === true ? (
                <span>Renounced</span>
              ) : (
                <span>ADDED</span>
              )
            ) : (token.isRenounced === true || token.isRenounced === "true") ? (
              <span>Renounced</span>
            ) : (
              <span>-------</span>
            )}
          </div>
        </div>
      </td>
      <td className="text-center">
        <div className="mx-2">
          {(() => {
            const v = preCalculatedAmmValue;
            if (!v) return "Loading...";
            if (v === "Loading..." || v === "-----") return v;
            const unit = token.tokenName === "STATE" ? nativeSymbol : "STATE";
            return `${v} ${unit}`;
          })()}
          {(() => {
            const rawBal = tokenBalances?.[token.tokenName];
            if (rawBal == null) return null;
            const num = Number(rawBal);
            if (!Number.isFinite(num)) return null;
            // Floor to 2 decimals without rounding up, then format with thousands separators
            const factor = 100;
            const floored = Math.floor(num * factor) / factor;
            const withTwo = floored.toFixed(2);
            // Apply thousands separators to integer portion, keep exactly 2 decimals
            const [intPart, decPart] = withTwo.split('.');
            const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            const formatted = `${formattedInt}.${decPart}`;
            return (
              <div className="small text-white" style={{ lineHeight: 1.1, marginTop: 2 }}>
                ({formatted} {token.tokenName})
              </div>
            );
          })()}
        </div>
      </td>
      <td className="text-center">
        {token.tokenName === "DAV" ? (
          <span>-----</span>
        ) : token.tokenName === "STATE" ? (
          // Enable DEX for STATE only when STATE/WPLS pool exists (auto-detected via Buy & Burn controller)
          statePoolAddress && statePoolAddress !== "0x0000000000000000000000000000000000000000" ? (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => { setDexToken('STATE'); setShowDex(true); }}
              title="Open DEX for STATE/WPLS"
            >
              DEX
            </button>
          ) : (
            <span>-----</span>
          )
        ) : (
          <button className="btn btn-sm btn-primary" onClick={() => { setDexToken(token.tokenName); setShowDex(true); }}>DEX</button>
        )}
      </td>
      {/* Modal */}
      {showDex && (
        <td colSpan="100%" style={{ position: 'relative' }}>
          <DexModal
            isOpen={showDex}
            onClose={() => setShowDex(false)}
            token={token}
            preselectToken={dexToken || token.tokenName}
          />
        </td>
      )}
    </tr>
  );
});

TokenRow.displayName = 'TokenRow';

const DetailsInfo = ({ selectedToken }) => {
  const location = useLocation();
  const isInfoPage = location.pathname === "/info";

  return isInfoPage ? (
    <DetailsInfoInfoPage selectedToken={selectedToken} />
  ) : (
    <DetailsInfoFull selectedToken={selectedToken} />
  );
};

const DetailsInfoFull = ({ selectedToken }) => {
  // Use selective store access instead of full context (reduces re-renders)
  const pstateToPlsRatio = useTokenStore(state => state.pstateToPlsRatio);
  const {
    setDavAndStateIntoSwap,
    handleAddToken,
    DavAddress,
  } = useSwapContract();

  const chainId = useChainId();
  const { totalStateBurned } = useDAvContract();
  const { poolAddress: statePoolAddress } = useStatePoolAddress(); // Called once here, passed to all rows
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [showDex, setShowDex] = useState(false);
  const { tokens: rawTokens, loading, refetch } = TokensDetails();
  const { signer } = useContext(ContractContext);
  const TOKENS = useAllTokens();
  const tokenBalances = useTokenBalances(TOKENS, signer);

  // Keep last non-empty token list to prevent flicker/disappearing rows during refetch/loading.
  const stableTokensRef = useRef([]);
  useEffect(() => {
    if (Array.isArray(rawTokens) && rawTokens.length > 0) {
      stableTokensRef.current = rawTokens;
    }
  }, [rawTokens]);
  const tokens = useMemo(() => {
    if (Array.isArray(rawTokens) && rawTokens.length > 0) return rawTokens;
    return stableTokensRef.current;
  }, [rawTokens]);
  const isInitialLoading = loading && (!Array.isArray(tokens) || tokens.length === 0);

  // Memoized values
  const nativeSymbol = useMemo(() => chainCurrencyMap[chainId] || 'PLS', [chainId]);
  const explorerUrl = useMemo(() => explorerUrls[chainId] || "https://defaultexplorer.io/address/", [chainId]);
  const isInfoPage = false;

  // Combined LP burned for all deployed tokens (computed once per render)
  const combinedDeployedLP = useMemo(() => {
    try {
      return tokens
        .filter(t => t && t.isDeployed === true)
        .reduce((acc, t) => acc + Number(t.BurnedLp || 0), 0);
    } catch { return 0; }
  }, [tokens]);

  // Memoized filtered tokens
  const filteredTokens = useMemo(() => {
    if (!localSearchQuery.trim()) return tokens;

    return tokens.filter((item) => {
      const searchQuery = localSearchQuery.toLowerCase();
      const tokenName = item.tokenName.toLowerCase();

      if (["p", "pd", "pda", "pdav"].includes(searchQuery) && item.tokenName === "DAV") {
        return true;
      }
      if (["p", "ps", "psta", "pstat", "pstate"].includes(searchQuery) && item.tokenName === "STATE") {
        return true;
      }
      return tokenName.includes(searchQuery);
    });
  }, [tokens, localSearchQuery]);

  // Memoized sorting function
  const getSortedTokens = useCallback((tokensToSort) => {
    const order = { DAV: 0, STATE: 1 };

    const priorityTokens = tokensToSort
      .filter((t) => order[t.tokenName] !== undefined)
      .sort((a, b) => (order[a.tokenName] ?? 99) - (order[b.tokenName] ?? 99));

    const topFiveTokens = tokensToSort
      .filter(
        (t) =>
          order[t.tokenName] === undefined && t.ratio != null && t.isSupported
      )
      .sort((a, b) => {
        const aRatio = a.ratio ?? -Infinity;
        const bRatio = b.ratio ?? -Infinity;
        return bRatio - aRatio;
      })
      .slice(0, 5);

    const remainingTokens = tokensToSort
      .filter(
        (t) =>
          order[t.tokenName] === undefined &&
          !topFiveTokens.some((top) => top.tokenName === t.tokenName) &&
          t.isSupported
      )
      .sort((a, b) => {
        const aRatio = a.ratio ?? -Infinity;
        const bRatio = b.ratio ?? -Infinity;
        return bRatio - aRatio;
      });

    return [...priorityTokens, ...topFiveTokens, ...remainingTokens];
  }, []);

  // Memoized sorted tokens
  const sortedTokens = useMemo(() => {
    const supportedTokens = tokens.filter((token) => token.isSupported);
    return getSortedTokens(localSearchQuery ? filteredTokens : supportedTokens);
  }, [tokens, filteredTokens, localSearchQuery, getSortedTokens]);

  // Memoized data to show
  const dataToShow = useMemo(() => {
    return selectedToken
      ? tokens.find((token) => token.tokenName === selectedToken.name)
      : sortedTokens[0] || null;
  }, [selectedToken, tokens, sortedTokens]);

  // Memoized green dot eligible tokens
  const greenDotEligibleTokens = useMemo(() => {
    const tokensToCheck = isInitialLoading ? filteredTokens : tokens.filter(t => t.isSupported);

    return tokensToCheck
      .filter(
        (token) =>
          token.isSupported &&
          token.tokenName !== "DAV" &&
          token.tokenName !== "STATE" &&
          token.ratio != null
      )
      .sort((a, b) => {
        const aRatio = a.ratio ?? -Infinity;
        const bRatio = b.ratio ?? -Infinity;
        return bRatio - aRatio;
      })
      .slice(0, 5)
      .map((token) => token.tokenName);
  }, [isInitialLoading, filteredTokens, tokens]);

  // ========== BACKGROUND AMM CALCULATIONS ==========
  // All AMM calculations now run in a Web Worker (separate thread)
  // UI stays responsive, values update every 30 seconds in background
  const { ammValuesMap, totalSum, isCalculating } = useBackgroundAmmCalculator(
    sortedTokens,
    tokenBalances,
    chainId,
    TOKENS
  );

  // Optimized search handler
  const handleSearch = useCallback((e) => {
    setLocalSearchQuery(e.target.value.trim());
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
    notifySuccess("Data refreshed!");
  }, []);
  return (
    <div className="container mt-3 p-0 pb-4 mb-5">
      <div className="mb-3 d-flex justify-content-center align-items-center gap-3 dex-search-bar-row">
        <input
          type="text"
          className="form-control text-center"
          placeholder="Search"
          value={localSearchQuery}
          onChange={handleSearch}
          style={{ maxWidth: "300%", "--placeholder-color": "#6c757d" }}
        />
      </div>

      <div className={`table-responsive ${isInfoPage ? "info-page" : ""}`}>
        {dataToShow ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th className="text-center">Token <br /> Name</th>
                  <th className="text-center">Current <br /> Ratio</th>
                  <th className="text-center">Auctions</th>
                  <th className="text-center">DAV Vault</th>
                  <th className="text-center">Burned</th>
                  <th className="text-center">Burned LP <br />(Combined)</th>
                  <th className="text-center">Info</th>
                  <th className="text-center">
                    PLS Value Excl. Rewards <br />
                    {loading ? (
                      <IOSpinner />
                    ) : (
                      <span style={{ position: 'relative' }}>
                        {`${totalSum} ${nativeSymbol}`}
                        {isCalculating && (
                          <span 
                            style={{ 
                              marginLeft: '4px', 
                              fontSize: '0.7em', 
                              opacity: 0.6,
                              animation: 'pulse 1s infinite'
                            }}
                            title="Updating values in background..."
                          >
                            ⟳
                          </span>
                        )}
                      </span>
                    )}
                  </th>
                  <th className="text-center">DEX</th>
                </tr>
              </thead>
              <tbody>
                {isInitialLoading ? (
                  [...Array(1)].map((_, index) => (
                    <tr key={index} className="table-skeleton-row">
                      <td colSpan="9">
                        <div className="skeleton-wrapper">
                          <div className="skeleton-block" style={{ width: "25%", height: "24px" }} />
                          <div className="skeleton-block" style={{ width: "15%", height: "18px" }} />
                          <div className="skeleton-block" style={{ width: "35%", height: "22px" }} />
                          <div className="skeleton-block" style={{ width: "20%", height: "20px" }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedTokens.map((token, idx) => (
                    <TokenRow
                      key={`${(token.TokenAddress && typeof token.TokenAddress === 'string' ? token.TokenAddress.toLowerCase() : '') || token.tokenName}`}
                      token={token}
                      tokenBalances={tokenBalances}
                      pstateToPlsRatio={pstateToPlsRatio}
                      chainId={chainId}
                      totalStateBurned={totalStateBurned}
                      showDot={greenDotEligibleTokens.includes(token.tokenName)}
                      handleAddToken={handleAddToken}
                      DavAddress={DavAddress}
                      setDavAndStateIntoSwap={setDavAndStateIntoSwap}
                      nativeSymbol={nativeSymbol}
                      explorerUrl={explorerUrl}
                      combinedDeployedLP={combinedDeployedLP}
                      statePoolAddress={statePoolAddress}
                      preCalculatedAmmValue={ammValuesMap[token.tokenName] || "Loading..."}
                    />
                  ))
                )}
              </tbody>
            </table>

            {loading && filteredTokens.length > 0 && (
              <div className="container text-center mt-5">
                <p className="funny-loading-text">
                  <IOSpinner /> Fetching..
                </p>
              </div>
            )}

            {!loading && filteredTokens.length === 0 && (
              <div className="alert alert-warning text-center" role="alert">
                No tokens found matching the search query.
              </div>
            )}
          </>
        ) : (
          <div className="alert alert-warning text-center" role="alert">
            No tokens available to display.
          </div>
        )}
      </div>
    </div>
  );
};

const DetailsInfoInfoPage = ({ selectedToken }) => {
  // /info page: only render the 4 requested columns and avoid extra per-page hooks/logic
  // that support the other columns.
  // (Keeping AMM calculator enabled because PLS Value Excl. Rewards requires it.)

  const pstateToPlsRatio = useTokenStore(state => state.pstateToPlsRatio);
  const { handleAddToken } = useSwapContract();
  const chainId = useChainId();
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const { tokens: rawTokens, loading, refetch } = TokensDetails();
  const { signer } = useContext(ContractContext);
  const TOKENS = useAllTokens();
  const tokenBalances = useTokenBalances(TOKENS, signer);

  // Keep last non-empty token list to prevent flicker/disappearing rows during refetch/loading.
  const stableTokensRef = useRef([]);
  useEffect(() => {
    if (Array.isArray(rawTokens) && rawTokens.length > 0) {
      stableTokensRef.current = rawTokens;
    }
  }, [rawTokens]);
  const tokens = useMemo(() => {
    if (Array.isArray(rawTokens) && rawTokens.length > 0) return rawTokens;
    return stableTokensRef.current;
  }, [rawTokens]);
  const isInitialLoading = loading && (!Array.isArray(tokens) || tokens.length === 0);

  const nativeSymbol = useMemo(() => chainCurrencyMap[chainId] || 'PLS', [chainId]);
  const explorerUrl = useMemo(() => explorerUrls[chainId] || "https://defaultexplorer.io/address/", [chainId]);

  const filteredTokens = useMemo(() => {
    if (!localSearchQuery.trim()) return tokens;

    return tokens.filter((item) => {
      const searchQuery = localSearchQuery.toLowerCase();
      const tokenName = item.tokenName.toLowerCase();

      if (["p", "pd", "pda", "pdav"].includes(searchQuery) && item.tokenName === "DAV") {
        return true;
      }
      if (["p", "ps", "psta", "pstat", "pstate"].includes(searchQuery) && item.tokenName === "STATE") {
        return true;
      }
      return tokenName.includes(searchQuery);
    });
  }, [tokens, localSearchQuery]);

  const getSortedTokens = useCallback((tokensToSort) => {
    const order = { DAV: 0, STATE: 1 };
    // /info request: remove DAV row entirely
    const supported = tokensToSort.filter((t) => t.isSupported && t.tokenName !== 'DAV');
    return supported
      .slice()
      .sort((a, b) => {
        const aPri = order[a.tokenName] ?? 99;
        const bPri = order[b.tokenName] ?? 99;
        if (aPri !== bPri) return aPri - bPri;
        return String(a.tokenName).localeCompare(String(b.tokenName));
      });
  }, []);

  const sortedTokens = useMemo(() => {
    const list = localSearchQuery ? filteredTokens : tokens;
    return getSortedTokens(list);
  }, [tokens, filteredTokens, localSearchQuery, getSortedTokens]);

  const dataToShow = useMemo(() => {
    if (selectedToken) {
      const found = tokens.find((token) => token.tokenName === selectedToken.name);
      // If user selected DAV (or it resolves to DAV), fall back to first non-DAV row.
      if (found && found.tokenName !== 'DAV') return found;
    }
    return sortedTokens[0] || null;
  }, [selectedToken, tokens, sortedTokens]);

  // ========== BACKGROUND AMM CALCULATIONS ==========
  const { ammValuesMap, totalSum, isCalculating } = useBackgroundAmmCalculator(
    sortedTokens,
    tokenBalances,
    chainId,
    TOKENS
  );

  const handleSearch = useCallback((e) => {
    setLocalSearchQuery(e.target.value.trim());
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
    notifySuccess("Data refreshed!");
  }, [refetch]);

  return (
    <div className="container mt-3 p-0 pb-4 mb-5">
      <div className="mb-3 d-flex justify-content-center align-items-center gap-3 dex-search-bar-row">
        <input
          type="text"
          className="form-control text-center"
          placeholder="Search"
          value={localSearchQuery}
          onChange={handleSearch}
          style={{ maxWidth: "300%", "--placeholder-color": "#6c757d" }}
        />
      </div>

      <div className="table-responsive info-page">
        {dataToShow ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th className="text-center">Token <br /> Name</th>
                  <th className="text-center">Info</th>
                  <th className="text-center">
                    PLS Value Excl. Rewards <br />
                    {loading ? (
                      <IOSpinner />
                    ) : (
                      <span style={{ position: 'relative' }}>
                        {`${totalSum} ${nativeSymbol}`}
                        {isCalculating && (
                          <span
                            style={{
                              marginLeft: '4px',
                              fontSize: '0.7em',
                              opacity: 0.6,
                              animation: 'pulse 1s infinite'
                            }}
                            title="Updating values in background..."
                          >
                            ⟳
                          </span>
                        )}
                      </span>
                    )}
                  </th>
                  <th className="text-center">DEX</th>

                  {/**
                   * Columns intentionally removed on /info:
                   * - Current Ratio
                   * - Auctions
                   * - DAV Vault
                   * - Burned
                   * - Burned LP (Combined)
                   * Also removed the trailing Info status (Renounced/ADDED/Add/-------).
                   */}
                </tr>
              </thead>
              <tbody>
                {isInitialLoading ? (
                  [...Array(1)].map((_, index) => (
                    <tr key={index} className="table-skeleton-row">
                      <td colSpan="4">
                        <div className="skeleton-wrapper">
                          <div className="skeleton-block" style={{ width: "25%", height: "24px" }} />
                          <div className="skeleton-block" style={{ width: "35%", height: "22px" }} />
                          <div className="skeleton-block" style={{ width: "20%", height: "20px" }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedTokens.map((token) => (
                    <TokenRow
                      key={`${(token.TokenAddress && typeof token.TokenAddress === 'string' ? token.TokenAddress.toLowerCase() : '') || token.tokenName}`}
                      token={token}
                      tokenBalances={tokenBalances}
                      pstateToPlsRatio={pstateToPlsRatio}
                      chainId={chainId}
                      totalStateBurned={0}
                      showDot={false}
                      handleAddToken={handleAddToken}
                      DavAddress={""}
                      setDavAndStateIntoSwap={() => {}}
                      nativeSymbol={nativeSymbol}
                      explorerUrl={explorerUrl}
                      combinedDeployedLP={0}
                      statePoolAddress={""}
                      preCalculatedAmmValue={ammValuesMap[token.tokenName] || "Loading..."}
                      compactInfoPage={true}
                    />
                  ))
                )}
              </tbody>
            </table>

            {loading && filteredTokens.length > 0 && (
              <div className="container text-center mt-5">
                <p className="funny-loading-text">
                  <IOSpinner /> Fetching..
                </p>
              </div>
            )}

            {!loading && filteredTokens.length === 0 && (
              <div className="alert alert-warning text-center" role="alert">
                No tokens found matching the search query.
              </div>
            )}
          </>
        ) : (
          <div className="alert alert-warning text-center" role="alert">
            No tokens available to display.
          </div>
        )}
      </div>
    </div>
  );
};

DetailsInfo.propTypes = {
  selectedToken: PropTypes.object,
};

export default memo(DetailsInfo);

DetailsInfoFull.propTypes = {
  selectedToken: PropTypes.object,
};

DetailsInfoInfoPage.propTypes = {
  selectedToken: PropTypes.object,
};