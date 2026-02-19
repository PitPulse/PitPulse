import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { TEAM_AI_LIMITS, type PlanTier, normalizePlanTier } from "@/lib/rate-limit";

const DEFAULT_EVENT_SYNC_MIN_YEAR = 2025;
const DEFAULT_SCOUTING_ABILITY_QUESTIONS = [
  "Can go under the trench?",
  "Can go over the ramp?",
];
const MIN_AI_PROMPT_LIMIT = 1;
const MAX_AI_PROMPT_LIMIT = 50;

/* ── Scouting Form Config ─────────────────────────────────────── */

export interface FormOptionItem {
  key: string;
  label: string;
}

export interface ScoutingFormConfig {
  intakeOptions: FormOptionItem[];
  climbLevelOptions: FormOptionItem[];
  shootingRangeOptions: FormOptionItem[];
  autoStartPositions: string[];
  ratingFields: FormOptionItem[];
}

const DEFAULT_SCOUTING_FORM_CONFIG: ScoutingFormConfig = {
  intakeOptions: [
    { key: "depot", label: "Ground Intake" },
    { key: "human_intake", label: "Human Intake" },
  ],
  climbLevelOptions: [
    { key: "level_1", label: "Level 1" },
    { key: "level_2", label: "Level 2" },
    { key: "level_3", label: "Level 3" },
  ],
  shootingRangeOptions: [
    { key: "close", label: "Close" },
    { key: "mid", label: "Mid" },
    { key: "long", label: "Long" },
  ],
  autoStartPositions: ["left", "center", "right"],
  ratingFields: [
    { key: "defense", label: "Defense Ability" },
    { key: "cycle_time", label: "Cycle Time" },
    { key: "shooting_reliability", label: "Auto Shooting Reliability" },
    { key: "reliability", label: "Overall Reliability" },
  ],
};

export function getDefaultScoutingFormConfig(): ScoutingFormConfig {
  return JSON.parse(JSON.stringify(DEFAULT_SCOUTING_FORM_CONFIG));
}

function normalizeFormOptionItem(value: unknown): FormOptionItem | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const key = typeof obj.key === "string" ? obj.key.trim().slice(0, 60) : "";
  const label = typeof obj.label === "string" ? obj.label.trim().slice(0, 80) : "";
  if (!key || !label) return null;
  return { key, label };
}

function normalizeFormOptionItems(value: unknown, fallback: FormOptionItem[]): FormOptionItem[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const items: FormOptionItem[] = [];
  for (const item of value) {
    const normalized = normalizeFormOptionItem(item);
    if (!normalized) continue;
    const lowerKey = normalized.key.toLowerCase();
    if (seen.has(lowerKey)) continue;
    seen.add(lowerKey);
    items.push(normalized);
    if (items.length >= 20) break;
  }
  return items.length > 0 ? items : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 60);
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    items.push(trimmed);
    if (items.length >= 20) break;
  }
  return items.length > 0 ? items : fallback;
}

export function normalizeScoutingFormConfig(value: unknown): ScoutingFormConfig {
  const defaults = getDefaultScoutingFormConfig();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;

  const obj = value as Record<string, unknown>;
  return {
    intakeOptions: normalizeFormOptionItems(obj.intakeOptions, defaults.intakeOptions),
    climbLevelOptions: normalizeFormOptionItems(obj.climbLevelOptions, defaults.climbLevelOptions),
    shootingRangeOptions: normalizeFormOptionItems(obj.shootingRangeOptions, defaults.shootingRangeOptions),
    autoStartPositions: normalizeStringArray(obj.autoStartPositions, defaults.autoStartPositions),
    ratingFields: normalizeFormOptionItems(obj.ratingFields, defaults.ratingFields),
  };
}

export type TeamAiPromptLimits = Record<PlanTier, number>;

function normalizeYear(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_EVENT_SYNC_MIN_YEAR;
  return Math.max(1992, Math.min(parsed, 2100));
}

export function getDefaultEventSyncMinYear(): number {
  const envYear = process.env.TBA_SYNC_MIN_YEAR?.trim();
  if (!envYear) return DEFAULT_EVENT_SYNC_MIN_YEAR;
  return normalizeYear(envYear);
}

function normalizeQuestionText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

export function normalizeScoutingAbilityQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SCOUTING_ABILITY_QUESTIONS];

  const unique = new Set<string>();
  for (const item of value) {
    const normalized = normalizeQuestionText(item);
    if (!normalized) continue;
    if (unique.has(normalized.toLowerCase())) continue;
    unique.add(normalized.toLowerCase());
    if (unique.size >= 24) break;
  }

  const questions = Array.from(unique.values()).map((key) => {
    // Recover original casing from source array when possible.
    const match = value.find(
      (item) =>
        typeof item === "string" &&
        item.trim().replace(/\s+/g, " ").toLowerCase() === key
    );
    return (match as string).trim().replace(/\s+/g, " ").slice(0, 120);
  });

  return questions.length > 0
    ? questions
    : [...DEFAULT_SCOUTING_ABILITY_QUESTIONS];
}

export function getDefaultScoutingAbilityQuestions(): string[] {
  return [...DEFAULT_SCOUTING_ABILITY_QUESTIONS];
}

export function getDefaultTeamAiPromptLimits(): TeamAiPromptLimits {
  return { ...TEAM_AI_LIMITS };
}

function normalizeAiPromptLimit(
  value: unknown,
  fallback: number
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_AI_PROMPT_LIMIT, Math.min(MAX_AI_PROMPT_LIMIT, parsed));
}

export function normalizeTeamAiPromptLimits(
  value: unknown
): TeamAiPromptLimits {
  const defaults = getDefaultTeamAiPromptLimits();
  if (!value || typeof value !== "object") return defaults;

  const obj = value as Record<string, unknown>;
  return {
    free: normalizeAiPromptLimit(obj.free, defaults.free),
    supporter: normalizeAiPromptLimit(obj.supporter, defaults.supporter),
  };
}

type PlatformQuestionSettings = {
  questions: string[];
  aiPromptLimits: TeamAiPromptLimits;
  formConfig: ScoutingFormConfig;
};

function parseQuestionSettingsPayload(value: unknown): PlatformQuestionSettings {
  const defaults = {
    questions: getDefaultScoutingAbilityQuestions(),
    aiPromptLimits: getDefaultTeamAiPromptLimits(),
    formConfig: getDefaultScoutingFormConfig(),
  };

  if (!value) return defaults;

  if (Array.isArray(value)) {
    return {
      questions: normalizeScoutingAbilityQuestions(value),
      aiPromptLimits: defaults.aiPromptLimits,
      formConfig: defaults.formConfig,
    };
  }

  if (typeof value !== "object") return defaults;

  const obj = value as Record<string, unknown>;
  const questionSource =
    obj.questions ??
    obj.scoutingAbilityQuestions ??
    obj.scouting_ability_questions;
  const aiLimitSource = obj.aiPromptLimits ?? obj.ai_prompt_limits;
  const formConfigSource = obj.formConfig ?? obj.form_config;

  return {
    questions: normalizeScoutingAbilityQuestions(questionSource),
    aiPromptLimits: normalizeTeamAiPromptLimits(aiLimitSource),
    formConfig: normalizeScoutingFormConfig(formConfigSource),
  };
}

export function serializeQuestionSettingsPayload({
  questions,
  aiPromptLimits,
  formConfig,
}: {
  questions: string[];
  aiPromptLimits: TeamAiPromptLimits;
  formConfig?: ScoutingFormConfig;
}): Json {
  const normalized = formConfig
    ? normalizeScoutingFormConfig(formConfig)
    : getDefaultScoutingFormConfig();
  return {
    questions: normalizeScoutingAbilityQuestions(questions),
    aiPromptLimits: normalizeTeamAiPromptLimits(aiPromptLimits) as unknown as Json,
    formConfig: JSON.parse(JSON.stringify(normalized)) as Json,
  } as Json;
}

export async function getEventSyncMinYear(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const fallbackYear = getDefaultEventSyncMinYear();

  const { data, error } = await supabase
    .from("platform_settings")
    .select("event_sync_min_year")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data?.event_sync_min_year) {
    return fallbackYear;
  }

  return normalizeYear(data.event_sync_min_year);
}

export async function getScoutingAbilityQuestions(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  const fallback = getDefaultScoutingAbilityQuestions();

  const { data, error } = await supabase
    .from("platform_settings")
    .select("scouting_ability_questions")
    .eq("id", 1)
    .maybeSingle();

  if (error) return fallback;

  return parseQuestionSettingsPayload(data?.scouting_ability_questions)
    .questions;
}

export async function getTeamAiPromptLimits(
  supabase: SupabaseClient<Database>
): Promise<TeamAiPromptLimits> {
  const fallback = getDefaultTeamAiPromptLimits();

  const { data, error } = await supabase
    .from("platform_settings")
    .select("scouting_ability_questions")
    .eq("id", 1)
    .maybeSingle();

  if (error) return fallback;

  return parseQuestionSettingsPayload(data?.scouting_ability_questions)
    .aiPromptLimits;
}

export function getTeamAiLimitFromSettings(
  limits: TeamAiPromptLimits,
  planTier: string | null | undefined
): number {
  const normalizedPlan = normalizePlanTier(planTier);
  return limits[normalizedPlan];
}

export async function getScoutingFormConfig(
  supabase: SupabaseClient<Database>
): Promise<ScoutingFormConfig> {
  const fallback = getDefaultScoutingFormConfig();

  const { data, error } = await supabase
    .from("platform_settings")
    .select("scouting_ability_questions")
    .eq("id", 1)
    .maybeSingle();

  if (error) return fallback;

  return parseQuestionSettingsPayload(data?.scouting_ability_questions)
    .formConfig;
}
