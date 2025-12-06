"use client";

import { useState } from "react";
import { ethers } from "ethers";

import CommitForm from "../components/CommitForm";
import RevealForm from "../components/RevealForm";
import SettlementList from "../components/SettlementList";
import DisputeModal from "../components/DisputeModal";
import AdversarialPanel from "../components/AdversarialPanel"; // ✅ Imported

// --- ABI import ---
import settlexAbi from "../contracts/settlex.json"; 

export default function HomePage() {

  // -------------------------------
  // 🔴 STATE for Dispute Modal
  // -------------------------------
  const [disputeId, setDisputeId] = useState<string | number | null>(null);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);

  function openDisputeModal(id: string | number) {
    setDisputeId(id);
    setIsDisputeOpen(true);
  }

  function closeDisputeModal() {
    setDisputeId(null);
    setIsDisputeOpen(false);
  }

  // -------------------------------
  // 🟢 DISPUTE HANDLER
  // -------------------------------
  async function handleDispute(id: string | number, reason: string) {
    try {
      if (!window.ethereum) {
        alert("Connect wallet first");
        return;
      }

      // Ensure address matches your deployment
      const contractAddr = "0x9aC6349e754AdA70Da7AC164D712B96a7e47e1ca"; 

      // FIX: Ethers v5 Syntax
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const settle = new ethers.Contract(
        contractAddr,
        settlexAbi.abi || settlexAbi, // Handle array or object ABI
        signer
      );

      const tx = await settle.dispute(id, reason || "invalid settlement");
      await tx.wait();

      alert("❗ Settlement disputed.\nReporter earned 10% of bond.");
      closeDisputeModal();
    } catch (err) {
      console.error(err);
      alert("Dispute failed. Check console.");
    }
  }

  return (
    <div className="min-h-screen p-10 bg-base-200 text-base-content">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">SettleX Protocol</h1>
          <p className="opacity-80">Commit → Reveal → Validate → Settle → Finalize → Dispute</p>
        </div>

        {/* ------------------------------------------------------- */}
        {/* 👹 ADVERSARIAL PANEL (DEMO CONTROL) - ADDED HERE        */}
        {/* ------------------------------------------------------- */}
        <div className="mb-8">
           <AdversarialPanel />
        </div>

        {/* FORMS */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card bg-base-100 card-bordered shadow-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Commit</h2>
            <CommitForm />
          </div>

          <div className="card bg-base-100 card-bordered shadow-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Reveal</h2>
            <RevealForm />
          </div>
        </div>

        {/* SETTLEMENT TABLE */}
        <div className="card bg-base-100 card-bordered shadow-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Settlements</h2>
          {/* Pass openDisputeModal to SettlementList */}
          <SettlementList openDisputeModal={openDisputeModal} />
        </div>
      </div>

      {/* DISPUTE MODAL */}
      <DisputeModal
        id={disputeId}
        isOpen={isDisputeOpen}
        onClose={closeDisputeModal}
        onDispute={handleDispute}
      />
    </div>
  );
}