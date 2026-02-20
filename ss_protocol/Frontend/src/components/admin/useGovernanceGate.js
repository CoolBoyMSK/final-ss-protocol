import { useAccount, useChainId } from "wagmi";
import { useContext, useEffect, useMemo, useState } from "react";
import { ContractContext } from "../../Functions/ContractInitialize";

// Simple governance gate using Auction contract's governanceAddress() view
export function useGovernanceGate() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { AllContracts, provider, loading: contractsLoading } = useContext(ContractContext);
  const [gov, setGov] = useState(null);
  const [loading, setLoading] = useState(false);
  // Frontend allowlist for admin page visibility.
  // Owner/Gov wallet address (primary): full UI access + on-chain governance permissions.
  // Developer wallet address (secondary): UI access only for admin pages; on-chain governance transactions still fail unless caller is actual governance/owner in the smart contracts.
  const ADMIN_ALLOWLIST = useMemo(() => [
    '0x0f7f24c7f22e2ca7052f051a295e1a5d3369cace',
    '0x9fa004e13e780ef5b50ca225ad5dcd4d0fe9ed70',
  ], []);
  const envGov = (import.meta?.env?.VITE_GOVERNANCE_ADDRESS || '').toLowerCase?.() || '';
  const queryGov = (() => {
    try {
      if (typeof window === 'undefined') return '';
      const v = new URLSearchParams(window.location.search).get('gov') || '';
      return v.toLowerCase();
    } catch { return ''; }
  })();
  const lsGov = (() => {
    try {
      if (typeof window === 'undefined') return '';
      const v = localStorage.getItem('GOVERNANCE_OVERRIDE') || '';
      return v.toLowerCase();
    } catch { return ''; }
  })();

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!mounted) return;
      // Override precedence: query > localStorage > env > on-chain
      if (queryGov) {
        setGov(queryGov);
        setLoading(false);
        return;
      }
      if (lsGov) {
        setGov(lsGov);
        setLoading(false);
        return;
      }
      if (envGov) {
        setGov(envGov);
        setLoading(false);
        return;
      }
      if (contractsLoading) {
        setLoading(true);
        return;
      }
      if (!AllContracts?.AuctionContract) {
        setGov(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
  const g = await (provider ? AllContracts.AuctionContract.connect(provider) : AllContracts.AuctionContract).governanceAddress();
        if (mounted) setGov(g?.toLowerCase?.() || null);
      } catch (e) {
        console.error("governanceAddress() read failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [AllContracts, chainId, envGov, lsGov, queryGov, provider, contractsLoading]);

  const isGovernance = useMemo(() => {
    if (!address) return false;
    const me = address.toLowerCase();
    if (ADMIN_ALLOWLIST.includes(me)) return true;
    if (!gov) return false;
    return me === gov;
  }, [address, gov, ADMIN_ALLOWLIST]);

  return { isGovernance, governanceAddress: gov, loading };
}
