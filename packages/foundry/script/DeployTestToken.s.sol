// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/TestToken.sol";

contract DeployTestToken is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(privateKey);

        TestToken token = new TestToken();
        console.log("TestToken deployed at:", address(token));

        vm.stopBroadcast();
    }
}