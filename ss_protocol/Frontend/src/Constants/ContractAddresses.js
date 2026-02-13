import { getRuntimeSelection, resolveDeployment } from "./RuntimeConfig";
// Chain IDs
export const CHAIN_IDS = {
    PULSECHAIN: 369,
    POLYGON: 137,
    SONIC: 146,
    MAINNET: 1,
    PULSECHAIN_TESTNET: 943,
};

const readAddr = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value.address || "";
    return "";
};

const mapConfigToAddressSet = (cfg) => ({
    DAV_TOKEN: readAddr(cfg?.contracts?.core?.DAV_V3),
    STATE_TOKEN: readAddr(cfg?.contracts?.core?.STATE_V3),
    AUCTION: readAddr(cfg?.contracts?.core?.SWAP_V3),
    BUY_BURN_CONTROLLER: readAddr(cfg?.contracts?.support?.BuyAndBurnController),
    SWAP_LENS: readAddr(cfg?.contracts?.support?.SwapLens),
    AIRDROP_DISTRIBUTOR: readAddr(cfg?.contracts?.stages?.AirdropDistributor),
    AUCTION_ADMIN: readAddr(cfg?.contracts?.stages?.AuctionAdmin),
});

// Kept for backward compatibility. Use getContractAddresses() for active values.
export const CONTRACT_ADDRESSES = {};

// Helper function to get contract addresses for a specific chain
export const getContractAddresses = (chainId, davId) => {
    const activeSelection = getRuntimeSelection();
    const preferredChainId = chainId ?? activeSelection.chainId;
    const preferredDavId = davId ?? activeSelection.davId;

    const resolved = resolveDeployment(preferredChainId, preferredDavId);
    const mapped = mapConfigToAddressSet(resolved);
    return mapped;
};

// Helper function to get a specific contract address
export const getContractAddress = (chainId, contractType) => {
    const addresses = getContractAddresses(chainId);
    return addresses[contractType];
};

// Simple functions to get contract addresses for connected chain
export const getDAVContractAddress = (chainId) => {
    return getContractAddress(chainId, 'DAV_TOKEN');
};

export const getSTATEContractAddress = (chainId) => {
    return getContractAddress(chainId, 'STATE_TOKEN');
};

export const getAUCTIONContractAddress = (chainId) => {
    return getContractAddress(chainId, 'AUCTION');
};
export const getSTATEPAIRAddress = (chainId) => {
    return getContractAddress(chainId, 'STATE_PAIR_ADDRESS');
};
export const explorerUrls = {
    1: "https://etherscan.io/address/",
    137: "https://polygonscan.com/address/",
    146: "https://sonicscan.org/address/",
    10: "https://optimistic.etherscan.io/address/",
    369: "https://scan.pulsechain.com/address/",
};

// Get all contract addresses for a chain
export const getContractAddressesForChain = (chainId) => {
    return {
        DAV_TOKEN: getDAVContractAddress(chainId),
        STATE_TOKEN: getSTATEContractAddress(chainId),
        AUCTION: getAUCTIONContractAddress(chainId),
        SWAP_LENS: getContractAddress(chainId, 'SWAP_LENS'),
        BUY_BURN_CONTROLLER: getContractAddress(chainId, 'BUY_BURN_CONTROLLER'),
        AIRDROP_DISTRIBUTOR: getContractAddress(chainId, 'AIRDROP_DISTRIBUTOR'),
        AUCTION_ADMIN: getContractAddress(chainId, 'AUCTION_ADMIN'),
    };
};