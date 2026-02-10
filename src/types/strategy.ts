import { z } from "zod";

export const MLPredictionSchema = z.object({
  winner: z.string(),
  winProbability: z.number(),
  redScore: z.number(),
  blueScore: z.number(),
});

export const AllianceAnalysisSchema = z.object({
  totalEPA: z.number(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  keyPlayers: z.array(z.number()),
});

export const TeamAnalysisSchema = z.object({
  teamNumber: z.number(),
  alliance: z.enum(["red", "blue"]),
  epaBreakdown: z.object({
    total: z.number(),
    auto: z.number(),
    teleop: z.number(),
    endgame: z.number(),
  }),
  scoutingInsights: z.string(),
  role: z.enum(["scorer", "defender", "support"]),
});

export const BriefContentSchema = z.object({
  prediction: z.object({
    winner: z.enum(["red", "blue"]),
    confidence: z.enum(["high", "medium", "low"]),
    redScore: z.number(),
    blueScore: z.number(),
  }),
  mlPrediction: MLPredictionSchema.optional(),
  redAlliance: AllianceAnalysisSchema,
  blueAlliance: AllianceAnalysisSchema,
  teamAnalysis: z.array(TeamAnalysisSchema),
  strategy: z.object({
    redRecommendations: z.array(z.string()),
    blueRecommendations: z.array(z.string()),
    keyMatchups: z.array(z.string()),
  }),
});

export const PickListTeamSchema = z.object({
  rank: z.number(),
  teamNumber: z.number(),
  overallScore: z.number(),
  epa: z.object({
    total: z.number(),
    auto: z.number(),
    teleop: z.number(),
    endgame: z.number(),
  }),
  winRate: z.number().nullable(),
  synergy: z.enum(["high", "medium", "low"]),
  synergyReason: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  role: z.enum(["scorer", "defender", "support", "versatile"]),
  scoutingSummary: z.string(),
  pickReason: z.string(),
});

export const PickListContentSchema = z.object({
  yourTeamNumber: z.number().nullable(),
  rankings: z.array(PickListTeamSchema),
  summary: z.string(),
});

export type MLPrediction = z.infer<typeof MLPredictionSchema>;
export type AllianceAnalysis = z.infer<typeof AllianceAnalysisSchema>;
export type TeamAnalysis = z.infer<typeof TeamAnalysisSchema>;
export type BriefContent = z.infer<typeof BriefContentSchema>;
export type PickListTeam = z.infer<typeof PickListTeamSchema>;
export type PickListContent = z.infer<typeof PickListContentSchema>;
