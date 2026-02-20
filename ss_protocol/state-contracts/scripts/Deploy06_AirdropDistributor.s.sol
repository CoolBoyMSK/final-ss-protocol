// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {AirdropDistributor} from "../src/AirdropDistributor.sol";
import {SWAP_V3} from "../src/AuctionSwap.sol";
import {DAV_V3} from "../src/DavToken.sol";

contract Deploy06_AirdropDistributor is Script {
    // Update these addresses after previous deployments
    address constant SWAP_V3_ADDRESS = 0x0246Ee42982B0ee671Ec0C007dE366c1c8F4Cf30; // SWAP_V3 from Deploy01
    address constant DAV_V3_ADDRESS = 0x29637505477e9B688628eA1F6269b6971f5869d5; // DAV_V3 from Deploy05
    address constant STATE_V3_ADDRESS = 0xD46DB85d2fBe4e99f88Ca44c84B04F96D0F8e247; // STATE_V3 from Deploy02

    function run() external {
        require(SWAP_V3_ADDRESS != address(0), "Must update SWAP_V3_ADDRESS first");
        require(DAV_V3_ADDRESS != address(0), "Must update DAV_V3_ADDRESS first");
        require(STATE_V3_ADDRESS != address(0), "Must update STATE_V3_ADDRESS first");
        
        console.log("=== DEPLOYING AIRDROP DISTRIBUTOR CONTRACT ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);
        console.log("Balance:", msg.sender.balance / 1e18, "PLS");
        console.log("SWAP_V3 Address:", SWAP_V3_ADDRESS);
        console.log("DAV_V3 Address:", DAV_V3_ADDRESS);
        console.log("STATE_V3 Address:", STATE_V3_ADDRESS);
        console.log("");

        vm.startBroadcast();
        
        console.log("Deploying AirdropDistributor...");
        AirdropDistributor airdropDistributor = new AirdropDistributor(
            SWAP_V3(payable(SWAP_V3_ADDRESS)),     // _swap
            DAV_V3(payable(DAV_V3_ADDRESS)),       // _dav
            STATE_V3_ADDRESS                       // _stateToken
        );
        
        console.log("SUCCESS: AirdropDistributor deployed at:", address(airdropDistributor));
        console.log("NOTE: Ownership renounced in constructor - contract is fully autonomous");
        console.log("");
        vm.stopBroadcast();
        
        console.log("=== DEPLOYMENT COMPLETED ===");
        console.log("AirdropDistributor Address:", address(airdropDistributor));
        console.log("");
        console.log("Configuration:");
        console.log("- SWAP Contract:", SWAP_V3_ADDRESS);
        console.log("- DAV Token:", DAV_V3_ADDRESS);
        console.log("- STATE Token:", STATE_V3_ADDRESS);
        console.log("- Fully Autonomous: No governance control");
        console.log("");
        console.log("NEXT STEP: Deploy SwapLens:");
        console.log("forge script scripts/Deploy07_SwapLens.s.sol:Deploy07_SwapLens");
        console.log("  --rpc-url https://rpc.pulsechain.com");
        console.log("  --private-key $PRIVATE_KEY");
        console.log("  --broadcast");
        console.log("  --legacy");
    }
}