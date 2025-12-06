"use client";

import React, { useState } from "react";
import { getSignerContract, encodePreimage, toWei } from "../utils/settlex";

export default function RevealForm() {
  const [id, setId] = useState("");
  const [token, setToken] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  async function handleReveal(e) {
    e.preventDefault();
    try {
      const contract = getSignerContract();
      const preimage = encodePreimage(token, to, toWei(amount));

      setStatus("⏳ Sending reveal...");
      const tx = await contract.reveal(id, preimage);

      await tx.wait();
      setStatus("✅ Reveal successful!");
    } catch (err) {
      console.error(err);
      setStatus("❌ " + (err.reason || err.message));
    }
  }

  return (
    <form onSubmit={handleReveal} className="space-y-4">
      <input
        className="input input-bordered w-full"
        placeholder="Settlement ID"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="Token Address"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="Receiver"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button className="btn btn-success w-full" type="submit">
        Reveal
      </button>

      <p className="text-sm opacity-80">{status}</p>
    </form>
  );
}