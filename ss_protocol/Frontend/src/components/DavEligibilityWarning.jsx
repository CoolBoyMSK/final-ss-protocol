import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { useDAvContract } from "../Functions/DavTokenFunctions";
import { isBypassedAddress } from "../utils/whitelist";

export default function DavEligibilityWarning({
  featureLabel,
  actionVerb = "using",
  noDavTitle,
  noDavMessage,
  expiredTitle,
  expiredMessage,
  noWalletTitle,
  noWalletMessage,
}) {
  const { address, isConnected } = useAccount();
  const { davHolds, davExpireHolds, davGovernanceHolds, isLoading } = useDAvContract() || {};

  const status = useMemo(() => {
    const active = parseFloat(davHolds || "0");
    const expired = parseFloat(davExpireHolds || "0");
    const total = parseFloat(davGovernanceHolds || "0");
    const hasCachedData = active > 0 || expired > 0 || total > 0;

    if (!isConnected || !address) return "no-wallet";
    // Show the "Mint DAV" warning immediately while balances are still loading.
    // This avoids the long blank delay that made the page feel slow.
    if (isLoading && !hasCachedData) return "no-dav";
    if (isBypassedAddress(address)) return "ok";
    if (total <= 0) return "no-dav";
    if (active <= 0 && expired > 0) return "expired";
    return "ok";
  }, [isConnected, address, isLoading, davHolds, davExpireHolds, davGovernanceHolds]);

  // If eligible, show nothing.
  if (status === "ok") return null;

  const title = (() => {
    if (status === "no-wallet") return noWalletTitle || "Connect your wallet to check DAV eligibility";
    if (status === "expired") return expiredTitle || "Your DAV token has expired";
    return noDavTitle || "Mint DAV token to participate in the daily auctions";
  })();

  return (
    <div
      className="alert"
      role="alert"
      style={{
        borderRadius: 12,
        backgroundColor: "#212529",
        border: "1px solid #ffffff26",
        color: "#ffffff",
      }}
    >
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
        </div>
        {(status === "no-dav" || status === "expired") && (
          <Link
            to="/davpage"
            className="btn btn-primary ss-pill-btn"
            style={{ padding: "6px 14px" }}
          >
            Mint DAV
          </Link>
        )}
      </div>
    </div>
  );
}
