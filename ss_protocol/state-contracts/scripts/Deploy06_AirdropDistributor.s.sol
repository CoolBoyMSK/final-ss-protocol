// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {AirdropDistributor} from "../src/AirdropDistributor.sol";
import {SWAP_V3} from "../src/AuctionSwap.sol";
import {DAV_V3} from "../src/DavToken.sol";

contract Deploy06_AirdropDistributor is Script {
    // Update these addresses after previous deployments
    address constant SWAP_V3_ADDRESS = 0xFEF68179BE7150eAd7a766331d0087Ee26f06098; // SWAP_V3 from Deploy01
    address constant DAV_V3_ADDRESS = 0x354BfD4318bfA8FA53f738376E3Bac62B94De677; // DAV_V3 from Deploy05
    address constant STATE_V3_ADDRESS = 0x322cEA42A77C2f18B8e79Cc46efBacf73b6a8E6B; // STATE_V3 from Deploy02

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