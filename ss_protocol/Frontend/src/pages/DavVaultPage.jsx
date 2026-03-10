import { useEffect, useMemo, useState } from "react";
import { useChainId } from "wagmi";
import LiveAuctionPage from "../components/Auction/LiveAuctionPage";
import InfoPage from "../components/Info/InfoPage";
import ContractsModal from "../components/ContractsModal";
import { useDeploymentStore } from "../stores";
import { getDeploymentStatus, getRuntimeConfigSync } from "../Constants/RuntimeConfig";
import { computeManualPhase } from "../utils/auctionTiming";

const DAV1_START_ANCHOR_UTC = 1773496800; // 2026-03-14 14:00:00 UTC (GMT+3 17:00)
const DAV2_DEX_START_ANCHOR_UTC = 1772373600; // 2026-03-01 14:00:00 UTC (GMT+3 17:00)
const DAV3_START_ANCHOR_UTC = 1772460000; // 2026-03-02 14:00:00 UTC (GMT+3 17:00)

const formatCountdown = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) return `${days}d ${hh}:${mm}:${ss}`;
  return `${hh}:${mm}:${ss}`;
};

const resolveInitialRightView = () => {
  try {
    const saved = String(localStorage.getItem("davVaultRightView") || "auction").toLowerCase();
    return saved === "dex" ? "dex" : "auction";
  } catch {
    return "auction";
  }
};

export default function DavVaultPage() {
  const [rightView, setRightView] = useState(resolveInitialRightView);
  const [showDav1TimedCover, setShowDav1TimedCover] = useState(false);
  const [dav1Countdown, setDav1Countdown] = useState(0);
  const [showDav2TimedCover, setShowDav2TimedCover] = useState(false);
  const [dav2Countdown, setDav2Countdown] = useState(0);
  const [showDav3TimedCover, setShowDav3TimedCover] = useState(false);
  const [dav3Countdown, setDav3Countdown] = useState(0);
  const chainId = useChainId();
  const selectedDavId = useDeploymentStore((state) => state.selectedDavId);
  const setSelectedDavId = useDeploymentStore((state) => state.setSelectedDavId);
  const isActive = (view) => rightView === view;

  const prefix = useMemo(() => {
    const cfg = getRuntimeConfigSync();
    return cfg?.network?.symbolPrefix || 'p';
  }, [chainId, selectedDavId]);

  const symbolFor = (davId) => `${prefix}${davId}`;

  const davAvailability = useMemo(() => ({
    DAV1: getDeploymentStatus(chainId, "DAV1").ready,
    DAV2: getDeploymentStatus(chainId, "DAV2").ready,
    DAV3: getDeploymentStatus(chainId, "DAV3").ready,
  }), [chainId]);

  useEffect(() => {
    if (davAvailability[selectedDavId]) return;
    setSelectedDavId("DAV1");
  }, [davAvailability, selectedDavId, setSelectedDavId]);

  const auctionDayNumber = useMemo(() => {
    // Anchor: 2026-03-14 14:00:00 UTC = 17:00 GMT+3 (matches utils/auctionTiming.js manual schedule anchor)
    const anchorMs = Date.parse("2026-03-14T14:00:00Z");
    if (!Number.isFinite(anchorMs)) return null;
    const nowMs = Date.now();
    const deltaMs = nowMs - anchorMs;
    if (deltaMs < 0) return 0;
    return Math.floor(deltaMs / 86400000) + 1;
  }, []);

  const dav2DayNumber = useMemo(() => {
    const anchorMs = DAV2_DEX_START_ANCHOR_UTC * 1000;
    const nowMs = Date.now();
    const deltaMs = nowMs - anchorMs;
    if (deltaMs < 0) return 0;
    return Math.floor(deltaMs / 86400000) + 1;
  }, []);

  const dav3DayNumber = useMemo(() => {
    const anchorMs = DAV3_START_ANCHOR_UTC * 1000;
    const nowMs = Date.now();
    const deltaMs = nowMs - anchorMs;
    if (deltaMs < 0) return 0;
    return Math.floor(deltaMs / 86400000) + 1;
  }, []);

  useEffect(() => {
    if (rightView !== "dex") return;

    const root = document.querySelector(".dav-vault-info");
    if (!root) return;

    const hideDexExtras = () => {
      // Hide any "Renounced" labels and placeholder dashes within the embedded info table.
      root.querySelectorAll("span").forEach((el) => {
        const text = (el.textContent || "").trim();
        if (text === "Renounced" || /^-+$/.test(text)) {
          el.style.display = "none";
        }
      });

      // Hide ALL DAV token rows within this embedded view (search can reorder/re-render rows).
      const rows = root.querySelectorAll("table tbody tr");
      rows.forEach((tr) => {
        const firstCellText = (tr.querySelector("td")?.textContent || "").trim();
        // Match the standalone DAV token row, not pDAV variants.
        if (/\bDAV\b/.test(firstCellText) && !/\bpDAV\b/i.test(firstCellText)) {
          tr.style.display = "none";
        }
      });
    };

    let rafId = 0;
    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(hideDexExtras);
    };

    // Run once on mount, then keep re-applying after any DOM changes (e.g. search filtering).
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [rightView]);

  useEffect(() => {
    const shouldCheckCover = selectedDavId === "DAV1" && (rightView === "dex" || rightView === "auction");
    if (!shouldCheckCover) {
      setShowDav1TimedCover(false);
      setDav1Countdown(0);
      return;
    }

    const updateCoverState = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const phase = computeManualPhase(nowSec, {
        duration: 86400,
        interval: 0,
        anchorUtc: DAV1_START_ANCHOR_UTC,
      });

      const isBeforeAuctionStart = phase?.phase === "interval";
      setShowDav1TimedCover(isBeforeAuctionStart);
      setDav1Countdown(isBeforeAuctionStart ? Math.max(0, Number(phase?.secondsLeft || 0)) : 0);
    };

    updateCoverState();
    const timerId = setInterval(updateCoverState, 1000);
    return () => clearInterval(timerId);
  }, [selectedDavId, rightView]);

  useEffect(() => {
    const shouldCheckCover = selectedDavId === "DAV2" && (rightView === "dex" || rightView === "auction");
    if (!shouldCheckCover) {
      setShowDav2TimedCover(false);
      setDav2Countdown(0);
      return;
    }

    const updateCoverState = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const phase = computeManualPhase(nowSec, {
        duration: 86400,
        interval: 0,
        anchorUtc: DAV2_DEX_START_ANCHOR_UTC,
      });

      const isBeforeAuctionStart = phase?.phase === "interval";
      setShowDav2TimedCover(isBeforeAuctionStart);
      setDav2Countdown(isBeforeAuctionStart ? Math.max(0, Number(phase?.secondsLeft || 0)) : 0);
    };

    updateCoverState();
    const timerId = setInterval(updateCoverState, 1000);
    return () => clearInterval(timerId);
  }, [selectedDavId, rightView]);

  useEffect(() => {
    const shouldCheckCover = selectedDavId === "DAV3" && (rightView === "dex" || rightView === "auction");
    if (!shouldCheckCover) {
      setShowDav3TimedCover(false);
      setDav3Countdown(0);
      return;
    }

    const updateCoverState = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const phase = computeManualPhase(nowSec, {
        duration: 86400,
        interval: 0,
        anchorUtc: DAV3_START_ANCHOR_UTC,
      });

      const isBeforeAuctionStart = phase?.phase === "interval";
      setShowDav3TimedCover(isBeforeAuctionStart);
      setDav3Countdown(isBeforeAuctionStart ? Math.max(0, Number(phase?.secondsLeft || 0)) : 0);
    };

    updateCoverState();
    const timerId = setInterval(updateCoverState, 1000);
    return () => clearInterval(timerId);
  }, [selectedDavId, rightView]);

  useEffect(() => {
    try {
      localStorage.setItem("davVaultRightView", rightView === "dex" ? "dex" : "auction");
    } catch { }
  }, [rightView]);

  return (
    <div className="container mt-4 mb-4 dav-vault-page">
      <style>{`
        /* Keep the overall /dav-vault layout from growing on desktop; scroll inside panels instead. */
        .dav-vault-page {
          padding-top: 0;
          padding-bottom: 0;
        }

        /* Match Dav Mint (/davpage) box background color */
        .dav-vault-page .card {
          background-color: #212529 !important;
        }

        /* Dav Mint-style spacing: avoid extra card margins inside the 3-panel row */
        .dav-vault-page .dav-vault-card {
          margin: 0 !important;
        }

        /* Right panel should be edge-to-edge for embedded content */
        .dav-vault-page .dav-vault-right-card {
          padding: 0 !important;
        }

        /* Avoid focus/active color flash on the toggle buttons (page-scoped). */
        .dav-vault-page .btn:focus,
        .dav-vault-page .btn:focus-visible,
        .dav-vault-page .btn:active {
          outline: none !important;
          box-shadow: none !important;
        }
        .dav-vault-page .btn {
          -webkit-tap-highlight-color: transparent;
        }

        /* /dav-vault: unify all buttons to match the auction action button feel */
        .dav-vault-page .dav-vault-btn {
          border-radius: 9999px !important;
          text-transform: none !important;
          font-family: 'Satoshi', sans-serif;
          font-weight: 600;
        }

        /* Lock toggle button colors so they don't "flash" during press. */
        .dav-vault-page .dav-vault-btn.btn-primary,
        .dav-vault-page .dav-vault-btn.btn-primary:hover,
        .dav-vault-page .dav-vault-btn.btn-primary:active,
        .dav-vault-page .dav-vault-btn.btn-primary:focus,
        .dav-vault-page .dav-vault-btn.btn-primary:focus-visible {
          background: linear-gradient(90deg, #2575fc 0%, #6a11cb 100%) !important;
          border-color: transparent !important;
        }

        .dav-vault-page .dav-vault-btn.btn-dark,
        .dav-vault-page .dav-vault-btn.btn-dark:hover,
        .dav-vault-page .dav-vault-btn.btn-dark:active,
        .dav-vault-page .dav-vault-btn.btn-dark:focus,
        .dav-vault-page .dav-vault-btn.btn-dark:focus-visible {
          background-color: var(--secondary-bg) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        @media (min-width: 992px) {
          .dav-vault-page .dav-vault-row {
            /* Fill more of the viewport (closer to header/footer) */
            height: calc(100vh - 180px);
            max-height: calc(100vh - 180px);
          }
          /* Slightly narrow side panels on desktop */
          .dav-vault-page .dav-vault-panel-card {
            width: 100%;
          }
          .dav-vault-page .dav-vault-row > [class*="col-"] {
            height: 100%;
          }
          .dav-vault-page .dav-vault-card {
            height: 100%;
          }
        }
      `}</style>

      <div className="row g-3 align-items-stretch dav-vault-row pb-1" style={{ minHeight: "calc(100vh - 180px)" }}>
        {/* Left column */}
        <div className="col-12 col-lg-3 d-flex flex-column">
          <div className="card flex-grow-1 dav-vault-card dav-vault-panel-card" style={{ borderRadius: 14 }}>
            <div className="d-flex flex-column gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDavId("DAV1");
                  setRightView("auction");
                }}
                className={`w-100 text-center dav-vault-btn btn ${selectedDavId === "DAV1" ? "btn-primary" : "btn-dark"}`}
                style={{
                  borderRadius: 9999,
                  padding: "10px 12px",
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: "none",
                  position: "relative",
                }}
              >
                <i className="bi bi-chevron-right" style={{ position: "absolute", right: 14, top: 16 }} />

                <div className="d-flex flex-column align-items-center">
                  <div>
                    JP Morgains
                    <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.95 }}>
                      {symbolFor('DAV1')} - {typeof auctionDayNumber === "number" && auctionDayNumber > 0 ? `Day ${auctionDayNumber}` : "Coming Soon..."}
                    </div>
                  </div>
                </div>

                <div style={{ height: 0 }} />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!davAvailability.DAV2) return;
                  setSelectedDavId("DAV2");
                  setRightView("auction");
                }}
                className={`w-100 text-center dav-vault-btn btn ${selectedDavId === "DAV2" ? "btn-primary" : "btn-dark"}`}
                disabled={!davAvailability.DAV2}
                style={{
                  borderRadius: 9999,
                  padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontWeight: 700,
                  position: "relative",
                  opacity: davAvailability.DAV2 ? 1 : 0.7,
                  cursor: davAvailability.DAV2 ? "pointer" : "not-allowed",
                }}
              >
                <i className="bi bi-chevron-right" style={{ position: "absolute", right: 14, top: 16, opacity: 0.7 }} />
                <div className="d-flex flex-column align-items-center">
                  <div>
                    GM Sachs
                    <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                      {symbolFor('DAV2')} - {davAvailability.DAV2 && typeof dav2DayNumber === "number" && dav2DayNumber > 0 ? `Day ${dav2DayNumber}` : "Coming Soon..."}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!davAvailability.DAV3) return;
                  setSelectedDavId("DAV3");
                  setRightView("auction");
                }}
                className={`w-100 text-center dav-vault-btn btn ${selectedDavId === "DAV3" ? "btn-primary" : "btn-dark"}`}
                disabled={!davAvailability.DAV3}
                style={{
                  borderRadius: 9999,
                  padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontWeight: 700,
                  position: "relative",
                  opacity: davAvailability.DAV3 ? 1 : 0.7,
                  cursor: davAvailability.DAV3 ? "pointer" : "not-allowed",
                }}
              >
                <i className="bi bi-chevron-right" style={{ position: "absolute", right: 14, top: 16, opacity: 0.7 }} />
                <div className="d-flex flex-column align-items-center">
                  <div>
                    Deutsche Bros
                    <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                      {symbolFor('DAV3')} - {davAvailability.DAV3 && typeof dav3DayNumber === "number" && dav3DayNumber > 0 ? `Day ${dav3DayNumber}` : "Coming Soon..."}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Middle column */}
        <div className="col-12 col-lg-3 d-flex flex-column">
          <div className="card flex-grow-1 dav-vault-card dav-vault-panel-card" style={{ borderRadius: 14 }}>
            <div className="d-flex flex-column gap-3">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  setRightView("auction");
                  e.currentTarget.blur();
                }}
                className={`dav-vault-btn ${isActive("auction") ? "btn btn-primary w-100" : "btn btn-dark w-100"}`}
                style={{
                  borderRadius: 9999,
                  fontWeight: 600,
                  padding: "14px 18px",
                  fontSize: 14,
                  lineHeight: 1.3,
                  minHeight: 64,
                }}
              >
                Auction
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  setRightView("dex");
                  e.currentTarget.blur();
                }}
                className={`dav-vault-btn ${isActive("dex") ? "btn btn-primary w-100" : "btn btn-dark w-100"}`}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9999,
                  fontWeight: 600,
                  padding: "14px 18px",
                  fontSize: 14,
                  minHeight: 64,
                }}
              >
                Dex
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-12 col-lg-6 d-flex flex-column">
          <div className="card flex-grow-1 dav-vault-card dav-vault-right-card" style={{ borderRadius: 14, minHeight: 420, overflow: "hidden", position: "relative" }}>
            <div
              className={`dav-vault-embed ${rightView === "dex" ? "dav-vault-info" : rightView === "contracts" ? "dav-vault-contracts" : "dav-vault-auction"}`}
              style={{
                padding: rightView === "dex" ? 12 : rightView === "auction" ? 12 : 0,
                paddingTop: rightView === "dex" ? 12 : rightView === "auction" ? 12 : 8,
                height: "100%",
                overflow: rightView === "dex" ? "hidden" : "auto",
              }}
            >
              <style>{`
                /* Remove top gaps in the embedded DEX view so it sits flush */
                .dav-vault-info .mt-4 { margin-top: 0 !important; }
                .dav-vault-info .container.mt-4 { margin-top: 0 !important; }

                /* DEX embed: slightly lift the search bar */
                .dav-vault-info .dex-search-bar-row { margin-top: -14px !important; }

                /* DEX embed: keep a persistent bottom gap by making only the table area scroll */
                .dav-vault-info .container.mt-4 {
                  height: 100% !important;
                  margin-bottom: 0 !important;
                  display: flex !important;
                  flex-direction: column !important;
                }
                .dav-vault-info .dex-search-bar-row {
                  flex: 0 0 auto;
                }
                .dav-vault-info .table-responsive {
                  flex: 1 1 auto;
                  min-height: 0;
                  overflow: auto !important;
                  margin-bottom: 8px !important;
                }

                /* Auction embed: match the same outer spacing as DEX (no extra top margin from inner containers) */
                .dav-vault-auction .mt-4 { margin-top: 0 !important; }
                .dav-vault-auction .container.mt-4 { margin-top: 0 !important; }
                .dav-vault-embed .container { max-width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
                .dav-vault-embed .coming-soon-offset { display: none !important; }
                .dav-vault-embed .row.g-4 { margin-left: 0 !important; margin-right: 0 !important; }
                .dav-vault-embed .row.g-4 > .col-md-4:not(.coming-soon-offset) { flex: 1 1 100% !important; max-width: 100% !important; }
                .dav-vault-embed .row.g-4 > .col-md-4:not(.coming-soon-offset) { margin: 0 !important; }

                /* DEX embed: remove any remaining wrapper spacing */
                .dav-vault-info .table-responsive { margin: 0 0 -10px 0 !important; padding: 0 !important; border-radius: 0 !important; }

                /* DEX embed: tighten Info column spacing and remove placeholder dashes/status */
                .dav-vault-info table thead th,
                .dav-vault-info table tbody td {
                  padding-left: 0.75rem !important;
                  padding-right: 0.75rem !important;
                }

                .dav-vault-info table tbody td:nth-child(7)
                  .d-flex.justify-content-center.align-items-center.gap-3 {
                  gap: 0.75rem !important;
                }
                /* Remove the trailing status block (Renounced/ADDED/-------) in this embedded view */
                .dav-vault-info table tbody td:nth-child(7)
                  .d-flex.justify-content-center.align-items-center.gap-3 > div:last-child {
                  display: none !important;
                }
                /* Undo any negative right margin used on the MetaMask icon wrapper */
                .dav-vault-info table tbody td:nth-child(7) .d-flex.align-items-center {
                  margin-right: 0 !important;
                }

                /* /dav-vault only: make embedded Smart Contracts fill this right panel */
                .dav-vault-contracts .dav-vault-contracts-inner {
                  height: 100%;
                  width: 100%;
                  display: flex;
                  align-items: stretch;
                  justify-content: stretch;
                }
                .dav-vault-contracts .dav-vault-contracts-inner > .contracts-modal {
                  flex: 1 1 auto;
                  height: 100% !important;
                  max-height: none !important;
                  width: 100% !important;
                  max-width: none !important;
                }

                /* /dav-vault only: remove auction "box" background (keep just content/values) */
                .dav-vault-auction .auction-frame,
                .dav-vault-auction .auction-frame.reverse {
                  background: transparent !important;
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                }
                .dav-vault-auction .auction-row,
                .dav-vault-auction .auction-row.small,
                .dav-vault-auction .auction-row-stack {
                  background: transparent !important;
                  border: none !important;
                }
                .dav-vault-auction .row-legend {
                  background: transparent !important;
                }

                /* In /dav-vault only: remove these columns from the embedded /info table:
                   Current Ratio, Auctions, DAV Vault, Burned, Burned LP (Combined) */
                .dav-vault-info table thead th:nth-child(2),
                .dav-vault-info table thead th:nth-child(3),
                .dav-vault-info table thead th:nth-child(4),
                .dav-vault-info table thead th:nth-child(5),
                .dav-vault-info table thead th:nth-child(6),
                .dav-vault-info table tbody td:nth-child(2),
                .dav-vault-info table tbody td:nth-child(3),
                .dav-vault-info table tbody td:nth-child(4),
                .dav-vault-info table tbody td:nth-child(5),
                .dav-vault-info table tbody td:nth-child(6) {
                  display: none !important;
                }
              `}</style>

              {rightView === "auction" ? (
                <LiveAuctionPage uiVariant="davVault" />
              ) : rightView === "dex" ? (
                <InfoPage />
              ) : (
                <div className="dav-vault-contracts-inner">
                  <ContractsModal
                    embedded
                    uiVariant="davVault"
                    isOpen={true}
                    onClose={() => setRightView("auction")}
                  />
                </div>
              )}
            </div>
            {(rightView === "dex" || rightView === "auction") && selectedDavId === "DAV1" && showDav1TimedCover ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="contracts-coming-soon" style={{ minHeight: "100%" }}>
                  <div className="contracts-coming-network">{`${symbolFor("DAV1")} ${rightView === "auction" ? "AUCTION" : "DEX"}`}</div>
                  <div className="contracts-coming-dav">Coming Soon...</div>
                  <div className="contracts-coming-note">{`Auction starts in ${formatCountdown(dav1Countdown)}`}</div>
                </div>
              </div>
            ) : null}
            {(rightView === "dex" || rightView === "auction") && selectedDavId === "DAV2" && showDav2TimedCover ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="contracts-coming-soon" style={{ minHeight: "100%" }}>
                  <div className="contracts-coming-network">{`${symbolFor("DAV2")} ${rightView === "auction" ? "AUCTION" : "DEX"}`}</div>
                  <div className="contracts-coming-dav">Coming Soon...</div>
                  <div className="contracts-coming-note">{`Auction starts in ${formatCountdown(dav2Countdown)}`}</div>
                </div>
              </div>
            ) : null}
            {(rightView === "dex" || rightView === "auction") && selectedDavId === "DAV3" && showDav3TimedCover ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="contracts-coming-soon" style={{ minHeight: "100%" }}>
                  <div className="contracts-coming-network">{`${symbolFor("DAV3")} ${rightView === "auction" ? "AUCTION" : "DEX"}`}</div>
                  <div className="contracts-coming-dav">Coming Soon...</div>
                  <div className="contracts-coming-note">{`Auction starts in ${formatCountdown(dav3Countdown)}`}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
