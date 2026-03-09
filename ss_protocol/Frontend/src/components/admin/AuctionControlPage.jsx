import React, { useEffect, useState } from "react";
import { useContractContext } from "../../Functions/useContractContext";
import { toast } from "react-hot-toast";
import { createSmartPoller } from '../../utils/smartPolling';
import { useDeploymentStore } from "../../stores";

export default function AuctionControlPage() {
  const { AuctionContract, SwapLens } = useContractContext();
  const selectedDavId = useDeploymentStore((state) => state.selectedDavId);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ scheduled: false, start: 0, daysLimit: 0, count: 0 });
  const [nowTs, setNowTs] = useState(Math.floor(Date.now() / 1000));

  const formatCountdown = (totalSeconds) => {
    const safe = Math.max(0, Math.floor(Number(totalSeconds || 0)));
    const days = Math.floor(safe / 86400);
    const hours = Math.floor((safe % 86400) / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  };

  const startScheduleByDav = {
    DAV1: {
      display: "Feb 28, 2026 - 5:00 PM GMT+3",
      tz: "5:00 PM GMT+3",
      targetUtc: "2026-02-28T14:00:00Z",
    },
    DAV2: {
      display: "Mar 1, 2026 - 5:00 PM GMT+3",
      tz: "5:00 PM GMT+3",
      targetUtc: "2026-03-01T14:00:00Z",
    },
    DAV3: {
      display: "Mar 2, 2026 - 5:00 PM GMT+3",
      tz: "5:00 PM GMT+3",
      targetUtc: "2026-03-02T14:00:00Z",
    },
  };

  const activeDavId = String(selectedDavId || "DAV1").toUpperCase();
  const activeSchedule = startScheduleByDav[activeDavId] || startScheduleByDav.DAV1;
  const targetTs = Math.floor(Date.parse(activeSchedule.targetUtc) / 1000);
  const secondsToTarget = targetTs - nowTs;
  const isTooEarly = secondsToTarget > 86400;
  const isInitWindowOpen = secondsToTarget > 0 && secondsToTarget <= 86400;
  const isPastTarget = secondsToTarget <= 0;

  const canStartAuction = Boolean(AuctionContract) && !status.scheduled && isInitWindowOpen && !loading;

  const statusTone = status.scheduled
    ? "success"
    : isTooEarly
      ? "danger"
      : isInitWindowOpen
        ? "success"
        : "warning";

  const statusTitle = status.scheduled
    ? "Initialization Completed"
    : isTooEarly
      ? "Initialization Not Yet Available"
      : isInitWindowOpen
        ? "Initialization Window Open"
        : "Initialization Window Closed";

  const statusDetail = status.scheduled
    ? "Auction schedule is active for this DAV. No further initialization is required."
    : isTooEarly
      ? `Initialization becomes available in ${formatCountdown(secondsToTarget - 86400)}. You can initialize only within the final 24 hours before target start.`
      : isInitWindowOpen
        ? `You are within the approved 24-hour initialization window. Time remaining to target start: ${formatCountdown(secondsToTarget)}.`
        : "The target start time has passed. If schedule is still not initialized, proceed immediately with governance coordination.";

  const disabledReason = !AuctionContract
    ? "Auction contract not ready"
    : status.scheduled
      ? ""
      : isTooEarly
        ? `Initialization is not available yet. Window opens in ${formatCountdown(secondsToTarget - 86400)}.`
        : isPastTarget
          ? "Target time has passed. Initialization is restricted to the final 24 hours before target."
          : "Initialization window is open";

  const statusIcon = status.scheduled
    ? "bi bi-check-circle-fill"
    : isTooEarly
      ? "bi bi-shield-exclamation"
      : isInitWindowOpen
        ? "bi bi-check2-circle"
        : "bi bi-exclamation-triangle-fill";

  const statusMetricLabel = status.scheduled
    ? "Status"
    : isTooEarly
      ? "Window Opens In"
      : isInitWindowOpen
        ? "Time To Target"
        : "Delay Since Target";

  const statusMetricValue = status.scheduled
    ? "Initialized"
    : isTooEarly
      ? formatCountdown(secondsToTarget - 86400)
      : isInitWindowOpen
        ? formatCountdown(secondsToTarget)
        : formatCountdown(Math.abs(secondsToTarget));

  const nowGmt3 = (() => {
    const dt = new Date(nowTs * 1000);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(dt) + " GMT+3";
  })();

  const loadStatus = async () => {
    if (!AuctionContract) return;
    try {
      const contractAddr = AuctionContract?.target || AuctionContract?.address;
      let scheduled = false;
      let start = 0;
      let daysLimit = 0;
      let scheduledCount = 0;

      // Primary source: SwapLens schedule config (explicit flag only)
      if (SwapLens && contractAddr) {
        try {
          const res = await SwapLens.getScheduleConfig(contractAddr);
          if (Array.isArray(res) && res.length >= 4) {
            const [isSet, startRaw, daysLimitRaw, countRaw] = res;
            start = Number(startRaw);
            daysLimit = Number(daysLimitRaw);
            scheduledCount = Number(countRaw);
            scheduled = Boolean(isSet); // Only trust explicit contract flag
          }
        } catch (e) {
          console.warn('SwapLens getScheduleConfig failed', e);
        }
      }

      // Secondary check: active flag from getTodayToken (indicates auction actually running)
      if (!scheduled && AuctionContract.getTodayToken) {
        try {
          const today = await AuctionContract.getTodayToken();
          // Expect [tokenAddr, active]; active true means schedule started
          if (Array.isArray(today) && today.length >= 2) {
            const active = Boolean(today[1]);
            if (active) scheduled = true;
          }
        } catch { }
      }

      // Remove all heuristic inference (tokenCount, non-zero token address, etc.) to prevent false positives

      setStatus({ scheduled, start, daysLimit, count: scheduledCount });
    } catch (e) {
      console.warn("Failed to load schedule", e);
    }
  };

  // Smart poll to reflect schedule state without manual refresh
  useEffect(() => {
    const poller = createSmartPoller(loadStatus, {
      activeInterval: 30000,
      idleInterval: 120000,
      fetchOnStart: true,
      fetchOnVisible: true,
      name: 'auction-control-status'
    });
    poller.start();
    return () => poller.stop();
  }, [AuctionContract]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const startAuction = async (e) => {
    e.preventDefault();
    if (!AuctionContract) {
      toast.error("Auction contract not ready", { duration: 5000 });
      return;
    }
    setLoading(true);
    try {
      // Contract calculates next GMT+3 5:00 PM internally; no params needed
      const tx = await AuctionContract.startAuctionWithAutoTokens();
      toast.success(`Start auction tx sent: ${tx.hash}`, { duration: 12000 });
      await tx.wait();
      toast.success("Auction system started successfully", { duration: 12000 });
      await loadStatus();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Failed to start auction", { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overview Card */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-1">🎯 AUCTION CONTROL</h5>
        </div>
        <div className="card-body">
          <div className="card mb-3 border-0" style={{ background: "#111827", color: "#e5e7eb", borderRadius: 14 }}>
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="d-flex align-items-center gap-2">
                  <i className={`${statusIcon} text-${statusTone}`}></i>
                  <h6 className="mb-0" style={{ letterSpacing: "0.02em" }}>Initialization Control — {activeDavId}</h6>
                </div>
                <span className={`badge text-bg-${statusTone} px-3 py-2 fw-semibold`}>{statusTitle}</span>
              </div>

              <div className="mb-3" style={{ color: "#9ca3af", fontSize: 14 }}>{statusDetail}</div>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 h-100" style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10 }}>
                    <div className="text-uppercase" style={{ color: "#9ca3af", fontSize: 11, letterSpacing: "0.08em" }}>Target Start</div>
                    <div className="fw-semibold mt-1">{activeSchedule.tz}</div>
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>{activeSchedule.display}</div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 h-100" style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10 }}>
                    <div className="text-uppercase" style={{ color: "#9ca3af", fontSize: 11, letterSpacing: "0.08em" }}>{statusMetricLabel}</div>
                    <div className={`fw-bold mt-1 text-${statusTone}`} style={{ fontSize: 18 }}>{statusMetricValue}</div>
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>{status.scheduled ? "Schedule active" : "Policy-based gate"}</div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 h-100" style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10 }}>
                    <div className="text-uppercase" style={{ color: "#9ca3af", fontSize: 11, letterSpacing: "0.08em" }}>Reference Time</div>
                    <div className="fw-semibold mt-1">GMT+3</div>
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>{nowGmt3}</div>
                  </div>
                </div>
              </div>

              <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                <div className="fw-semibold mb-2" style={{ fontSize: 13, color: "#d1d5db" }}>Checklist</div>
                <div className="small d-flex flex-column gap-2" style={{ color: "#9ca3af" }}>
                  <div>• Verify the selected DAV matches the intended schedule.</div>
                  <div>• Initialize only inside the final 24-hour window before target start.</div>
                  <div>• Confirm the target start time before submitting.</div>
                  <div>• After confirmation, ensure status updates to “Auction Initialized”.</div>
                </div>
              </div>
            </div>
          </div>

          {/* System Status Banner removed per request */}

          {/* Start Auction Form */}
          <div className="card bg-primary bg-opacity-10 border-primary">
            <div className="card-body">
              <h6 className="mb-3">
                <i className="bi bi-play-circle-fill me-2"></i>
                START AUCTION SYSTEM
              </h6>
              <form onSubmit={startAuction}>
                <div className="row g-3 align-items-center">
                  <div className="col-md-9">
                    <div className="alert alert-info mb-0">
                      <div>
                        <i className="bi bi-clock-history me-2"></i>
                        <strong>Auto-Scheduled Start Time ({activeDavId}):</strong> {activeSchedule.tz}
                      </div>
                        <small className="d-block mt-1">The auction will automatically start at {activeSchedule.tz} ({activeSchedule.display})</small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <button
                      className="btn btn-primary w-100 btn-lg"
                      type="submit"
                      disabled={!canStartAuction}
                      title={disabledReason}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Starting...
                        </>
                      ) : status.scheduled ? (
                        <>
                          <span role="img" aria-label="initialized" className="me-2">✅</span>
                          Auction Initialized
                        </>
                      ) : (
                        <>
                          <i className="bi bi-play-fill me-2"></i>
                          Start Auction System
                        </>
                      )}
                    </button>
                    {disabledReason ? (
                      <small className="d-block mt-2 text-light-emphasis">{disabledReason}</small>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Removed SYSTEM STATUS and AUCTION SYSTEM INFORMATION sections per request */}
    </>
  );
}