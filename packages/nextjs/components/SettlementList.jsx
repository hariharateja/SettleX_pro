"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

// --- 1. HARDCODED CONFIG ---
const SETTLEX_ADDRESS = "0x7967092C94FAF440C8c4cFD271B8079554F4Ee1C";

const SETTLEX_ABI = [
  "function nextId() view returns (uint256)",
  "function settlements(uint256) view returns (address initiator, bytes32 commitHash, bytes revealed, uint8 state, uint256 commitBlock, uint256 revealBlock, uint256 validatedBlock, uint256 settledBlock, uint256 bond)",
  "function validate(uint256 id) external",
  "function settle(uint256 id) external",
  "function finalize(uint256 id) external",
  "event Disputed(uint256 indexed id, string reason)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const STATE_MAP = [
  "NONE", "COMMITTED", "REVEALED", "VALIDATED", "SETTLED", 
  "FINALIZED", "CANCELLED", "DISPUTED"
];

export default function SettlementList({ openDisputeModal }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({});

  async function loadData() {
    if (!window.ethereum) return;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(SETTLEX_ADDRESS, SETTLEX_ABI, provider);

      const nextIdBN = await contract.nextId();
      const count = nextIdBN.toNumber();
      
      const list = [];

      for (let id = count - 1; id >= 1; id--) {
        try {
          const s = await contract.settlements(id);
          
          let disputeReason = null;
          // Safe Access: Check named property OR array index
          const stateEnum = s.state !== undefined ? s.state : s[3];

          // ---------------------------------------------------------
          // 🔎 FETCH DISPUTE REASON
          // ---------------------------------------------------------
          if (stateEnum === 7) { // 7 = DISPUTED
            try {
              const filter = contract.filters.Disputed(id);
              
              // ✅ FIX: Explicitly convert BigNumber to Number for Ethers v5
              // commitBlock is at index 4 in the struct array
              const rawBlock = s.commitBlock || s[4];
              const startBlock = rawBlock ? Number(rawBlock.toString()) : 0;

              const events = await contract.queryFilter(filter, startBlock, "latest");
              
              if (events.length > 0) {
                disputeReason = events[0].args.reason;
              }
            } catch (e) {
              console.error("Event fetch failed", e);
            }
          }

          list.push({
            id: id,
            initiator: s.initiator || s[0], 
            state: stateEnum,
            bond: ethers.utils.formatEther(s.bond || s[8] || "0"), 
            revealed: s.revealed || s[2],
            disputeReason: disputeReason
          });
        } catch (innerErr) {
          console.error(`Skipping ID ${id}`, innerErr);
        }
      }
      setRows(list);
    } catch (err) {
      console.error("Load Data Error:", err);
    }
  }

  // --- ACTIONS ---

  async function handleApprove(id, revealedBytes) {
    try {
      setStatus(prev => ({ ...prev, [id]: "⏳ Approving..." }));
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const [tokenAddr, , amount] = ethers.utils.defaultAbiCoder.decode(
        ["address", "address", "uint256"], 
        revealedBytes
      );

      const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      const tx = await erc20.approve(SETTLEX_ADDRESS, amount);
      await tx.wait();

      setStatus(prev => ({ ...prev, [id]: "✅ Approved" }));
    } catch (err) {
      console.error(err);
      setStatus(prev => ({ ...prev, [id]: "❌ Approve Failed" }));
    }
  }

  async function handleAction(id, method) {
    try {
      setStatus(prev => ({ ...prev, [id]: `⏳ ${method}...` }));
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(SETTLEX_ADDRESS, SETTLEX_ABI, signer);

      let tx;
      if (method === "validate") tx = await contract.validate(id);
      if (method === "settle") tx = await contract.settle(id);
      if (method === "finalize") tx = await contract.finalize(id);

      await tx.wait();
      setStatus(prev => ({ ...prev, [id]: "✅ Success" }));
      loadData();
    } catch (err) {
      console.error(err);
      setStatus(prev => ({ ...prev, [id]: "❌ Failed" }));
      alert("Transaction Failed: " + (err.reason || err.message));
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card bg-base-100 shadow-xl p-6 text-base-content border border-base-300">
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-2xl">📜 Settlement List</h3>
        <div className="flex gap-2 items-center">
           <button onClick={loadData} className="btn btn-sm btn-ghost">Refresh</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="bg-base-200 text-base-content/70 uppercase text-sm">
              <th>ID</th>
              <th>Status</th>
              <th>Initiator</th>
              <th>Bond</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover">
                <td className="font-bold font-mono text-lg">#{r.id}</td>
                
                <td>
                  <span className={`badge badge-lg ${
                    r.state === 7 ? 'badge-error font-bold' : 
                    r.state === 3 ? 'badge-success text-white' : 
                    'badge-info text-white'
                  }`}>
                    {STATE_MAP[r.state] || r.state}
                  </span>
                  
                  {/* DISPLAY DISPUTE REASON */}
                  {r.state === 7 && r.disputeReason && (
                    <div className="text-error text-xs font-mono mt-1 font-bold uppercase tracking-wide">
                      🛑 {r.disputeReason}
                    </div>
                  )}
                </td>

                <td className="font-mono opacity-70">
                  {r.initiator.slice(0, 6)}...{r.initiator.slice(-4)}
                </td>
                
                <td className="font-bold">{r.bond} ETH</td>

                <td className="space-x-2">
                  {r.state === 2 && (
                    <button 
                      onClick={() => handleAction(r.id, "validate")}
                      className="btn btn-sm btn-warning text-black no-animation"
                    >
                      🛡️ Validate
                    </button>
                  )}

                  {r.state === 3 && (
                    <>
                      <button 
                        onClick={() => handleApprove(r.id, r.revealed)}
                        className="btn btn-xs btn-outline"
                      >
                        1. Approve
                      </button>
                      <button 
                        onClick={() => handleAction(r.id, "settle")}
                        className="btn btn-sm btn-success text-white"
                      >
                        2. Settle 💸
                      </button>
                    </>
                  )}

                  {r.state === 7 && (
                    <div className="flex items-center gap-1 text-error font-bold text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      REFUNDED
                    </div>
                  )}

                  <span className="text-xs opacity-50 ml-2 block mt-1">
                    {status[r.id]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {rows.length === 0 && (
        <div className="text-center p-10 opacity-50 bg-base-200 rounded-lg mt-4">
          <p>No settlements found on Sepolia yet.</p>
        </div>
      )}
    </div>
  );
}