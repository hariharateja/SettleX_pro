// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockOracle is AggregatorV3Interface {
    int256 public price;
    uint256 public updated;

    constructor(int256 _initialPrice) {
        price = _initialPrice;
        updated = block.timestamp;
    }

    // SIMULATE ATTACK: Call this to crash/spike the price
    function setPrice(int256 _price) external {
        price = _price;
        updated = block.timestamp;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (0, price, 0, updated, 0);
    }
    
    // ... (other interface functions can be empty) ...
    function decimals() external view returns (uint8) { return 8; }
    function description() external view returns (string memory) { return "Mock"; }
    function version() external view returns (uint256) { return 1; }
    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (0, price, 0, updated, 0);
    }
}