// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SettleX.sol";
import "../contracts/MockERC20.sol";
import "../contracts/MockChainlinkAggregator.sol";

contract SettleXTest is Test {
    SettleX public settle;
    MockChainlinkAggregator public mockFeed;
    MockERC20 public token;

    address alice = address(0xA1);
    address bob = address(0xB0);
    address attacker = address(0xC0);

    function setUp() public {
        // Mock feed returns price (example: 1000 wei = $1000)
        mockFeed = new MockChainlinkAggregator(1000);
        settle = new SettleX(address(mockFeed));
        token = new MockERC20();

        // Fund users
        token.mint(alice, 1e21);
        vm.deal(alice, 10 ether);
        vm.deal(attacker, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // convenience for encoding reveal data
    function _encode(address tokenAddr, address to, uint256 amount)
        internal pure returns (bytes memory)
    {
        return abi.encode(tokenAddr, to, amount);
    }

    // ------------------------------
    // 1. Happy path test
    // ------------------------------
    function testHappyPath_commitRevealValidateSettleFinalize() public {
        bytes memory revealed = _encode(address(token), bob, 100 ether);
        bytes32 h = keccak256(revealed);

        vm.prank(alice);
        uint256 id = settle.commit{value: 0.01 ether}(h);

        vm.roll(block.number + 1);

        vm.prank(alice);
        settle.reveal(id, revealed);

        mockFeed.setLatestAnswer(1200);

        vm.roll(block.number + settle.VALIDATION_DELAY());
        settle.validate(id);

        vm.prank(alice);
        token.approve(address(settle), 100 ether);

        settle.settle(id);

        assertEq(token.balanceOf(bob), 100 ether);
        assertEq(token.balanceOf(alice), 1e21 - 100 ether);

        vm.roll(block.number + settle.FINALIZATION_DELAY());
        settle.finalize(id);

        SettleX.Settlement memory st = settle.getSettlement(id);
        assertEq(uint(st.state), uint(SettleX.State.FINALIZED));
    }

    // ------------------------------
    // 2. Wrong preimage test
    // ------------------------------
    function testRevealWrongPreimageReverts() public {
        bytes memory correct = _encode(address(token), bob, 99 ether);
        bytes32 h = keccak256(correct);

        vm.prank(alice);
        uint256 id = settle.commit{value: 0.01 ether}(h);

        bytes memory wrong = _encode(address(token), bob, 100 ether);

        vm.prank(alice);
        vm.expectRevert("hash mismatch");
        settle.reveal(id, wrong);
    }

    // ------------------------------
    // 3. Timeout → cancel
    // ------------------------------
    function testRevealTimeoutAllowsCancel() public {
        bytes memory encoded = _encode(address(token), bob, 10 ether);
        bytes32 h = keccak256(encoded);

        vm.prank(alice);
        uint256 id = settle.commit{value: 0.01 ether}(h);

        vm.roll(block.number + settle.REVEAL_WINDOW() + 1);

        vm.prank(alice);
        settle.cancelIfRevealMissed(id);

        SettleX.Settlement memory st = settle.getSettlement(id);
        assertEq(uint(st.state), uint(SettleX.State.CANCELLED));
    }

    // ------------------------------
    // 4. Dispute → bond slashing
    // ------------------------------
    function testDisputeSlashesBond() public {
        bytes memory revealed = _encode(address(token), bob, 50 ether);
        bytes32 h = keccak256(revealed);

        vm.prank(alice);
        uint256 id = settle.commit{value: 0.05 ether}(h);

        vm.roll(block.number + 1);
        vm.prank(alice);
        settle.reveal(id, revealed);

        mockFeed.setLatestAnswer(1000);

        vm.roll(block.number + settle.VALIDATION_DELAY());
        settle.validate(id);

        uint256 balBefore = attacker.balance;
        vm.prank(attacker);
        settle.dispute(id, "fraud");

        SettleX.Settlement memory st = settle.getSettlement(id);
        assertEq(uint(st.state), uint(SettleX.State.DISPUTED));
        assertEq(attacker.balance, balBefore + 0.05 ether);
    }

    // ------------------------------
    // 5. Double-settle prevention
    // ------------------------------
    function testDoubleSettleReverts() public {
        bytes memory revealed = _encode(address(token), bob, 5 ether);
        bytes32 h = keccak256(revealed);

        vm.prank(alice);
        uint256 id = settle.commit{value: 0.01 ether}(h);

        vm.roll(block.number + 1);
        vm.prank(alice);
        settle.reveal(id, revealed);

        mockFeed.setLatestAnswer(1000);
        vm.roll(block.number + settle.VALIDATION_DELAY());
        settle.validate(id);

        vm.prank(alice);
        token.approve(address(settle), 5 ether);

        settle.settle(id);

        // second call must revert
        vm.expectRevert();
        settle.settle(id);
    }
}