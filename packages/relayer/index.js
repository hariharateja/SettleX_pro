/**
 * Simple relayer:
 * - polls contract.nextId()
 * - for ids in [1, nextId) reads getSettlement()
 * - if REVEALED & block >= revealBlock + VALIDATION_DELAY -> validate(id)
 * - if VALIDATED & block >= validatedBlock + VALIDATION_WINDOW -> settle(id)
 * - if SETTLED & block >= settledBlock + FINALIZATION_DELAY -> finalize(id)
 *
 * This is minimal and intentionally robust: it waits for tx confirmations and logs actions.
 */

const { ethers } = require("ethers");
const cfg = require("./config");
const settlexJson = require("../nextjs/contracts/settlex.json");

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function main(){
  if(!cfg.rpc || !cfg.key || !cfg.contract) {
    console.error("Set RELAYER env vars in .env (SEPOLIA_RPC_URL, RELAYER_PRIVATE_KEY, CONTRACT_ADDRESS)");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const wallet = new ethers.Wallet(cfg.key, provider);
  const contract = new ethers.Contract(cfg.contract, settlexJson.abi, wallet);

  console.log("Relayer started, watching contract:", cfg.contract);

  while(true){
    try {
      const nextIdBn = await contract.nextId();
      const nextId = Number(nextIdBn.toString());
      const blockNumber = Number((await provider.getBlockNumber()).toString());

      for(let id=1; id<nextId; id++){
        const stRaw = await contract.getSettlement(id);
        // stRaw is a tuple: [initiator, commitHash, revealed, state, commitBlock, revealBlock, validatedBlock, settledBlock, bond]
        const state = Number(stRaw[3].toString());
        const commitBlock = Number(stRaw[4].toString());
        const revealBlock = Number(stRaw[5].toString());
        const validatedBlock = Number(stRaw[6].toString());
        const settledBlock = Number(stRaw[7].toString());
        const bond = stRaw[8].toString();

        // fetch windows
        const revealWindow = Number((await contract.REVEAL_WINDOW()).toString());
        const validationDelay = Number((await contract.VALIDATION_DELAY()).toString());
        const validationWindow = Number((await contract.VALIDATION_WINDOW()).toString());
        const finalDelay = Number((await contract.FINALIZATION_DELAY()).toString());

        // 2 = REVEALED (enum index), 3 = VALIDATED, 4 = SETTLED
        if(state === 2){
          if(blockNumber >= revealBlock + validationDelay){
            console.log(`id=${id} eligible for validate (block ${blockNumber} >= ${revealBlock} + ${validationDelay})`);
            try {
              const tx = await contract.validate(id);
              console.log("validate tx sent:", tx.hash);
              await tx.wait();
              console.log("validate confirmed for id", id);
            } catch (e) {
              console.error("validate failed for id", id, e.reason || e.message || e);
            }
          }
        } else if(state === 3) {
          // validated: wait until validation window passes to call settle (to allow disputes)
          if(blockNumber >= validatedBlock + validationWindow){
            console.log(`id=${id} eligible for settle (block ${blockNumber} >= ${validatedBlock} + ${validationWindow})`);
            try {
              const tx = await contract.settle(id);
              console.log("settle tx sent:", tx.hash);
              await tx.wait();
              console.log("settle confirmed for id", id);
            } catch (e) {
              console.error("settle failed for id", id, e.reason || e.message || e);
            }
          }
        } else if(state === 4) {
          // settled: wait finalization delay then call finalize
          if(blockNumber >= settledBlock + finalDelay){
            console.log(`id=${id} eligible for finalize (block ${blockNumber} >= ${settledBlock} + ${finalDelay})`);
            try {
              const tx = await contract.finalize(id);
              console.log("finalize tx sent:", tx.hash);
              await tx.wait();
              console.log("finalize confirmed for id", id);
            } catch (e) {
              console.error("finalize failed for id", id, e.reason || e.message || e);
            }
          }
        }
      }
    } catch (err){
      console.error("Main loop error:", err);
    }

    await sleep(cfg.pollInterval);
  }
}

main().catch(e => { console.error(e); process.exit(1); });