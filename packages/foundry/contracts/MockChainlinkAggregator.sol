// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal mock implementing Chainlink AggregatorV3Interface for tests
contract MockChainlinkAggregator {
    int256 private _answer;
    uint256 private _updatedAt;

    constructor(int256 initialAnswer) {
        _answer = initialAnswer;
        _updatedAt = block.timestamp;
    }

    function setLatestAnswer(int256 newAnswer) external {
        _answer = newAnswer;
        _updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, _answer, 0, _updatedAt, 0);
    }
    
}