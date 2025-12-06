import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

// KEEP YOUR ADDRESSES SAME AS BEFORE
const ORACLE_1_ADDR = "0x2105479eEC7AbabF7CD90c82e8352adC7375F285";
const ORACLE_2_ADDR = "0x74aF220895df10a5a40E11eDd8F947e7E088b5a6";

const ORACLE_ABI = [
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function setPrice(int256 _price) external"
];

export default function AdversarialPanel() {
  const [price1, setPrice1] = useState("...");
  const [price2, setPrice2] = useState("...");

  async function refresh() {
    try {
      // FIX: Use providers.Web3Provider for Ethers v5
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      
      const o1 = new ethers.Contract(ORACLE_1_ADDR, ORACLE_ABI, provider);
      const [, p1] = await o1.latestRoundData();
      setPrice1(ethers.utils.formatUnits(p1, 8)); // v5 uses utils.formatUnits

      const o2 = new ethers.Contract(ORACLE_2_ADDR, ORACLE_ABI, provider);
      const [, p2] = await o2.latestRoundData();
      setPrice2(ethers.utils.formatUnits(p2, 8));
    } catch (err) {
      console.error("Error fetching prices:", err);
    }
  }

  async function hackOracle(address, val) {
    try {
      // FIX: Use providers.Web3Provider for Ethers v5
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner(); // Sync in v5
      const oracle = new ethers.Contract(address, ORACLE_ABI, signer);
      
      // FIX: v5 uses utils.parseUnits
      const newPrice = ethers.utils.parseUnits(val, 8);
      
      const tx = await oracle.setPrice(newPrice);
      await tx.wait();
      alert(`⚠️ Oracle manipulated to $${val}`);
      refresh();
    } catch (err) {
      console.error(err);
      alert("Hack failed: " + (err.message || err));
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    // ✅ FIX: Added 'text-black' to force readability on the red background
    <div style={{ 
      border: "2px solid #b91c1c", 
      padding: "20px", 
      background: "#fef2f2", 
      borderRadius: "12px",
      color: "black", // <--- FORCE TEXT TO BLACK
      marginBottom: "30px"
    }}>
      <h3 style={{ margin: "0 0 15px 0", color: "#b91c1c", fontSize: "1.5rem", fontWeight: "bold" }}>
        👹 Adversarial Control Panel (Demo)
      </h3>
      
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        {/* ORACLE 1 CONTROL */}
        <div style={{ background: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", flex: 1 }}>
          <strong style={{ display: "block", marginBottom: "10px", fontSize: "1.1em" }}>
            Oracle 1 (Primary): <span style={{ color: "#2563eb" }}>${price1}</span>
          </strong>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={() => hackOracle(ORACLE_1_ADDR, "2000")}
              className="btn btn-sm btn-success text-white"
            >
              ✅ Normal ($2K)
            </button>
            <button 
              onClick={() => hackOracle(ORACLE_1_ADDR, "3000")} 
              className="btn btn-sm btn-error text-white"
            >
              ⚠️ Spike ($3K)
            </button>
          </div>
        </div>

        {/* ORACLE 2 CONTROL */}
        <div style={{ background: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", flex: 1 }}>
          <strong style={{ display: "block", marginBottom: "10px", fontSize: "1.1em" }}>
            Oracle 2 (Secondary): <span style={{ color: "#2563eb" }}>${price2}</span>
          </strong>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={() => hackOracle(ORACLE_2_ADDR, "2000")}
              className="btn btn-sm btn-success text-white"
            >
              ✅ Normal ($2K)
            </button>
            <button 
              onClick={() => hackOracle(ORACLE_2_ADDR, "3000")} 
              className="btn btn-sm btn-error text-white"
            >
              ⚠️ Spike ($3K)
            </button>
          </div>
        </div>
      </div>

      <p style={{ marginTop: "15px", fontSize: "0.9em", opacity: 0.8, fontStyle: "italic" }}>
        * <strong>Adversarial Test:</strong> Spike Oracle 1 to $3000 while leaving Oracle 2 at $2000 to trigger a conflict dispute, or spike both to simulate a flash crash.
      </p>
    </div>
  );
}