// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract ChaosOracle is AggregatorV3Interface {
    int256 public price;
    uint8 public decimalsVal;
    uint256 public updatedAt;
    
    // Config
    string public description = "Chaos Oracle";
    uint256 public version = 1;

    constructor(int256 _initialPrice, uint8 _decimals) {
        price = _initialPrice;
        decimalsVal = _decimals;
        updatedAt = block.timestamp;
    }

    // --- NORMAL UPDATE (Honest Behavior) ---
    function updatePrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }

    // --- CHAOS MODE (Adversarial Behavior) ---
    // This simulates the "Random Fluctuations" and "Bad Data"
    function triggerChaos() external {
        // Pseudo-randomness based on block hash
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao)));
        
        uint256 scenario = random % 3; 

        if (scenario == 0) {
            // SCENARIO 1: Flash Crash (Price drops 30-50%)
            // e.g. Price becomes 70% of current
            price = (price * 70) / 100; 
            updatedAt = block.timestamp; // Fresh but WRONG
        } 
        else if (scenario == 1) {
            // SCENARIO 2: Moon Spike (Price pumps 30-50%)
            price = (price * 130) / 100;
            updatedAt = block.timestamp; // Fresh but WRONG
        } 
        else {
            // SCENARIO 3: Stale Data (Time travel back 10 hours)
            // Price stays same, but time is old
            updatedAt = block.timestamp - 10 hours;
        }
    }

    // Standard Chainlink Interface
    function decimals() external view returns (uint8) { return decimalsVal; }
    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (0, price, 0, updatedAt, 0);
    }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (0, price, 0, updatedAt, 0);
    }
}