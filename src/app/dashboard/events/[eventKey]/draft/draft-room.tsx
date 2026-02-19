"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PickListContent } from "@/types/strategy";
import { GeneratePickListButton } from "../picklist/generate-button";
import type { ScoutingFormConfig } from "@/lib/platform-settings";
import { ChatSidebarTrigger } from "@/components/chat-sidebar";
import { AnimatePresence, motion } from "framer-motion";
import { z } from "zod";

type RankingEntry = { rank: number; teamNumber: number };

type DraftSettings = {
  rounds: number;
  numAlliances: number;
};

type DraftAlliance = {
  seed: number;
  slots: Array<number | null>;
};

type DraftHistoryEntry = {
  teamNumber: number;
  allianceIndex: number;
  slotIndex: number;
  timestamp: string;
};

type DraftState = {
  version: 1;
  revision: number;
  settings: DraftSettings;
  alliances: DraftAlliance[];
  pool: number[];
  declined: number[];
  currentPickIndex: number;
  history: DraftHistoryEntry[];
};

type DraftSessionRow = {
  id: string;
  state: unknown;
};

const DraftStateSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(1).default(1),
  settings: z.object({
    rounds: z.number().int().min(1).max(5),
    numAlliances: z.number().int().min(1).max(16),
  }),
  alliances: z.array(
    z.object({
      seed: z.number().int().min(1),
      slots: z.array(z.number().int().positive().nullable()),
    })
  ),
  pool: z.array(z.number().int().positive()),
  declined: z.array(z.number().int().positive()),
  currentPickIndex: z.number().int().min(0),
  history: z.array(
    z.object({
      teamNumber: z.number().int().positive(),
      allianceIndex: z.number().int().min(0),
      slotIndex: z.number().int().min(0),
      timestamp: z.string(),
    })
  ),
});

const DEFAULT_SETTINGS: DraftSettings = {
  rounds: 2,
  numAlliances: 8,
};

function buildPickOrder(numAlliances: number, rounds: number): number[] {
  const order: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    if (round % 2 === 1) {
      for (let i = 0; i < numAlliances; i++) order.push(i);
    } else {
      for (let i = numAlliances - 1; i >= 0; i--) order.push(i);
    }
  }
  return order;
}

function ordinal(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}

function buildInitialState(
  rankings: RankingEntry[],
  extraTeams: number[],
  settings: DraftSettings
): DraftState {
  const alliances: DraftAlliance[] = Array.from(
    { length: settings.numAlliances },
    (_, index) => ({
      seed: index + 1,
      slots: Array(settings.rounds + 1).fill(null),
    })
  );

  const seeded = rankings.slice(0, settings.numAlliances);
  seeded.forEach((entry, index) => {
    alliances[index].slots[0] = entry.teamNumber;
  });

  const pool: number[] = rankings
    .slice(settings.numAlliances)
    .map((entry) => entry.teamNumber);

  const allSeeded = new Set<number>(seeded.map((entry) => entry.teamNumber));
  const allPool = new Set<number>(pool);
  for (const team of extraTeams) {
    if (!allSeeded.has(team) && !allPool.has(team)) {
      pool.push(team);
      allPool.add(team);
    }
  }

  return {
    version: 1,
    revision: 1,
    settings,
    alliances,
    pool,
    declined: [],
    currentPickIndex: 0,
    history: [],
  };
}

function coerceDraftState(
  input: unknown,
  fallback: DraftState
): DraftState {
  const parsed = DraftStateSchema.safeParse(input);
  if (!parsed.success) return fallback;
  return parsed.data;
}

function removeFromArray(arr: number[], teamNumber: number): number[] {
  return arr.filter((team) => team !== teamNumber);
}

function uniqueSortedPool(
  pool: number[],
  rankMap: Map<number, number>
): number[] {
  const unique = Array.from(new Set(pool));
  return unique.sort((a, b) => {
    const rankA = rankMap.get(a);
    const rankB = rankMap.get(b);
    if (rankA && rankB) return rankA - rankB;
    if (rankA) return -1;
    if (rankB) return 1;
    return a - b;
  });
}

function promoteLowerSeedCaptains(
  alliances: DraftAlliance[],
  pool: number[],
  startAllianceIndex: number,
  rankMap: Map<number, number>
): { alliances: DraftAlliance[]; pool: number[] } {
  const nextAlliances = alliances.map((alliance) => ({
    ...alliance,
    slots: [...alliance.slots],
  }));
  let nextPool = [...pool];

  let index = startAllianceIndex;
  while (index < nextAlliances.length - 1) {
    if (nextAlliances[index].slots[0] !== null) break;
    nextAlliances[index].slots[0] = nextAlliances[index + 1].slots[0];
    nextAlliances[index + 1].slots[0] = null;
    index += 1;
  }

  const lastIndex = nextAlliances.length - 1;
  if (lastIndex >= 0 && nextAlliances[lastIndex].slots[0] === null) {
    const sortedPool = uniqueSortedPool(nextPool, rankMap);
    const nextCaptain = sortedPool[0] ?? null;
    if (nextCaptain !== null) {
      nextAlliances[lastIndex].slots[0] = nextCaptain;
      nextPool = removeFromArray(sortedPool, nextCaptain);
    } else {
      nextPool = sortedPool;
    }
  }

  return { alliances: nextAlliances, pool: nextPool };
}

type DragPayload =
  | { teamNumber: number; from: "pool" }
  | { teamNumber: number; from: "declined" }
  | { teamNumber: number; from: "slot"; allianceIndex: number; slotIndex: number };

function serializeDrag(payload: DragPayload): string {
  return JSON.stringify(payload);
}

function parseDrag(data: string | null): DragPayload | null {
  if (!data) return null;
  try {
    return JSON.parse(data) as DragPayload;
  } catch {
    return null;
  }
}

function setTeamDragPreview(event: DragEvent<HTMLElement>) {
  const source = event.currentTarget;
  if (!source || !event.dataTransfer) return;

  const rect = source.getBoundingClientRect();
  const preview = source.cloneNode(true) as HTMLElement;
  preview.style.position = "fixed";
  preview.style.top = "-10000px";
  preview.style.left = "-10000px";
  preview.style.width = `${rect.width}px`;
  preview.style.maxWidth = `${rect.width}px`;
  preview.style.pointerEvents = "none";
  preview.style.margin = "0";
  preview.style.transform = "none";
  preview.style.zIndex = "99999";

  document.body.appendChild(preview);

  const offsetX = Math.max(8, Math.min(rect.width - 8, event.clientX - rect.left));
  const offsetY = Math.max(8, Math.min(rect.height - 8, event.clientY - rect.top));
  event.dataTransfer.setDragImage(preview, offsetX, offsetY);

  requestAnimationFrame(() => {
    preview.remove();
  });
}

export function DraftRoom({
  eventId,
  eventKey,
  eventName,
  userName,
  orgId,
  rankings,
  teamNames,
  pickList,
  existingSession,
  storageEnabled,
  formConfig,
}: {
  eventId: string;
  eventKey: string;
  eventName: string;
  userName: string | null;
  orgId: string;
  rankings: RankingEntry[];
  teamNames: Record<number, string>;
  pickList: PickListContent | null;
  existingSession: DraftSessionRow | null;
  storageEnabled: boolean;
  formConfig?: ScoutingFormConfig;
}) {
  const supabase = useMemo(() => createClient(), []);
  const rankMap = useMemo(() => {
    return new Map(rankings.map((entry) => [entry.teamNumber, entry.rank]));
  }, [rankings]);

  const extraTeams = useMemo(
    () =>
      Object.keys(teamNames)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => !Number.isNaN(value)),
    [teamNames]
  );

  const initialState = useMemo(
    () => buildInitialState(rankings, extraTeams, DEFAULT_SETTINGS),
    [rankings, extraTeams]
  );

  const [sessionId, setSessionId] = useState<string | null>(
    existingSession?.id ?? null
  );
  const [state, setState] = useState<DraftState>(() =>
    existingSession?.state
      ? coerceDraftState(existingSession.state, initialState)
      : initialState
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [poolSearch, setPoolSearch] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [strictDeclines, setStrictDeclines] = useState(true);
  const [newTeamInput, setNewTeamInput] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<DragPayload | null>(null);
  const [poolDragOver, setPoolDragOver] = useState(false);
  const [declinedDragOver, setDeclinedDragOver] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const stateRef = useRef(state);
  const poolDragDepthRef = useRef(0);
  const declinedDragDepthRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const saveState = useCallback(
    (next: DraftState) => {
      if (!storageEnabled) return;
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        setSaving(true);
        setSaveError(null);
        try {
          if (!sessionId) {
            const { data, error } = await supabase
              .from("draft_sessions")
              .upsert(
                {
                  event_id: eventId,
                  org_id: orgId,
                  state: next,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "event_id,org_id" }
              )
              .select("id, state")
              .single();
            if (error) throw error;
            if (data?.id) setSessionId(data.id);
          } else {
            const { error } = await supabase
              .from("draft_sessions")
              .update({ state: next, updated_at: new Date().toISOString() })
              .eq("id", sessionId);
            if (error) throw error;
          }
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : "Failed to save");
        } finally {
          setSaving(false);
        }
      });
    },
    [eventId, orgId, sessionId, storageEnabled, supabase]
  );

  useEffect(() => {
    if (!storageEnabled) return;
    if (sessionId) return;
    if (existingSession) return;
    saveState(state);
  }, [sessionId, existingSession, state, storageEnabled, saveState]);

  useEffect(() => {
    if (!storageEnabled) return;
    if (!sessionId) return;
    const channel = supabase
      .channel(`draft_sessions:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "draft_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const nextState = coerceDraftState(payload.new.state, initialState);
          if (nextState.revision >= stateRef.current.revision) {
            setState(nextState);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, storageEnabled, supabase, initialState]);

  const pickOrder = useMemo(
    () =>
      buildPickOrder(state.settings.numAlliances, state.settings.rounds),
    [state.settings]
  );
  const totalPicks = pickOrder.length;
  const currentPickIndex = Math.min(state.currentPickIndex, totalPicks);
  const currentAllianceIndex =
    currentPickIndex < totalPicks ? pickOrder[currentPickIndex] : null;
  const currentRound =
    currentPickIndex < totalPicks
      ? Math.floor(currentPickIndex / state.settings.numAlliances) + 1
      : null;
  const draftComplete = currentAllianceIndex === null;
  const progressPercent = totalPicks > 0 ? Math.round((currentPickIndex / totalPicks) * 100) : 0;
  const upcomingPicks = useMemo(() => {
    if (draftComplete) return [];
    const take = Math.min(10, totalPicks - currentPickIndex);
    return Array.from({ length: take }, (_, offset) => {
      const pickIndex = currentPickIndex + offset;
      const allianceIndex = pickOrder[pickIndex];
      const round =
        Math.floor(pickIndex / state.settings.numAlliances) + 1;
      return {
        pickIndex,
        allianceIndex,
        round,
      };
    });
  }, [
    draftComplete,
    totalPicks,
    currentPickIndex,
    pickOrder,
    state.settings.numAlliances,
  ]);

  const draftedTeams = useMemo(() => {
    const set = new Set<number>();
    for (const alliance of state.alliances) {
      for (const slot of alliance.slots) {
        if (slot) set.add(slot);
      }
    }
    return set;
  }, [state.alliances]);

  const availablePool = useMemo(() => {
    const filtered = state.pool.filter((team) => {
      if (!poolSearch.trim()) return true;
      const query = poolSearch.trim().toLowerCase();
      return (
        team.toString().includes(query) ||
        (teamNames[team] ?? "").toLowerCase().includes(query)
      );
    });
    return uniqueSortedPool(filtered, rankMap);
  }, [state.pool, poolSearch, teamNames, rankMap]);

  const bestAvailable = useMemo(() => {
    if (!pickList) return [];
    const available = new Set(state.pool);
    return pickList.rankings
      .filter((team) => available.has(team.teamNumber))
      .slice(0, 10);
  }, [pickList, state.pool]);

  // Pick list lookup map for EPA/role badges on pool teams
  const pickListMap = useMemo(() => {
    if (!pickList) return new Map<number, PickListContent["rankings"][0]>();
    return new Map(pickList.rankings.map((t) => [t.teamNumber, t]));
  }, [pickList]);

  function updateState(next: DraftState) {
    const bumped = {
      ...next,
      revision: Math.max((stateRef.current.revision ?? 0) + 1, next.revision ?? 1),
    };
    setState(bumped);
    saveState(bumped);
  }

  function handlePoolDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    poolDragDepthRef.current += 1;
    if (!poolDragOver) setPoolDragOver(true);
  }

  function handlePoolDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!poolDragOver) setPoolDragOver(true);
  }

  function handlePoolDragLeave() {
    poolDragDepthRef.current = Math.max(0, poolDragDepthRef.current - 1);
    if (poolDragDepthRef.current === 0) setPoolDragOver(false);
  }

  function handlePoolDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    poolDragDepthRef.current = 0;
    setPoolDragOver(false);
    const data = parseDrag(event.dataTransfer.getData("application/json"));
    if (data) applyMoveTeamToPool(data);
  }

  function handleDeclinedDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    declinedDragDepthRef.current += 1;
    if (!declinedDragOver) setDeclinedDragOver(true);
  }

  function handleDeclinedDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!declinedDragOver) setDeclinedDragOver(true);
  }

  function handleDeclinedDragLeave() {
    declinedDragDepthRef.current = Math.max(0, declinedDragDepthRef.current - 1);
    if (declinedDragDepthRef.current === 0) setDeclinedDragOver(false);
  }

  function handleDeclinedDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    declinedDragDepthRef.current = 0;
    setDeclinedDragOver(false);
    const data = parseDrag(event.dataTransfer.getData("application/json"));
    if (data) applyMoveTeamToDeclined(data);
  }

  function resetDraft() {
    const resetState = buildInitialState(rankings, extraTeams, state.settings);
    updateState(resetState);
    setSelectedTeam(null);
  }

  function applyMoveTeamToPool(payload: DragPayload) {
    const next = { ...state };
    if (payload.from === "slot") {
      next.alliances = next.alliances.map((alliance, index) => {
        if (index !== payload.allianceIndex) return alliance;
        const slots = [...alliance.slots];
        slots[payload.slotIndex] = null;
        return { ...alliance, slots };
      });
      if (payload.slotIndex === 0) {
        const promoted = promoteLowerSeedCaptains(
          next.alliances,
          next.pool,
          payload.allianceIndex,
          rankMap
        );
        next.alliances = promoted.alliances;
        next.pool = promoted.pool;
      }
    } else if (payload.from === "declined") {
      next.declined = removeFromArray(next.declined, payload.teamNumber);
    }
    next.pool = uniqueSortedPool(
      [...next.pool, payload.teamNumber],
      rankMap
    );
    updateState(next);
    setSelectedTeam(null);
  }

  function applyMoveTeamToDeclined(payload: DragPayload) {
    const next = { ...state };
    if (payload.from === "slot") {
      next.alliances = next.alliances.map((alliance, index) => {
        if (index !== payload.allianceIndex) return alliance;
        const slots = [...alliance.slots];
        slots[payload.slotIndex] = null;
        return { ...alliance, slots };
      });
      if (payload.slotIndex === 0) {
        const promoted = promoteLowerSeedCaptains(
          next.alliances,
          next.pool,
          payload.allianceIndex,
          rankMap
        );
        next.alliances = promoted.alliances;
        next.pool = promoted.pool;
      }
    } else if (payload.from === "pool") {
      next.pool = removeFromArray(next.pool, payload.teamNumber);
    }
    next.declined = uniqueSortedPool(
      [...next.declined, payload.teamNumber],
      rankMap
    );
    updateState(next);
    setSelectedTeam(null);
  }

  function applyMoveTeamToSlot(
    payload: DragPayload,
    allianceIndex: number,
    slotIndex: number
  ) {
    if (strictDeclines && payload.from === "declined") {
      setSaveError("Strict mode blocks drafting declined teams.");
      return;
    }
    const next = { ...state };
    const targetAlliance = next.alliances[allianceIndex];
    if (!targetAlliance) return;

    const currentTeam = targetAlliance.slots[slotIndex] ?? null;
    const movingCaptainToPickSlot =
      payload.from === "slot" &&
      payload.slotIndex === 0 &&
      slotIndex > 0 &&
      (payload.allianceIndex !== allianceIndex || payload.slotIndex !== slotIndex);

    if (payload.from === "slot") {
      next.alliances = next.alliances.map((alliance, index) => {
        if (index === payload.allianceIndex) {
          const slots = [...alliance.slots];
          slots[payload.slotIndex] = null;
          return { ...alliance, slots };
        }
        return alliance;
      });
    } else if (payload.from === "pool") {
      next.pool = removeFromArray(next.pool, payload.teamNumber);
    } else if (payload.from === "declined") {
      next.declined = removeFromArray(next.declined, payload.teamNumber);
    }

    if (currentTeam) {
      if (payload.from === "slot" && !movingCaptainToPickSlot) {
        next.alliances = next.alliances.map((alliance, index) => {
          if (index === payload.allianceIndex) {
            const slots = [...alliance.slots];
            slots[payload.slotIndex] = currentTeam;
            return { ...alliance, slots };
          }
          return alliance;
        });
      } else {
        next.pool = uniqueSortedPool([...next.pool, currentTeam], rankMap);
      }
    }

    next.alliances = next.alliances.map((alliance, index) => {
      if (index !== allianceIndex) return alliance;
      const slots = [...alliance.slots];
      slots[slotIndex] = payload.teamNumber;
      return { ...alliance, slots };
    });

    if (movingCaptainToPickSlot && payload.from === "slot") {
      const promoted = promoteLowerSeedCaptains(
        next.alliances,
        next.pool,
        payload.allianceIndex,
        rankMap
      );
      next.alliances = promoted.alliances;
      next.pool = promoted.pool;
    }

    const shouldLogPick = slotIndex > 0 && payload.teamNumber !== currentTeam;
    if (shouldLogPick) {
      next.history = [
        ...next.history,
        {
          teamNumber: payload.teamNumber,
          allianceIndex,
          slotIndex,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    const isCurrentPickSlot =
      currentAllianceIndex === allianceIndex &&
      currentRound !== null &&
      currentRound === slotIndex;

    if (autoAdvance && isCurrentPickSlot) {
      next.currentPickIndex = Math.min(
        next.currentPickIndex + 1,
        totalPicks
      );
    }

    updateState(next);
    setSelectedTeam(null);
  }

  function advancePick() {
    if (currentPickIndex >= totalPicks) return;
    const next = {
      ...state,
      currentPickIndex: Math.min(state.currentPickIndex + 1, totalPicks),
    };
    updateState(next);
  }

  function undoPick() {
    const last = state.history[state.history.length - 1];
    if (!last) return;
    const next = { ...state };
    next.history = next.history.slice(0, -1);
    next.alliances = next.alliances.map((alliance, index) => {
      if (index !== last.allianceIndex) return alliance;
      const slots = [...alliance.slots];
      slots[last.slotIndex] = null;
      return { ...alliance, slots };
    });
    next.pool = uniqueSortedPool([...next.pool, last.teamNumber], rankMap);
    next.currentPickIndex = Math.max(next.currentPickIndex - 1, 0);
    updateState(next);
  }

  function updateRounds(rounds: number) {
    const next: DraftState = {
      ...state,
      settings: { ...state.settings, rounds },
    };

    const targetSlots = rounds + 1;
    const removedTeams: number[] = [];

    next.alliances = next.alliances.map((alliance) => {
      if (alliance.slots.length === targetSlots) return alliance;
      if (alliance.slots.length < targetSlots) {
        return {
          ...alliance,
          slots: [...alliance.slots, ...Array(targetSlots - alliance.slots.length).fill(null)],
        };
      }
      const trimmed = alliance.slots.slice(0, targetSlots);
      alliance.slots.slice(targetSlots).forEach((team) => {
        if (team) removedTeams.push(team);
      });
      return { ...alliance, slots: trimmed };
    });

    if (removedTeams.length > 0) {
      next.pool = uniqueSortedPool([...next.pool, ...removedTeams], rankMap);
    }

    next.history = next.history.filter((entry) => entry.slotIndex <= rounds);

    const maxPickIndex = buildPickOrder(
      next.settings.numAlliances,
      next.settings.rounds
    ).length;
    next.currentPickIndex = Math.min(next.currentPickIndex, maxPickIndex);
    updateState(next);
  }

  function addTeamToPool() {
    const trimmed = newTeamInput.trim();
    if (!trimmed) return;
    const teamNumber = Number.parseInt(trimmed, 10);
    if (Number.isNaN(teamNumber)) return;
    if (draftedTeams.has(teamNumber)) return;
    const next = {
      ...state,
      pool: uniqueSortedPool([...state.pool, teamNumber], rankMap),
      declined: removeFromArray(state.declined, teamNumber),
    };
    setNewTeamInput("");
    updateState(next);
  }

  function handleTeamTap(payload: DragPayload) {
    if (selectedTeam && selectedTeam.teamNumber === payload.teamNumber) {
      setSelectedTeam(null);
    } else {
      setSelectedTeam(payload);
    }
  }

  function handleSlotTap(allianceIndex: number, slotIndex: number) {
    if (!selectedTeam) return;
    applyMoveTeamToSlot(selectedTeam, allianceIndex, slotIndex);
  }

  function draftTeamToCurrentPick(teamNumber: number) {
    if (draftComplete || currentAllianceIndex === null || currentRound === null) {
      return;
    }
    if (!state.pool.includes(teamNumber)) {
      setSaveError(`Team ${teamNumber} is no longer in the available pool.`);
      return;
    }
    applyMoveTeamToSlot(
      { teamNumber, from: "pool" },
      currentAllianceIndex,
      currentRound
    );
  }

  const filledSlots = state.alliances.reduce(
    (count, a) => count + a.slots.filter((s, i) => i > 0 && s !== null).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Draft status bar */}
      <div className="rounded-2xl dashboard-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {/* On the clock */}
            {draftComplete ? (
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-green-300">Draft Complete</p>
                  <p className="text-xs text-gray-400">{filledSlots} picks made</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                    <circle
                      cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className="text-blue-400"
                      strokeDasharray={`${progressPercent} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-xs font-bold text-white">{currentAllianceIndex !== null ? currentAllianceIndex + 1 : ""}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">
                    Alliance <span className="font-semibold text-white">{currentAllianceIndex !== null ? currentAllianceIndex + 1 : ""}</span>
                    {" "}up next — Round <span className="font-semibold text-white">{currentRound}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Pick {currentPickIndex + 1} of {totalPicks} — {state.pool.length} teams remaining
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={undoPick}
              disabled={state.history.length === 0}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Undo
            </button>
            <button
              onClick={advancePick}
              disabled={draftComplete}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Skip
            </button>
            <button
              onClick={resetDraft}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Settings row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/5 pt-3 text-xs text-gray-400">
          <label className="flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="rounded border-white/20 bg-white/5"
            />
            Auto-advance
          </label>
          <label className="flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={strictDeclines}
              onChange={(e) => setStrictDeclines(e.target.checked)}
              className="rounded border-white/20 bg-white/5"
            />
            Strict declines
          </label>
          <label className="flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={state.settings.rounds === 3}
              onChange={(e) => updateRounds(e.target.checked ? 3 : 2)}
              className="rounded border-white/20 bg-white/5"
            />
            3-round draft
          </label>
          {!storageEnabled && (
            <span className="text-teal-300">Local-only mode</span>
          )}
          {saving && (
            <span className="flex items-center gap-1 text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              Saving
            </span>
          )}
          {saveError && <span className="text-red-300">{saveError}</span>}
        </div>

        {upcomingPicks.length > 0 && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              Upcoming Snake Order
            </p>
            <div className="flex flex-wrap gap-1.5">
              {upcomingPicks.map((pick, index) => (
                <span
                  key={pick.pickIndex}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                    index === 0
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                      : "border-white/10 bg-white/5 text-gray-300"
                  }`}
                >
                  A{pick.allianceIndex + 1}
                  <span className="text-gray-500">R{pick.round}</span>
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        {/* Left: AI guidance */}
        <section className="space-y-4">
          <div className="rounded-2xl dashboard-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/20">
                    <svg className="h-3.5 w-3.5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  </span>
                  <h2 className="text-sm font-semibold text-white">Best Available</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ChatSidebarTrigger eventKey={eventKey} eventName={eventName} userName={userName} />
                {pickList && (
                  <GeneratePickListButton
                    eventId={eventId}
                    label="Regenerate"
                    showDataHint={false}
                    requireTeamProfile
                    formConfig={formConfig}
                    compact
                  />
                )}
                <span className="text-xs text-gray-500">{bestAvailable.length} teams</span>
              </div>
            </div>

            {!pickList && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
                <p className="text-sm text-gray-400 mb-3">
                  Generate a pick list to see AI recommendations here.
                </p>
                <GeneratePickListButton
                  eventId={eventId}
                  label="Generate Pick List"
                  requireTeamProfile
                  formConfig={formConfig}
                />
              </div>
            )}

            {pickList && bestAvailable.length === 0 && (
              <div className="rounded-xl bg-white/5 p-4 text-center">
                <p className="text-sm text-gray-400">
                  All recommended teams have been drafted or declined.
                </p>
              </div>
            )}

            {pickList && bestAvailable.length > 0 && (
              <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                {bestAvailable.map((team, i) => (
                  <div
                    key={team.teamNumber}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "application/json",
                        serializeDrag({ teamNumber: team.teamNumber, from: "pool" })
                      );
                      event.dataTransfer.effectAllowed = "move";
                      setTeamDragPreview(event);
                    }}
                    onClick={() => handleTeamTap({ teamNumber: team.teamNumber, from: "pool" })}
                    className={`group cursor-pointer rounded-xl border p-3 transition ${
                      selectedTeam?.teamNumber === team.teamNumber
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 tabular-nums w-5">
                            {i + 1}.
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {team.teamNumber}
                          </span>
                          {teamNames[team.teamNumber] && (
                            <span className="truncate text-xs text-gray-400">
                              {teamNames[team.teamNumber]}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-7">
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-gray-300 tabular-nums">
                            EPA {team.epa.total.toFixed(1)}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            team.role === "scorer"
                              ? "bg-green-500/15 text-green-300"
                              : team.role === "defender"
                              ? "bg-cyan-500/15 text-cyan-300"
                              : "bg-gray-500/15 text-gray-300"
                          }`}>
                            {team.role}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            team.synergy === "high"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : team.synergy === "medium"
                              ? "bg-yellow-500/15 text-yellow-300"
                              : "bg-white/5 text-gray-400"
                          }`}>
                            {team.synergy} synergy
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] text-gray-500">
                          #{rankMap.get(team.teamNumber) ?? "—"}
                        </span>
                        {!draftComplete && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              draftTeamToCurrentPick(team.teamNumber);
                            }}
                            className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-200 transition hover:bg-blue-500/20"
                          >
                            Pick Now
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 pl-7 text-xs leading-relaxed text-gray-400">
                      {team.pickReason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Pool */}
          <div
            onDragEnter={handlePoolDragEnter}
            onDragOver={handlePoolDragOver}
            onDragLeave={handlePoolDragLeave}
            onDrop={handlePoolDrop}
            className={`relative overflow-hidden rounded-2xl dashboard-panel p-4 transition ${
              poolDragOver ? "ring-1 ring-blue-500/40 bg-blue-500/5" : ""
            }`}
          >
            {poolDragOver && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-blue-300/10" />
            )}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Available Pool</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-400 tabular-nums">
                  {state.pool.length}
                </span>
              </div>

              <input
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="Search teams..."
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none"
              />

              <div className="flex items-center gap-2">
                <input
                  value={newTeamInput}
                  onChange={(e) => setNewTeamInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTeamToPool()}
                  placeholder="Add team #"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none"
                />
                <button
                  onClick={addTeamToPool}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
                >
                  Add
                </button>
              </div>

              <p className={`text-[11px] ${poolDragOver ? "text-blue-200" : "text-gray-500"}`}>
                Drop anywhere in this box to return teams to the pool.
              </p>

              <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
                {availablePool.map((team) => (
                  <PoolTeamChip
                    key={team}
                    teamNumber={team}
                    teamName={teamNames[team]}
                    rank={rankMap.get(team)}
                    epa={pickListMap.get(team)?.epa.total}
                    isSelected={selectedTeam?.teamNumber === team}
                    payload={{ teamNumber: team, from: "pool" }}
                    onTap={handleTeamTap}
                  />
                ))}
                {availablePool.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-500">
                    {poolSearch ? "No matches found." : "Pool is empty."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Draft history */}
          {state.history.length > 0 && (
            <div className="rounded-2xl dashboard-panel p-5 space-y-2">
              <h3 className="text-sm font-semibold text-white">Pick History</h3>
              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {[...state.history].reverse().map((entry, i) => (
                  <div key={state.history.length - 1 - i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-xs">
                    <span className="text-gray-300">
                      <span className="font-medium text-white">{entry.teamNumber}</span>
                      {teamNames[entry.teamNumber] && (
                        <span className="ml-1 text-gray-500">{teamNames[entry.teamNumber]}</span>
                      )}
                    </span>
                    <span className="text-gray-500">
                      A{entry.allianceIndex + 1} Pick {entry.slotIndex}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>

        {/* Right: Draft board */}
        <section className="space-y-4">
          {/* Alliance grid */}
          <div className="rounded-2xl dashboard-panel p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Alliance Board</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-2 pl-2 text-left font-medium text-gray-500 w-16">Seed</th>
                    <th className="pb-2 text-left font-medium text-gray-500">Captain</th>
                    {Array.from({ length: state.settings.rounds }, (_, i) => (
                      <th key={i} className="pb-2 text-left font-medium text-gray-500">
                        {ordinal(i + 1)} pick
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {state.alliances.map((alliance, allianceIndex) => {
                    const isOnClock = currentAllianceIndex === allianceIndex;
                    return (
                      <tr
                        key={alliance.seed}
                        className={isOnClock ? "bg-blue-500/5" : ""}
                      >
                        <td className="py-2 pl-2">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                            isOnClock
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-white/5 text-gray-500"
                          }`}>
                            {alliance.seed}
                          </span>
                        </td>
                        {alliance.slots.map((slotTeam, slotIndex) => {
                          const isPickSlot = isOnClock && currentRound === slotIndex && slotIndex > 0;
                          return (
                            <td key={slotIndex} className="py-2 pr-2">
                              <AllianceSlot
                                teamNumber={slotTeam}
                                teamName={slotTeam ? teamNames[slotTeam] : undefined}
                                rank={slotTeam ? rankMap.get(slotTeam) : undefined}
                                isCaptain={slotIndex === 0}
                                isOnClock={isPickSlot}
                                isSelected={slotTeam !== null && selectedTeam?.teamNumber === slotTeam}
                                payload={
                                  slotTeam
                                    ? { teamNumber: slotTeam, from: "slot" as const, allianceIndex, slotIndex }
                                    : null
                                }
                                onDrop={(payload) => applyMoveTeamToSlot(payload, allianceIndex, slotIndex)}
                              onTap={() => {
                                  if (selectedTeam) {
                                    handleSlotTap(allianceIndex, slotIndex);
                                  } else if (slotTeam) {
                                    handleTeamTap({ teamNumber: slotTeam, from: "slot", allianceIndex, slotIndex });
                                  }
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Declined */}
          <div
            onDragEnter={handleDeclinedDragEnter}
            onDragOver={handleDeclinedDragOver}
            onDragLeave={handleDeclinedDragLeave}
            onDrop={handleDeclinedDrop}
            className={`relative overflow-hidden rounded-2xl dashboard-panel p-4 transition ${
              declinedDragOver ? "ring-1 ring-red-500/40 bg-red-500/5" : ""
            }`}
          >
            {declinedDragOver && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-red-300/10" />
            )}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Declined</h3>
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300 tabular-nums">
                  {state.declined.length}
                </span>
              </div>

              <p className={`text-[11px] ${declinedDragOver ? "text-red-200" : "text-red-300/60"}`}>
                Drop anywhere in this box to decline a team.
              </p>

              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {state.declined.map((team) => (
                  <PoolTeamChip
                    key={team}
                    teamNumber={team}
                    teamName={teamNames[team]}
                    rank={rankMap.get(team)}
                    isSelected={selectedTeam?.teamNumber === team}
                    payload={{ teamNumber: team, from: "declined" }}
                    onTap={handleTeamTap}
                    declined
                  />
                ))}
                {state.declined.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-500">
                    No declined teams.
                  </p>
                )}
              </div>
            </div>
          </div>

        </section>
      </div>

      <AnimatePresence>
        {selectedTeam && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg bg-gradient-to-r from-sky-500 to-blue-400 px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-white/85" />
                <p className="text-sm">
                  <span className="font-semibold">Team {selectedTeam.teamNumber}</span> selected — tap a slot to place, or tap the team again to deselect
                </p>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="text-xs opacity-80 hover:opacity-100"
                aria-label="Close selected team popup"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => applyMoveTeamToDeclined(selectedTeam)}
                className="rounded bg-white/20 px-2 py-0.5 text-xs text-white hover:bg-white/30"
              >
                Decline
              </button>
              {selectedTeam.from !== "pool" && (
                <button
                  onClick={() => applyMoveTeamToPool(selectedTeam)}
                  className="rounded bg-white/20 px-2 py-0.5 text-xs text-white hover:bg-white/30"
                >
                  Return to pool
                </button>
              )}
              <button
                onClick={() => setSelectedTeam(null)}
                className="rounded bg-white/20 px-2 py-0.5 text-xs text-white hover:bg-white/30"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PoolTeamChip({
  teamNumber,
  teamName,
  rank,
  epa,
  payload,
  isSelected,
  onTap,
  declined,
}: {
  teamNumber: number;
  teamName?: string;
  rank?: number;
  epa?: number;
  payload: DragPayload;
  isSelected: boolean;
  onTap: (payload: DragPayload) => void;
  declined?: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(
          "application/json",
          serializeDrag(payload)
        );
        event.dataTransfer.effectAllowed = "move";
        setTeamDragPreview(event);
      }}
      onClick={() => onTap(payload)}
      className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition ${
        isSelected
          ? "border-blue-500/50 bg-blue-500/10"
          : declined
          ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-semibold tabular-nums ${declined ? "text-red-300/70" : "text-white"}`}>
          {teamNumber}
        </span>
        {teamName && (
          <span className="truncate text-gray-500 max-w-[120px]">{teamName}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {epa !== undefined && (
          <span className="tabular-nums text-[10px] text-gray-500">{epa.toFixed(1)}</span>
        )}
        <span className="tabular-nums text-[10px] text-gray-500">
          #{rank ?? "—"}
        </span>
      </div>
    </div>
  );
}

function AllianceSlot({
  teamNumber,
  teamName,
  rank,
  isCaptain,
  isOnClock,
  isSelected,
  payload,
  onDrop,
  onTap,
}: {
  teamNumber: number | null;
  teamName?: string;
  rank?: number;
  isCaptain: boolean;
  isOnClock: boolean;
  isSelected: boolean;
  payload: DragPayload | null;
  onDrop: (payload: DragPayload) => void;
  onTap: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        if (!dragOver) setDragOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setDragOver(false);
        const data = parseDrag(event.dataTransfer.getData("application/json"));
        if (data) onDrop(data);
      }}
      draggable={Boolean(payload)}
      onDragStart={(event) => {
        if (!payload) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("application/json", serializeDrag(payload));
        event.dataTransfer.effectAllowed = "move";
        setTeamDragPreview(event);
      }}
      onClick={onTap}
      className={`relative overflow-hidden min-w-[110px] rounded-lg border px-2 py-1.5 text-xs transition ${
        dragOver
          ? "border-blue-400/70 bg-blue-500/15 ring-1 ring-blue-500/30"
          : isOnClock
          ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30"
          : isSelected
          ? "border-blue-500/40 bg-blue-500/10"
          : teamNumber
          ? "border-white/10 bg-white/[0.03]"
          : "border-dashed border-white/10 bg-transparent"
      } ${teamNumber && payload ? "cursor-grab active:cursor-grabbing" : !teamNumber && !isCaptain ? "cursor-pointer" : ""}`}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-blue-300/10" />
      )}
      {teamNumber ? (
        <div
          className="relative z-10 flex items-center gap-1.5"
        >
          <span className="font-semibold text-white tabular-nums">{teamNumber}</span>
          {teamName && (
            <span className="truncate text-gray-500 max-w-[80px]">{teamName}</span>
          )}
          {rank && (
            <span className="ml-auto text-[10px] text-gray-600 tabular-nums">#{rank}</span>
          )}
        </div>
      ) : (
        <span className={`relative z-10 text-[10px] ${isOnClock ? "text-blue-400" : "text-gray-600"}`}>
          {isOnClock ? "Up next" : "—"}
        </span>
      )}
    </div>
  );
}
