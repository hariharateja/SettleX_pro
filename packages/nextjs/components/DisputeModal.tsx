"use client";

import React, { useState } from "react";

interface DisputeModalProps {
  id: number | string | null;
  isOpen: boolean;
  onClose: () => void;
  onDispute: (id: number | string, reason: string) => void;
}

export default function DisputeModal({ id, isOpen, onClose, onDispute }: DisputeModalProps) {
  const [reason, setReason] = useState("");

  if (!isOpen || id === null) return null; // safely handle null id

  const submit = () => {
    onDispute(id, reason);
    setReason("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-base-100 p-6 rounded-xl shadow-xl w-96">
        <h2 className="text-xl font-bold mb-2">Dispute Settlement #{id}</h2>

        <p className="text-sm opacity-70 mb-2">
          You will receive <b>10% of the proposers bond</b> if your dispute is valid.
        </p>

        <textarea
          className="textarea textarea-bordered w-full mb-3"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-error" onClick={submit}>Dispute</button>
        </div>
      </div>
    </div>
  );
}