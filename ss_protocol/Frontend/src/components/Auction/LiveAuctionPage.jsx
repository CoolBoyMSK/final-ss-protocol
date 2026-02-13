import { useMemo } from "react";
import { useChainId } from "wagmi";
import AuctionBoxes from "./AuctionBoxes";
import ComingSoonBox from "./ComingSoonBox";
import DavEligibilityWarning from "../DavEligibilityWarning";
import { getRuntimeConfigSync } from "../../Constants/RuntimeConfig";

const LiveAuctionPage = ({ uiVariant } = {}) => {
  const chainId = useChainId();
  const prefix = useMemo(() => {
    const cfg = getRuntimeConfigSync();
    return cfg?.network?.symbolPrefix || 'p';
  }, [chainId]);
  // DAV ACCESS GATE (DISABLED)
  // Per request: remove access restrictions for /live-auction but keep the code for future use.
  //
  // const { address, isConnected } = useAccount();
  // const { davHolds, davExpireHolds, davGovernanceHolds, isLoading } = useDAvContract() || {};
  //
  // const status = useMemo(() => {
  //   // Normalize to numbers; values come as strings like "0.0"
  //   const active = parseFloat(davHolds || "0");
  //   const expired = parseFloat(davExpireHolds || "0");
  //   const total = parseFloat(davGovernanceHolds || "0");
  //   
  //   // Check if we have cached DAV data (non-default values)
  //   const hasCachedData = active > 0 || expired > 0 || total > 0;
  //
  //   if (!isConnected || !address) return "no-wallet";
  //   // Only show loading if no cached data available
  //   if (isLoading && !hasCachedData) return "loading";
  //
  //   // Bypass DAV requirement for allowlisted wallet(s)
  //   if (isBypassedAddress(address)) return "ok";
  //
  //   // No DAV at all
  //   if (total <= 0) return "no-dav";
  //
  //   // Has tokens but all are expired (active = 0, expired > 0)
  //   if (active <= 0 && expired > 0) return "expired";
  //
  //   // Eligible
  //   return "ok";
  // }, [isConnected, address, isLoading, davHolds, davExpireHolds, davGovernanceHolds]);
  //
  // // Once user is confirmed eligible (status === 'ok'), keep auctions visible even if loading
  // const [hasPassedGate, setHasPassedGate] = useState(false);
  // useEffect(() => {
  //   if (status === "ok" && !hasPassedGate) setHasPassedGate(true);
  // }, [status, hasPassedGate]);
  //
  // const renderGateMessage = () => {
  //   if (status === "loading") {
  //     return (
  //       <div className="text-center my-5">
  //         <div className="spinner-border text-light" role="status">
  //           <span className="visually-hidden">Loading...</span>
  //         </div>
  //         <p className="mt-3 text-light">Checking your DAV eligibility…</p>
  //       </div>
  //     );
  //   }
  //
  //   if (status === "no-wallet") {
  //     return (
  //       <div className="card bg-dark text-light border-0 shadow-sm my-4">
  //         <div className="card-body text-center py-5">
  //           <h5 className="card-title mb-3">Connect your wallet to verify DAV eligibility</h5>
  //           <p className="card-text mb-4">
  //             Please connect your wallet to verify DAV eligibility for auctions.
  //           </p>
  //         </div>
  //       </div>
  //     );
  //   }
  //
  //   if (status === "no-dav") {
  //     return (
  //       <div className="card bg-dark text-light border-0 shadow-sm my-4">
  //         <div className="card-body text-center py-5">
  //           <h5 className="card-title mb-3">Auction participation requires a DAV token</h5>
  //           <p className="card-text mb-4">
  //             You don’t hold a DAV token yet. Mint one to participate in live auctions.
  //           </p>
  //           <Link to="/davpage" className="btn btn-primary">Go to DAV Mint</Link>
  //         </div>
  //       </div>
  //     );
  //   }
  //
  //   if (status === "expired") {
  //     return (
  //       <div className="card bg-dark text-light border-0 shadow-sm my-4">
  //         <div className="card-body text-center py-5">
  //           <h5 className="card-title mb-3">Your DAV token has expired</h5>
  //           <p className="card-text mb-4">Please mint a new DAV token to continue participating in live auctions.</p>
  //           <Link to="/davpage" className="btn btn-primary">Mint New DAV</Link>
  //         </div>
  //       </div>
  //     );
  //   }
  //
  //   return null;
  // };
  //
  // // After first successful eligibility, do not hide auctions on subsequent refreshes
  // const showAuctions = status === "ok" || hasPassedGate;

  return (
    <div className="container mt-4">
      <DavEligibilityWarning
        featureLabel="Live Auction"
        actionVerb="participating in"
        noDavTitle="Mint DAV token to participate in the daily auctions"
        noDavMessage="You can still view this page, but participating in Live Auction requires holding a DAV token."
      />
      {/* Auction grid */}
      <div className="row g-4 d-flex align-items-stretch pb-1">
        <div className="col-md-4 p-0 m-2 cards">
          <AuctionBoxes uiVariant={uiVariant} />
        </div>
        <div className="col-md-4 p-0 m-2 cards coming-soon-offset second-box-adjust">
          <ComingSoonBox title={`${prefix}DAV2`} note="Coming Soon..." />
        </div>
        <div className="col-md-4 p-0 m-2 cards coming-soon-offset">
          <ComingSoonBox title={`${prefix}DAV3`} note="Coming Soon..." />
        </div>
      </div>
    </div>
  );
};

export default LiveAuctionPage;
