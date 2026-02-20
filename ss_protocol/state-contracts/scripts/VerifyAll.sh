#!/bin/bash

# Verification script for all deployed contracts on PulseChain
# Run after deployment to verify on Sourcify

# Contract addresses (update these after deployment)
SWAP_V3="0x0246Ee42982B0ee671Ec0C007dE366c1c8F4Cf30"
STATE_V3="0xD46DB85d2fBe4e99f88Ca44c84B04F96D0F8e247"
AUCTION_ADMIN="0x4E2b1e68E7aEE55ec14c6e9be9438CA8f561a6c8"
BUYANDBURN_V2="0x864507B2994353F10a11AAe50bba82f154293f26"
DAV_V3="0x29637505477e9B688628eA1F6269b6971f5869d5"
AIRDROP_DISTRIBUTOR="0xb797Af3b96f3DF9A8c58d15246370cbbb0f1844d"
SWAP_LENS="0x01408f83FF10bBA51807418be80E6EA70a91AA4d"

# Constructor arguments
GOV_ADDRESS="0x0f7F24c7F22e2Ca7052f051A295e1a5D3369cAcE"

echo "=== VERIFYING CONTRACTS ON SOURCIFY ==="
echo ""

# Verify SWAP_V3
if [ ! -z "$SWAP_V3" ]; then
    echo "Verifying SWAP_V3 at $SWAP_V3..."
    forge verify-contract \
        --chain-id 369 \
        --verifier sourcify \
        --constructor-args $(cast abi-encode "constructor(address)" "$GOV_ADDRESS") \
        $SWAP_V3 \
        src/AuctionSwap.sol:SWAP_V3
    echo ""
fi

# Verify STATE_V3
if [ ! -z "$STATE_V3" ]; then
    echo "Verifying STATE_V3 at $STATE_V3..."
    forge verify-contract \
        --chain-id 369 \
        --verifier sourcify \
        --constructor-args $(cast abi-encode "constructor(string,string,address)" "PulseSTATE2" "pSTATE2" "$SWAP_V3") \
        $STATE_V3 \
        src/StateToken.sol:STATE_V3
    echo ""
fi

# Verify AuctionAdmin
if [ ! -z "$AUCTION_ADMIN" ]; then
    echo "Verifying AuctionAdmin at $AUCTION_ADMIN..."
    forge verify-contract \
        --chain-id 369 \
        --verifier sourcify \
        --constructor-args $(cast abi-encode "constructor(address,address)" "$SWAP_V3" "$GOV_ADDRESS") \
        $AUCTION_ADMIN \
        src/AuctionAdmin.sol:AuctionAdmin
    echo ""
fi

# Verify BuyAndBurnController_V2
if [ ! -z "$BUYANDBURN_V2" ]; then
    WPLS="0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
    PULSEX_ROUTER="0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02"
    PULSEX_FACTORY="0x1715a3E4A142d8b698131108995174F37aEBA10D"
    
    echo "Verifying BuyAndBurnController_V2 at $BUYANDBURN_V2..."
    forge verify-contract \
        --chain-id 369 \
        --verifier sourcify \
        --constructor-args $(cast abi-encode "constructor(address,address,address,address,address,address,address)" "$STATE_V3" "$WPLS" "$PULSEX_ROUTER" "$PULSEX_FACTORY" "$SWAP_V3" "$AUCTION_ADMIN" "$GOV_ADDRESS") \
        $BUYANDBURN_V2 \
        src/BuyAndBurnController_V2.sol:BuyAndBurnController_V2
    echo ""
fi

# Verify DAV_V3
if [ ! -z "$DAV_V3" ]; then
    PULSEX_ROUTER_V2="0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02"
    WPLS="0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
    
    echo "Verifying DAV_V3 at $DAV_V3..."
    forge verify-contract \
        --chain-id 369 \
        --verifier sourcify \
        --constructor-args $(cast abi-encode "constructor(address,address,address,address,address,address,address,string,string)" "$STATE_V3" "$GOV_ADDRESS" "$AUCTION_ADMIN" "$BUYANDBURN_V2" "$SWAP_V3" "$PULSEX_ROUTER_V2" "$WPLS" "PulseDAV2" "pDAV2") \
        $DAV_V3 \
        src/DavToken.sol:DAV_V3
    echo ""
fi

# Verify AirdropDistributor
if [ ! -z "$AIRDROP_DISTRIBUTOR" ]; then
    echo "Verifying AirdropDistributor at $AIRDROP_DISTRIBUTOR..."
    forge verify-contract \
        --chain-id 369 \
        --verifier sourcify \
        --constructor-args $(cast abi-encode "constructor(address,address,address)" "$SWAP_V3" "$DAV_V3" "$STATE_V3") \
        $AIRDROP_DISTRIBUTOR \
        src/AirdropDistributor.sol:AirdropDistributor
    echo ""
fi

# Verify SwapLens
if [ ! -z "$SWAP_LENS" ]; then
    echo "Verifying SwapLens at $SWAP_LENS..."
    forge verify-contract \
        --chain-id 369 \
        --verifier sourcify \
        $SWAP_LENS \
        src/SwapLens.sol:SwapLens
    echo ""
fi

echo "=== VERIFICATION COMPLETE ==="
echo ""
echo "Check verification status at:"
echo "https://repo.sourcify.dev/contracts/full_match/369/"
