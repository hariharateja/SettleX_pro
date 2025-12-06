"use client";

import React, { useState } from "react";
import { getSignerContract, encodePreimage, keccak256OfPreimage, toWei } from "../utils/settlex";

export default function CommitForm() {
  const [token, setToken] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [bond, setBond] = useState("0.01");
  const [status, setStatus] = useState("");

  async function handleCommit(e) {
    e.preventDefault();
    try {
      const contract = getSignerContract();
      const encoded = encodePreimage(token, to, toWei(amount));
      const hash = keccak256OfPreimage(encoded);

      setStatus("⏳ Sending transaction...");
      const tx = await contract.commit(hash, { value: toWei(bond) });

      await tx.wait();
      setStatus("✅ Commit successful!");
    } catch (err) {
      console.error(err);
      setStatus("❌ " + (err.reason || err.message));
    }
  }

  return (
    <form onSubmit={handleCommit} className="space-y-4">
      <input
        className="input input-bordered w-full"
        placeholder="Token Address"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="Receiver Address"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="Bond (ETH)"
        value={bond}
        onChange={(e) => setBond(e.target.value)}
      />

      <button className="btn btn-primary w-full" type="submit">
        Commit
      </button>

      <p className="text-sm opacity-80">{status}</p>
    </form>
  );
}