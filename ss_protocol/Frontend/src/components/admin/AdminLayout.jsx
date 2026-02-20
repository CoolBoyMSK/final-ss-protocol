import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { useGovernanceGate } from "./useGovernanceGate";
import { useDeploymentStore } from "../../stores";
import { getRuntimeConfigSync } from "../../Constants/RuntimeConfig";
import pulseLogo from "../../assets/pls1.png";
import polygonLogo from "../../assets/matic-token-icon.png";
import sonicLogo from "../../assets/S_token.svg";
import "../../Styles/Admin.css";

// Route-based code splitting for Admin pages - 5-Step Deployment Workflow
const SystemInitializationPage = lazy(() => import("./SystemInitializationPage"));
const BuyBurnSetupPage = lazy(() => import("./BuyBurnSetupPage"));
const TokenManagementPage = lazy(() => import("./TokenManagementPage"));
const AuctionControlPage = lazy(() => import("./AuctionControlPage"));
const GovernancePage = lazy(() => import("./GovernancePage"));

export default function AdminLayout() {
  const { isGovernance, governanceAddress, loading } = useGovernanceGate();
  const { address } = useAccount();
  const chainId = useChainId();
  const selectedDavId = useDeploymentStore((state) => state.selectedDavId);
  const setSelectedDavId = useDeploymentStore((state) => state.setSelectedDavId);
  
  const effectiveGov = governanceAddress || '';

  const networkLabel = useMemo(() => {
    const cfg = getRuntimeConfigSync();
    return cfg?.network?.name || (chainId ? `Chain ${chainId}` : 'Unknown Network');
  }, [chainId, selectedDavId]);

  const symbolPrefix = useMemo(() => {
    const cfg = getRuntimeConfigSync();
    return cfg?.network?.symbolPrefix || 'p';
  }, [chainId, selectedDavId]);

  const networkDisplayName = useMemo(() => {
    const n = String(networkLabel || '').toLowerCase();
    if (n.includes('pulse')) return 'Pulsechain';
    if (n.includes('sonic')) return 'Sonic';
    if (n.includes('polygon')) return 'Polygon';
    if (n.includes('ethereum')) return 'Ethereum';
    return chainId ? `Chain ${chainId}` : 'Unknown';
  }, [networkLabel, chainId]);

  const networkLogo = useMemo(() => {
    if (chainId === 369) return pulseLogo;
    if (chainId === 146) return sonicLogo;
    if (chainId === 137) return polygonLogo;
    return null;
  }, [chainId]);

  if (loading) {
    return (
      <div className="container py-4 admin-container">
        <div className="card text-center admin-loading-card">
          <div className="card-body py-5">
            <div className="spinner-border admin-spinner" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 mb-0 text-muted">Verifying governance access...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isGovernance) {
    return (
      <div className="container py-4 admin-container">
        <div className="card admin-access-card">
          <div className="card-body">
            <div className="admin-access-header">
              <div className="admin-lock-icon">🔒</div>
              <h4 className="mb-2 admin-access-title">GOVERNANCE ACCESS REQUIRED</h4>
              <p className="text-muted mb-4">Connect the governance wallet to access protocol administration</p>
            </div>
            
            <div className="admin-wallet-comparison">
              <div className="wallet-info-box disconnected">
                <div className="wallet-label">
                  <i className="bi bi-circle-fill status-dot"></i>
                  Connected Wallet
                </div>
                <div className="wallet-address">
                  {address ? (
                    <>
                      <span className="address-text">{address.slice(0, 6)}...{address.slice(-4)}</span>
                      <code className="address-full d-none d-md-inline ms-2">{address}</code>
                    </>
                  ) : (
                    <span className="text-warning">Not connected</span>
                  )}
                </div>
              </div>

              <div className="wallet-divider">
                <i className="bi bi-arrow-down"></i>
              </div>

              <div className="wallet-info-box required">
                <div className="wallet-label">
                  <i className="bi bi-shield-check-fill status-dot"></i>
                  Required Governance
                </div>
                <div className="wallet-address">
                  {effectiveGov ? (
                    <>
                      <span className="address-text">{effectiveGov.slice(0, 6)}...{effectiveGov.slice(-4)}</span>
                      <code className="address-full d-none d-md-inline ms-2">{effectiveGov}</code>
                    </>
                  ) : (
                    <span className="text-muted">Loading...</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Admin Hero Section - Matches Main Project Header Style */}
      <nav className="navbar navbar-expand-lg bg-dark py-2">
        <div className="container d-flex justify-content-between align-items-center w-100">
          {/* Left: Logo and Title */}
          <div className="navbar-brand text-light pb-0 mb-0 me-0 d-flex align-items-center gap-2" style={{ marginLeft: '0px' }}>
            {networkLogo ? (
              <img
                src={networkLogo}
                alt={`${networkDisplayName} logo`}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)' }}>
                <i className="bi bi-globe2"></i>
              </span>
            )}
            <select
              className="form-select form-select-sm"
              style={{ width: 118, height: 28, paddingTop: 0, paddingBottom: 0 }}
              value={selectedDavId}
              onChange={(e) => setSelectedDavId(e.target.value)}
              aria-label="Select DAV deployment"
              title="Select DAV"
            >
              <option value="DAV1">{`${symbolPrefix}DAV1`}</option>
              <option value="DAV2">{`${symbolPrefix}DAV2`}</option>
              <option value="DAV3">{`${symbolPrefix}DAV3`}</option>
            </select>
          </div>

          {/* Right: Admin Navigation */}
          <div className="d-flex align-items-center">
            <ul className="navbar-nav d-flex flex-row align-items-center me-4">
              <li className="nav-item mx-2">
                <NavLink 
                  to="/admin/overview" 
                  className={({isActive}) => isActive ? "nav-link active-link text-light" : "nav-link text-light"}
                >
                  Overview
                </NavLink>
              </li>
              <li className="nav-item mx-2">
                <NavLink 
                  to="/admin/token-management" 
                  className={({isActive}) => isActive ? "nav-link active-link text-light" : "nav-link text-light"}
                >
                  Token Management
                </NavLink>
              </li>
              <li className="nav-item mx-2">
                <NavLink 
                  to="/admin/buyburn-setup" 
                  className={({isActive}) => isActive ? "nav-link active-link text-light" : "nav-link text-light"}
                >
                  Buy & Burn
                </NavLink>
              </li>
              <li className="nav-item mx-2">
                <NavLink 
                  to="/admin/auction-control" 
                  className={({isActive}) => isActive ? "nav-link active-link text-light" : "nav-link text-light"}
                >
                  Auction Control
                </NavLink>
              </li>
              <li className="nav-item mx-2">
                <NavLink 
                  to="/admin/governance" 
                  className={({isActive}) => isActive ? "nav-link active-link text-light" : "nav-link text-light"}
                >
                  Settings
                </NavLink>
              </li>
            </ul>
            
            {/* Governance Badge */}
            <div className="governance-badge-compact">
              <i className="bi bi-shield-check-fill me-2"></i>
              <span className="governance-address-compact" title={effectiveGov}>
                {effectiveGov ? `${effectiveGov.slice(0,6)}...${effectiveGov.slice(-4)}` : '—'}
              </span>
            </div>

          </div>
        </div>
      </nav>

      {/* Main Content Area - Full Width */}
      <div className="container py-4">
        <Suspense fallback={
          <div className="card admin-loading-card">
            <div className="card-body text-center py-5">
              <div className="spinner-border admin-spinner" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 mb-0 text-muted">Loading module...</p>
            </div>
          </div>
        }>
          <Routes>
            <Route index element={<Navigate to="overview" />} />
            <Route path="overview" element={<SystemInitializationPage />} />
            <Route path="system-initialization" element={<SystemInitializationPage />} />
            <Route path="buyburn-setup" element={<BuyBurnSetupPage />} />
            <Route path="token-management" element={<TokenManagementPage />} />
            <Route path="auction-control" element={<AuctionControlPage />} />
            <Route path="governance" element={<GovernancePage />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
