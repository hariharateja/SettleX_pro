import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ==========================================
// 1. CONFIGURATION
// ==========================================
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
// This is your deployed SettleX address
const CONTRACT_ADDRESS = "0xe9725764aC1175703B488c8278FbcABaFE66D116"; 

// ==========================================
// 2. HARDCODED ABI (Prevents File/JSON Errors)
// ==========================================
const ABI = [
  // Views
  "function nextId() view returns (uint256)",
  "function getSettlement(uint256 id) view returns (tuple(address initiator, bytes32 commitHash, bytes revealed, uint8 state, uint256 commitBlock, uint256 revealBlock, uint256 validatedBlock, uint256 settledBlock, uint256 bond))",
  "function REVEAL_WINDOW() view returns (uint256)",
  "function VALIDATION_DELAY() view returns (uint256)",
  "function VALIDATION_WINDOW() view returns (uint256)",
  "function FINALIZATION_DELAY() view returns (uint256)",
  // Actions
  "function validate(uint256 id) external",
  "function settle(uint256 id) external",
  "function finalize(uint256 id) external",
  "function cancelIfRevealMissed(uint256 id) external"
];

// ==========================================
// 3. SETUP & VALIDATION
// ==========================================
if (!RPC_URL || !PRIVATE_KEY) {
  console.error("❌ Error: Missing RPC_URL or PRIVATE_KEY in .env file");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

console.log(`✅ Relayer started!`);
console.log(`🔗 Connected to: ${CONTRACT_ADDRESS}`);
console.log(`🤖 Wallet: ${wallet.address}\n`);

// ==========================================
// 4. MAIN LOGIC
// ==========================================
async function processSettlement(id, s, currentBlock) {
  // --- TYPE CONVERSION FIX ---
  // Convert everything to Number so we can compare them easily in JS
  const state = Number(s.state);
  const commitBlock = Number(s.commitBlock);
  const revealBlock = Number(s.revealBlock);
  const validatedBlock = Number(s.validatedBlock);
  const settledBlock = Number(s.settledBlock);

  console.log(`   ID ${id} State: ${stateNames(state)}`);

  // 1. Auto-Cancel (State: COMMITTED)
  if (state === 1) {
    const win = Number(await contract.REVEAL_WINDOW());
    const deadline = commitBlock + win;
    
    if (currentBlock > deadline) {
      console.log(`   🚨 Reveal window missed! Auto-cancelling...`);
      await sendTx(contract.cancelIfRevealMissed(id));
    } else {
      console.log(`      Waiting for reveal... (${deadline - currentBlock} blocks left)`);
    }
    return;
  }

  // 2. Auto-Validate (State: REVEALED)
  if (state === 2) {
    const delay = Number(await contract.VALIDATION_DELAY());
    const targetBlock = revealBlock + delay;

    if (currentBlock >= targetBlock) {
      console.log(`   🔍 Validation delay passed. Validating...`);
      await sendTx(contract.validate(id));
    } else {
      console.log(`      Waiting for validation delay... (${targetBlock - currentBlock} blocks left)`);
    }
    return;
  }

  // 3. Auto-Settle (State: VALIDATED)
  if (state === 3) {
    const win = Number(await contract.VALIDATION_WINDOW());
    const targetBlock = validatedBlock + win;

    if (currentBlock > targetBlock) {
      console.log(`   💸 Dispute window closed. Settling...`);
      await sendTx(contract.settle(id));
    } else {
      console.log(`      Waiting for dispute window... (${targetBlock - currentBlock} blocks left)`);
    }
    return;
  }

  // 4. Auto-Finalize (State: SETTLED)
  if (state === 4) {
    const delay = Number(await contract.FINALIZATION_DELAY());
    const targetBlock = settledBlock + delay;

    if (currentBlock >= targetBlock) {
      console.log(`   🏁 Finalization delay passed. Finalizing...`);
      await sendTx(contract.finalize(id));
    } else {
      console.log(`      Waiting for finalization... (${targetBlock - currentBlock} blocks left)`);
    }
    return;
  }
}

// Helper to send transactions safely
async function sendTx(txPromise) {
  try {
    const tx = await txPromise;
    console.log(`      ⏳ Sent Tx: ${tx.hash}`);
    await tx.wait();
    console.log(`      ✅ Success!`);
  } catch (e) {
    console.error(`      ❌ Failed: ${e.shortMessage || e.message}`);
  }
}

// Helper for readable logs
function stateNames(s) {
  const names = ["NONE", "COMMITTED", "REVEALED", "VALIDATED", "SETTLED", "FINALIZED", "CANCELLED", "DISPUTED"];
  return names[s] || "UNKNOWN";
}

// ==========================================
// 5. LOOP
// ==========================================
async function loop() {
  try {
    const block = await provider.getBlockNumber();
    const nextIdBig = await contract.nextId();
    const nextId = Number(nextIdBig);

    console.log(`\n⛓  Scanning Block ${block} | Total Settlements: ${nextId - 1}`);

    for (let id = 1; id < nextId; id++) {
      const s = await contract.getSettlement(id);
      // Skip completed states (5=Finalized, 6=Cancelled, 7=Disputed)
      if (Number(s.state) >= 5) continue;
      
      await processSettlement(id, s, block);
    }
  } catch (err) {
    console.error("❌ Loop Error:", err.message);
  }
}

// Run immediately, then every 12 seconds (Sepolia block time)
loop();
setInterval(loop, 12000);