/**
 * RELAYER FOR SETTLEX - Production-like settlement automation
 *
 * Responsibilities:
 * - Watch on-chain events (Committed, Revealed, Validated, Settled)
 * - Maintain an in-memory queue of settlement IDs to process
 * - Periodically check block numbers to decide whether to:
 *      - validate(id)
 *      - settle(id)
 *      - finalize(id)
 * - Handle retries, errors, and skip disputed/cancelled settlements
 * - Ensure idempotence: do not re-call functions that already executed
 * - Print clean logs for hackathon demo
 */

import { ethers } from "ethers";
import fs from "fs";

// ---- CONFIG ----
const RPC = process.env.RPC || "http://localhost:8545";
const RELAYER_PK = process.env.RELAYER_PK || "";  // Should be anvil test key / account with ETH
const POLL_INTERVAL = 4000; // ms

// ---- LOAD DEPLOYMENTS ----
const DEPLOY_PATH = "./deployments/31337.json";
const OUT_PATH = "./out/SettleX.s.sol/SettleX.json";

const deployments = JSON.parse(fs.readFileSync(DEPLOY_PATH, "utf8"));
const settlexAddress = deployments["SettleX"];
const abi = JSON.parse(fs.readFileSync(OUT_PATH, "utf8")).abi;

// ---- PROVIDER & SIGNER ----
const provider = new ethers.providers.JsonRpcProvider(RPC);

let signer;
if (RELAYER_PK !== "") {
    signer = new ethers.Wallet(RELAYER_PK, provider);
} else {
    // fallback: use first unlocked anvil account
    const accounts = await provider.listAccounts();
    signer = provider.getSigner(accounts[0]);
}

console.log("🚀 Relayer running on RPC:", RPC);
console.log("🔗 Watching SettleX at:", settlexAddress);
console.log("👤 Relayer signer:", await signer.getAddress());

// ---- CONTRACT INSTANCE ----
const contract = new ethers.Contract(settlexAddress, abi, signer);

// ---- IN-MEMORY SETTLEMENT TRACKING ----
let pending = new Set();   // settlement IDs being tracked

// ---- LISTEN TO EVENTS TO AUTO-PUSH IDs ----
contract.on("Committed", (id, who, hash, blockNo) => {
    console.log(`📥 New Commit: id=${id} from=${who}`);
    pending.add(id.toNumber());
});

contract.on("Revealed", (id, who, blockNo) => {
    console.log(`🔓 Revealed: id=${id}`);
    pending.add(id.toNumber());
});

contract.on("Validated", (id, who, val, blockNo) => {
    console.log(`🟦 Validated: id=${id}`);
    pending.add(id.toNumber());
});

contract.on("Settled", (id, blockNo) => {
    console.log(`🟩 Settled: id=${id}`);
    pending.add(id.toNumber());
});

contract.on("Disputed", (id, who, reason) => {
    console.log(`⚠️ DISPUTED: id=${id} reason=${reason}`);
    // disputed items should be removed from queue
    pending.delete(id.toNumber());
});

// ----------------------------------------------------------------------------------
//  MAIN POLL LOOP
// ----------------------------------------------------------------------------------
async function poll() {
    const block = await provider.getBlockNumber();
    const nextId = await contract.nextId();

    console.log(`\n⏳ Block = ${block}, tracking ${pending.size} settlements...`);

    // Add any missing IDs for safety
    for (let id = 1; id < nextId; id++) pending.add(id);

    for (const id of [...pending]) {
        try {
            const s = await contract.getSettlement(id);
            const state = Number(s.state);
            const commitBlock = Number(s.commitBlock);
            const revealBlock = Number(s.revealBlock);
            const validatedBlock = Number(s.validatedBlock);
            const settledBlock = Number(s.settledBlock);

            const REVEAL_WINDOW = Number(await contract.REVEAL_WINDOW());
            const VALIDATION_DELAY = Number(await contract.VALIDATION_DELAY());
            const VALIDATION_WINDOW = Number(await contract.VALIDATION_WINDOW());
            const FINALIZATION_DELAY = Number(await contract.FINALIZATION_DELAY());

            // --- CHECK FOR CANCEL / TIMEOUT ---
            if (state === 1 /* COMMITTED */) {
                if (block > commitBlock + REVEAL_WINDOW) {
                    console.log(`⌛ Reveal window passed → auto-cancel id=${id}`);
                    try { 
                        await (await contract.cancelIfRevealMissed(id)).wait();
                    } catch (e) {
                        console.log("Cancel failed:", e.message);
                    }
                    pending.delete(id);
                    continue;
                }
            }

            // --- VALIDATE ---
            if (state === 2 /* REVEALED */) {
                if (block >= revealBlock + VALIDATION_DELAY) {
                    console.log(`🟦 Validating id=${id}`);
                    try {
                        await (await contract.validate(id)).wait();
                    } catch (e) {
                        console.log("Validate failed:", e.message);
                    }
                }
            }

            // --- DISPUTE WINDOW CHECK ---
            if (state === 3 /* VALIDATED */) {
                if (block > validatedBlock + VALIDATION_WINDOW) {
                    console.log(`ℹ️ Dispute window passed → now able to settle id=${id}`);
                }
                console.log(`🟩 Settling id=${id}`);
                try {
                    await (await contract.settle(id)).wait();
                } catch (e) {
                    console.log("Settle failed:", e.message);
                }
            }

            // --- FINALIZE ---
            if (state === 4 /* SETTLED */) {
                if (block >= settledBlock + FINALIZATION_DELAY) {
                    console.log(`🔒 Finalizing id=${id}`);
                    try {
                        await (await contract.finalize(id)).wait();
                    } catch (e) {
                        console.log("Finalize failed:", e.message);
                    }
                    pending.delete(id);  // done
                }
            }

            // DISPUTED or CANCELLED → remove from tracking
            if (state === 5 /* FINALIZED */ ||
                state === 6 /* CANCELLED */ ||
                state === 7 /* DISPUTED */) {
                pending.delete(id);
            }

        } catch (err) {
            console.error(`❌ Error processing id=${id}:`, err);
        }
    }
}

// Run loop
setInterval(poll, POLL_INTERVAL);