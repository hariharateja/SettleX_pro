// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract SettleX {
    using SafeERC20 for IERC20;

    enum State { NONE, COMMITTED, REVEALED, VALIDATED, SETTLED, FINALIZED, CANCELLED, DISPUTED }

    struct Settlement {
        address initiator;
        bytes32 commitHash;
        bytes revealed;
        State state;
        uint256 commitBlock;
        uint256 revealBlock;
        uint256 validatedBlock;
        uint256 settledBlock;
        uint256 bond;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Settlement) public settlements;

    // --- TWO ORACLES FOR CONFLICT CHECK ---
    AggregatorV3Interface public primaryOracle;
    AggregatorV3Interface public secondaryOracle;

    uint256 public REVEAL_WINDOW = 15;
    uint256 public VALIDATION_DELAY = 1; 
    uint256 public STALE_THRESHOLD = 3600;
    
    // Safety thresholds
    uint256 public ORACLE_DIFF_TOLERANCE = 5; // 5% diff = Dispute
    uint256 public MAX_DEVIATION_PCT = 30;    // 30% spike = Dispute

    int256 public lastSafePrice;

    event Committed(uint256 indexed id, address indexed who, bytes32 commitHash, uint256 bond);
    event Revealed(uint256 indexed id, address indexed who);
    event Validated(uint256 indexed id, int256 price);
    event Disputed(uint256 indexed id, string reason);
    event Settled(uint256 indexed id);
    
    // CONSTRUCTOR ACCEPTS TWO ORACLES
    constructor(address _primary, address _secondary) {
        primaryOracle = AggregatorV3Interface(_primary);
        secondaryOracle = AggregatorV3Interface(_secondary);
        
        // Init baseline
        try primaryOracle.latestRoundData() returns (uint80, int256 p, uint256, uint256, uint80) {
            lastSafePrice = p;
        } catch {}
    }

    function commit(bytes32 _commitHash) external payable returns (uint256) {
        require(msg.value >= 0.001 ether, "Bond too small");
        uint256 id = nextId++;
        settlements[id] = Settlement({
            initiator: msg.sender,
            commitHash: _commitHash,
            revealed: "",
            state: State.COMMITTED,
            commitBlock: block.number,
            revealBlock: 0,
            validatedBlock: 0,
            settledBlock: 0,
            bond: msg.value
        });
        emit Committed(id, msg.sender, _commitHash, msg.value);
        return id;
    }

    function reveal(uint256 id, bytes calldata preimage) external {
        Settlement storage s = settlements[id];
        require(s.state == State.COMMITTED, "Not committed");
        require(keccak256(preimage) == s.commitHash, "Hash mismatch");
        s.revealed = preimage;
        s.state = State.REVEALED;
        s.revealBlock = block.number;
        emit Revealed(id, msg.sender);
    }

    // --- THE ADVERSARIAL VALIDATION ---
    function validate(uint256 id) public {
        Settlement storage s = settlements[id];
        require(s.state == State.REVEALED, "Not revealed");

        // 1. GET DATA FROM BOTH
        ( , int256 p1, , uint256 t1, ) = primaryOracle.latestRoundData();
        ( , int256 p2, , uint256 t2, ) = secondaryOracle.latestRoundData();

        // 2. CHECK CONFLICT (The Test You Want)
        // If p1 is 2500 and p2 is 2000, difference is 500. 
        // 500 / 2500 = 20% difference. > 5% Tolerance. -> DISPUTE.
        uint256 diff = p1 > p2 ? uint256(p1 - p2) : uint256(p2 - p1);
        uint256 diffPct = (diff * 100) / uint256(p1);

        if (diffPct > ORACLE_DIFF_TOLERANCE) {
            _autoDispute(id, "Adversarial: Oracles Conflict");
            return;
        }

        // 3. CHECK FLASH CRASH (Spike Test)
        // Checks against history
        if (lastSafePrice > 0) {
            uint256 volDiff = p1 > lastSafePrice ? uint256(p1 - lastSafePrice) : uint256(lastSafePrice - p1);
            uint256 volPct = (volDiff * 100) / uint256(lastSafePrice);
            
            if (volPct > MAX_DEVIATION_PCT) {
                _autoDispute(id, "Adversarial: Price Deviation > 30%");
                return;
            }
        }

        s.state = State.VALIDATED;
        s.validatedBlock = block.number;
        lastSafePrice = p1; // Update history
        emit Validated(id, p1);
    }

    function settle(uint256 id) public {
        Settlement storage s = settlements[id];
        require(s.state == State.VALIDATED, "Not validated");
        
        // One-Way Transfer for Safety Shield Demo
        (address token, address to, uint256 amount) = abi.decode(s.revealed, (address, address, uint256));
        IERC20(token).safeTransferFrom(s.initiator, to, amount);
        
        s.state = State.SETTLED;
        emit Settled(id);
    }

    function _autoDispute(uint256 id, string memory reason) internal {
        Settlement storage s = settlements[id];
        uint256 refund = s.bond;
        s.bond = 0;
        s.state = State.DISPUTED;
        
        // Refund Initiator
        if(refund > 0) payable(s.initiator).transfer(refund);
        emit Disputed(id, reason);
    }
}