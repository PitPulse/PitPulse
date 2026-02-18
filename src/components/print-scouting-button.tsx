"use client";

interface ScoutingRow {
  matchLabel: string;
  teamNumber: number;
  scoutedBy: string;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  defenseRating: number;
  reliabilityRating: number;
  notes: string;
}

interface PrintScoutingButtonProps {
  eventTitle: string;
  rows: ScoutingRow[];
  label?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function PrintScoutingButton({
  eventTitle,
  rows,
  label = "Print Scouting Data",
}: PrintScoutingButtonProps) {
  function handlePrint() {
    const tableRows = rows
      .map(
        (r) =>
          `<tr>
            <td>${escapeHtml(r.matchLabel)}</td>
            <td>${r.teamNumber}</td>
            <td>${escapeHtml(r.scoutedBy)}</td>
            <td>${r.autoScore}</td>
            <td>${r.teleopScore}</td>
            <td>${r.endgameScore}</td>
            <td>${r.autoScore + r.teleopScore + r.endgameScore}</td>
            <td>${r.defenseRating}/5</td>
            <td>${r.reliabilityRating}/5</td>
            <td style="max-width:200px;word-wrap:break-word">${escapeHtml(r.notes) || "—"}</td>
          </tr>`
      )
      .join("");

    const safeTitle = escapeHtml(eventTitle);
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${safeTitle} — Scouting Data</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a1a; padding: 16px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; font-size: 10px; text-transform: uppercase; }
    tr:nth-child(even) { background: #fafafa; }
    @media print {
      body { padding: 0; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${safeTitle} — Scouting Data</h1>
  <p class="meta">Exported ${new Date().toLocaleString()} &middot; ${rows.length} entries &middot; PitPilot</p>
  <table>
    <thead>
      <tr>
        <th>Match</th>
        <th>Team</th>
        <th>Scout</th>
        <th>Auto</th>
        <th>Teleop</th>
        <th>Endgame</th>
        <th>Total</th>
        <th>Defense</th>
        <th>Reliability</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      {label}
    </button>
  );
}
