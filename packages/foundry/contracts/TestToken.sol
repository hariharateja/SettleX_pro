// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    address public admin;

    constructor() ERC20("SettleX Test Token", "SXT") {
        admin = msg.sender;
        _mint(msg.sender, 1_000_000 * 10**18); // give deployer 1M tokens
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == admin, "not admin");
        _mint(to, amount);
    }
}