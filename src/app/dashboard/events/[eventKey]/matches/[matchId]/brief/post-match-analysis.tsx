interface PostMatchAnalysisProps {
  prediction: {
    winner: "red" | "blue";
    confidence: "high" | "medium" | "low";
    redScore: number;
    blueScore: number;
  };
  actualRedScore: number;
  actualBlueScore: number;
  redTeams: number[];
  blueTeams: number[];
}

export function PostMatchAnalysis({
  prediction,
  actualRedScore,
  actualBlueScore,
  redTeams,
  blueTeams,
}: PostMatchAnalysisProps) {
  const actualWinner =
    actualRedScore > actualBlueScore
      ? "red"
      : actualBlueScore > actualRedScore
      ? "blue"
      : "tie";

  const predictionCorrect =
    actualWinner === "tie" ? false : prediction.winner === actualWinner;

  const redDiff = actualRedScore - prediction.redScore;
  const blueDiff = actualBlueScore - prediction.blueScore;
  const totalScoreError =
    Math.abs(redDiff) + Math.abs(blueDiff);
  const avgError = totalScoreError / 2;

  // Accuracy rating based on average score error
  let accuracyLabel: string;
  let accuracyColor: string;
  if (avgError <= 5) {
    accuracyLabel = "Excellent";
    accuracyColor = "text-green-200 bg-green-500/20 border-green-500/30";
  } else if (avgError <= 15) {
    accuracyLabel = "Good";
    accuracyColor = "text-blue-200 bg-blue-500/20 border-blue-500/30";
  } else if (avgError <= 30) {
    accuracyLabel = "Fair";
    accuracyColor = "text-yellow-200 bg-yellow-500/20 border-yellow-500/30";
  } else {
    accuracyLabel = "Off";
    accuracyColor = "text-red-200 bg-red-500/20 border-red-500/30";
  }

  function diffDisplay(diff: number) {
    if (diff === 0) return <span className="text-gray-400">±0</span>;
    if (diff > 0)
      return <span className="text-green-300">+{diff}</span>;
    return <span className="text-red-300">{diff}</span>;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Post-Match Analysis
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              predictionCorrect
                ? "bg-green-500/20 text-green-200"
                : actualWinner === "tie"
                ? "bg-white/10 text-gray-200"
                : "bg-red-500/20 text-red-200"
            }`}
          >
            {predictionCorrect
              ? "Prediction Correct"
              : actualWinner === "tie"
              ? "Tie (No Winner)"
              : "Prediction Wrong"}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${accuracyColor}`}
          >
            {accuracyLabel} accuracy
          </span>
        </div>
      </div>

      {/* Score comparison table */}
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5">
              <th className="px-4 py-2 text-left font-medium text-gray-300">
                Alliance
              </th>
              <th className="px-4 py-2 text-center font-medium text-gray-300">
                Predicted
              </th>
              <th className="px-4 py-2 text-center font-medium text-gray-300">
                Actual
              </th>
              <th className="px-4 py-2 text-center font-medium text-gray-300">
                Diff
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            <tr>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="font-medium text-white">Red</span>
                  <span className="text-xs text-gray-400">
                    {redTeams.join(", ")}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-center font-semibold text-gray-200">
                {prediction.redScore}
              </td>
              <td className="px-4 py-3 text-center font-bold text-red-200">
                {actualRedScore}
              </td>
              <td className="px-4 py-3 text-center font-medium">
                {diffDisplay(redDiff)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="font-medium text-white">Blue</span>
                  <span className="text-xs text-gray-400">
                    {blueTeams.join(", ")}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-center font-semibold text-gray-200">
                {prediction.blueScore}
              </td>
              <td className="px-4 py-3 text-center font-bold text-blue-200">
                {actualBlueScore}
              </td>
              <td className="px-4 py-3 text-center font-medium">
                {diffDisplay(blueDiff)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white/5 p-3 text-center">
          <p className="text-xs text-gray-400">Predicted Winner</p>
          <p
            className={`text-sm font-bold ${
              prediction.winner === "red" ? "text-red-300" : "text-blue-300"
            }`}
          >
            {prediction.winner === "red" ? "Red" : "Blue"}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 p-3 text-center">
          <p className="text-xs text-gray-400">Actual Winner</p>
          <p
            className={`text-sm font-bold ${
              actualWinner === "red"
                ? "text-red-300"
                : actualWinner === "blue"
                ? "text-blue-300"
                : "text-gray-300"
            }`}
          >
            {actualWinner === "red"
              ? "Red"
              : actualWinner === "blue"
              ? "Blue"
              : "Tie"}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 p-3 text-center">
          <p className="text-xs text-gray-400">Avg Score Error</p>
          <p className="text-sm font-bold text-white">
            {avgError.toFixed(1)} pts
          </p>
        </div>
      </div>

      {/* Margin comparison */}
      <div className="mt-3 rounded-2xl bg-white/5 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Predicted margin</span>
          <span className="font-medium text-white">
            {Math.abs(prediction.redScore - prediction.blueScore)} pts (
            {prediction.winner === "red" ? "Red" : "Blue"})
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-gray-400">Actual margin</span>
          <span className="font-medium text-white">
            {Math.abs(actualRedScore - actualBlueScore)} pts{" "}
            {actualWinner !== "tie"
              ? `(${actualWinner === "red" ? "Red" : "Blue"})`
              : "(Tie)"}
          </span>
        </div>
      </div>
    </div>
  );
}
