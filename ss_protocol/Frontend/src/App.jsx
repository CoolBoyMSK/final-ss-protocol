import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import "./Styles/styles.css";
import { useEffect, useState } from "react";
import Header from "./components/Header";
import InfoCards from "./components/InfoCards";
import DataTable from "./components/DataTable";
import DetailsInfo from "./components/DetailsInfo";
import InfoPage from "./components/Info/InfoPage";
import AuctionBoxes from "./components/Auction/AuctionBoxes";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Footer from "./components/Footer";
import DavHistory from "./components/DavHistory";
import SwapComponent from "./components/Swap/SwapModel";
import AdminLayout from "./components/admin/AdminLayout";
import DavVaultPage from "./pages/DavVaultPage";
import { useGovernanceGate } from "./components/admin/useGovernanceGate";
import { startMemoryMonitor, performMemoryCleanup } from "./utils/memoryCleanup";

const App = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { isGovernance, loading: govLoading } = useGovernanceGate();

  // Memory monitoring and cleanup
  useEffect(() => {
    // Start memory monitor (warns at 500MB)
    const stopMonitor = startMemoryMonitor(500);
    
    // Cleanup on visibility change (when tab goes to background)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        performMemoryCleanup();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (stopMonitor) stopMonitor();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <Router>
      <div className="d-flex flex-column min-vh-100">
        <Header />
        <Toaster position="bottom-left" reverseOrder={false} />
        <div>
          {!isOnline && (
            <div
              className="alert alert-danger text-center w-100 position-fixed top-0 start-0"
              style={{ zIndex: 1050, padding: "15px", fontSize: "18px" }}
              role="alert"
            >
              ⚠️ You are offline. Some features may not work properly.
            </div>
          )}
          {/* Main content area */}
          <main className="flex-grow-1">
            <Routes>
              <Route path="/" element={<Navigate to="/davpage" />} />
              {/* DEX page removed from header; route kept temporarily for backward compatibility */}
              {/* <Route path="/Swap" element={<><SwapComponent /></>} /> */}
              {/* Dav Mint page (InfoCards only) */}
              <Route
                path="/davpage"
                element={
                  <>
                    <InfoCards />
                  </>
                }
              />
              {/* /auction is now the canonical Dav Vault page */}
              <Route path="/auction" element={<DavVaultPage />} />
              {/* /live-auction hidden: keep redirect for backward compatibility */}
              <Route path="/live-auction" element={<Navigate to="/auction" replace />} />
              <Route
                path="/Deflation"
                element={<Navigate to="/auction" replace />}
              />
              {/* Legacy AddToken routes redirected to Admin Tokens */}
              <Route path="/ADDToken" element={<Navigate to="/admin/tokens" replace />} />
              <Route path="/AddToken" element={<Navigate to="/admin/tokens" replace />} />
              {/* /info (legacy list page) hidden: redirect to DAV History */}
              <Route path="/info" element={<Navigate to="/dav-history" replace />} />
              {/* Backward compatibility: old Dav Vault URL */}
              <Route path="/dav-vault" element={<Navigate to="/auction" replace />} />
              <Route
                path="/dav-history"
                element={
                  <>
                    <DavHistory />
                  </>
                }
              />
              <Route
                path="/admin/*"
                element={
                  // Route guard: only governance can access admin routes
                  govLoading ? (
                    <div className="container mt-4 text-center">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : isGovernance ? (
                    <AdminLayout />
                  ) : (
                    <Navigate to="/davpage" replace />
                  )
                }
              />
            </Routes>
          </main>
        </div>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
