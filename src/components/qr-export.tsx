"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRExportProps {
  data: {
    match_id: string;
    team_number: number;
    auto_score: number;
    teleop_score: number;
    endgame_score: number;
    defense_rating: number;
    reliability_rating: number;
    notes: string;
  };
}

export function QRExport({ data }: QRExportProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Compact payload for QR code (shorter keys to fit more data)
  const compact = {
    m: data.match_id,
    t: data.team_number,
    a: data.auto_score,
    tp: data.teleop_score,
    eg: data.endgame_score,
    d: data.defense_rating,
    r: data.reliability_rating,
    n: data.notes,
  };

  const jsonString = JSON.stringify(compact);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = JSON.stringify(data);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-sm font-medium text-gray-200 transition hover:text-white"
      >
        <span>Backup QR Code</span>
        <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="flex justify-center rounded-xl bg-white p-4">
            <QRCodeSVG
              value={jsonString}
              size={200}
              level="M"
              includeMargin
            />
          </div>
          <p className="text-center text-xs text-gray-400">
            Scan to transfer this scouting entry
          </p>
          <button
            onClick={handleCopy}
            className="w-full rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/20"
          >
            {copied ? "Copied!" : "Copy JSON Data"}
          </button>
        </div>
      )}
    </div>
  );
}
