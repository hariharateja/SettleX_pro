// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MockOracle.sol";
import "../contracts/SettleX.sol";

contract DeployAdversarial is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Initial Price $2000
        int256 initialPrice = 2000 * 10**8;

        // 2. Deploy TWO separate Oracles
        MockOracle oracle1 = new MockOracle(initialPrice);
        MockOracle oracle2 = new MockOracle(initialPrice);
        
        // 3. Deploy SettleX with BOTH Oracles
        SettleX settleX = new SettleX(address(oracle1), address(oracle2));

        vm.stopBroadcast();

        console.log("-----------------------------------------");
        console.log(" Oracle 1 Address:", address(oracle1));
        console.log(" Oracle 2 Address:", address(oracle2));
        console.log(" SettleX Address: ", address(settleX));
        console.log("-----------------------------------------");
    }
}