import { ethers } from "ethers";

const RECLAIM_CACHE_TTL_MS = 30000;
const reclaimInfoCache = new Map();
const reclaimInFlight = new Map();

const toBigIntSafe = (value) => {
  try {
    if (typeof value === "bigint") return value;
    if (value === null || value === undefined) return 0n;
    return BigInt(value.toString());
  } catch {
    return 0n;
  }
};

export const getDavReclaimInfo = async (provider, davAddress) => {
  if (!provider || !davAddress || davAddress === ethers.ZeroAddress) {
    return { canReclaim: null, daysRemaining: null, totalUnclaimed: null };
  }

  const cacheKey = String(davAddress).toLowerCase();
  const now = Date.now();
  const cached = reclaimInfoCache.get(cacheKey);
  if (cached && now - cached.ts < RECLAIM_CACHE_TTL_MS) {
    return cached.value;
  }

  if (reclaimInFlight.has(cacheKey)) {
    return reclaimInFlight.get(cacheKey);
  }

  const run = (async () => {
    const davRead = new ethers.Contract(
      davAddress,
      [
        "function getReclaimInfo() view returns (bool,uint256,uint256)",
        "function swapContract() view returns (address)",
      ],
      provider
    );

    try {
      const raw = await davRead.getReclaimInfo();
      const tuple = Array.isArray(raw)
        ? raw
        : [raw?.canReclaim, raw?.daysRemaining, raw?.totalUnclaimed];
      const value = {
        canReclaim: Boolean(tuple[0]),
        daysRemaining: Number(tuple[1] || 0),
        totalUnclaimed: toBigIntSafe(tuple[2]),
      };
      reclaimInfoCache.set(cacheKey, { ts: Date.now(), value });
      return value;
    } catch {
      try {
        const swapAddr = await davRead.swapContract();
        if (!swapAddr || swapAddr === ethers.ZeroAddress) {
          const value = { canReclaim: false, daysRemaining: 999999, totalUnclaimed: 0n };
          reclaimInfoCache.set(cacheKey, { ts: Date.now(), value });
          return value;
        }

        const swapRead = new ethers.Contract(
          swapAddr,
          ["function auctionSchedule() view returns (bool,uint256,uint256,uint256,uint256)"],
          provider
        );
        const schedule = await swapRead.auctionSchedule();
        const scheduleSet = Boolean(schedule[0]);
        const scheduleStart = toBigIntSafe(schedule[1]);

        if (!scheduleSet || scheduleStart === 0n) {
          const value = { canReclaim: false, daysRemaining: 999999, totalUnclaimed: 0n };
          reclaimInfoCache.set(cacheKey, { ts: Date.now(), value });
          return value;
        }

        const currentBlock = await provider.getBlock("latest");
        const currentTimestamp = toBigIntSafe(currentBlock?.timestamp || 0);
        const daysSinceStart = (currentTimestamp - scheduleStart) / 86400n;

        if (daysSinceStart >= 3n) {
          const value = { canReclaim: true, daysRemaining: 0, totalUnclaimed: 0n };
          reclaimInfoCache.set(cacheKey, { ts: Date.now(), value });
          return value;
        }

        const value = {
          canReclaim: false,
          daysRemaining: Number(3n - daysSinceStart),
          totalUnclaimed: 0n,
        };
        reclaimInfoCache.set(cacheKey, { ts: Date.now(), value });
        return value;
      } catch {
        const value = { canReclaim: false, daysRemaining: 999999, totalUnclaimed: 0n };
        reclaimInfoCache.set(cacheKey, { ts: Date.now(), value });
        return value;
      }
    }
  })();

  reclaimInFlight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    reclaimInFlight.delete(cacheKey);
  }
};
