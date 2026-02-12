"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { removeOrgEvent } from "@/lib/org-event-actions";

interface OrgEvent {
  id: string;
  is_attending: boolean;
  events: {
    id: string;
    tba_key: string;
    name: string;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    year: number | null;
  } | null;
}

interface SortableEventsProps {
  orgEvents: OrgEvent[];
  isCaptain: boolean;
}

const STORAGE_KEY = "scoutai-events-order";

/** Minimum distance (px) the pointer must travel before a drag starts. */
const DRAG_THRESHOLD = 8;

function formatEventTitle(event: {
  name: string;
  year?: number | null;
  start_date?: string | null;
  tba_key?: string | null;
}) {
  const year =
    event.year ??
    (event.start_date
      ? event.start_date.slice(0, 4)
      : event.tba_key?.slice(0, 4));
  return year ? `${year} ${event.name}` : event.name;
}

function formatDate(date: string | null) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitialOrder(orgEvents: OrgEvent[]): OrgEvent[] {
  if (typeof window === "undefined") return orgEvents;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const savedOrder: string[] = JSON.parse(saved);
      return [...orgEvents].sort((a, b) => {
        const aIndex = savedOrder.indexOf(a.id);
        const bIndex = savedOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
  } catch {
    // localStorage may not be available
  }
  return orgEvents;
}

export function SortableEvents({
  orgEvents,
  isCaptain,
}: SortableEventsProps) {
  const router = useRouter();
  const [orderedEvents, setOrderedEvents] = useState<OrgEvent[]>(() =>
    getInitialOrder(orgEvents)
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Arrow-move animation state: { id, direction }
  const [arrowAnim, setArrowAnim] = useState<{
    id: string;
    swapId: string;
    direction: "up" | "down";
  } | null>(null);

  // Pointer-based drag state
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const isDragging = useRef(false);
  const draggedIdRef = useRef<string | null>(null);
  const draggedCardSizeRef = useRef({ width: 0, height: 0 });

  // Pending drag state — used for distance threshold
  const pendingDrag = useRef<{
    id: string;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    setOrderedEvents(getInitialOrder(orgEvents));
  }, [orgEvents]);

  function saveOrder(events: OrgEvent[]) {
    try {
      const order = events.map((e) => e.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch {
      // localStorage may not be available
    }
  }

  function commitOrder(nextEvents: OrgEvent[]) {
    setOrderedEvents(nextEvents);
    saveOrder(nextEvents);
  }

  function moveBy(id: string, delta: -1 | 1) {
    const index = orderedEvents.findIndex((event) => event.id === id);
    const nextIndex = index + delta;
    if (
      index === -1 ||
      nextIndex < 0 ||
      nextIndex >= orderedEvents.length
    )
      return;

    const swapId = orderedEvents[nextIndex].id;

    // Trigger the animation
    setArrowAnim({
      id,
      swapId,
      direction: delta === -1 ? "up" : "down",
    });

    // Apply the reorder after a short delay so the animation plays
    setTimeout(() => {
      const next = [...orderedEvents];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      commitOrder(next);
      // Clear animation after the swap completes
      setTimeout(() => setArrowAnim(null), 50);
    }, 280);
  }

  // --- Pointer-based drag system ---

  const updateGhostPosition = useCallback(
    (clientX: number, clientY: number) => {
      const ghost = ghostRef.current;
      if (!ghost) return;
      ghost.style.left = `${clientX - dragOffsetRef.current.x}px`;
      ghost.style.top = `${clientY - dragOffsetRef.current.y}px`;
    },
    []
  );

  const findDropIndex = useCallback(
    (clientY: number): number | null => {
      const currentDraggedId = draggedIdRef.current;
      if (!currentDraggedId) return null;

      const cards = orderedEvents
        .filter((e) => e.id !== currentDraggedId && e.events)
        .map((e) => {
          const el = cardRefsMap.current.get(e.id);
          return el ? { id: e.id, rect: el.getBoundingClientRect() } : null;
        })
        .filter(Boolean) as Array<{ id: string; rect: DOMRect }>;

      if (cards.length === 0) return 0;

      // Above everything → index 0
      if (clientY < cards[0].rect.top + cards[0].rect.height / 2) {
        // Find orderedEvents index of first visible card
        const firstId = cards[0].id;
        return orderedEvents.findIndex((e) => e.id === firstId);
      }

      // Find which gap the pointer falls into
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const midY = card.rect.top + card.rect.height / 2;
        if (clientY < midY) {
          return orderedEvents.findIndex((e) => e.id === card.id);
        }
      }

      // Below everything → after last
      const lastId = cards[cards.length - 1].id;
      const lastIdx = orderedEvents.findIndex((e) => e.id === lastId);
      return lastIdx + 1;
    },
    [orderedEvents]
  );

  const createGhost = useCallback(
    (cardEl: HTMLElement, startX: number, startY: number) => {
      const rect = cardEl.getBoundingClientRect();
      dragOffsetRef.current = {
        x: startX - rect.left,
        y: startY - rect.top,
      };
      draggedCardSizeRef.current = { width: rect.width, height: rect.height };

      const ghost = document.createElement("div");
      ghost.innerHTML = cardEl.outerHTML;
      const inner = ghost.firstElementChild as HTMLElement;
      if (inner) {
        inner.style.width = `${rect.width}px`;
        inner.style.transform = "rotate(1.5deg) scale(1.02)";
        inner.style.boxShadow =
          "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.3)";
        inner.style.opacity = "0.95";
        inner.style.pointerEvents = "none";
      }
      ghost.style.position = "fixed";
      ghost.style.zIndex = "10000";
      ghost.style.pointerEvents = "none";
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.transition = "none";
      document.body.appendChild(ghost);
      ghostRef.current = ghost;
    },
    []
  );

  const cleanupDrag = useCallback(() => {
    pendingDrag.current = null;
    isDragging.current = false;

    const ghost = ghostRef.current;
    ghost?.remove();
    ghostRef.current = null;

    setDraggedId(null);
    setDropIndex(null);
    draggedIdRef.current = null;

    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      // Check if we have a pending drag that hasn't crossed the threshold yet
      if (pendingDrag.current && !isDragging.current) {
        const dx = e.clientX - pendingDrag.current.startX;
        const dy = e.clientY - pendingDrag.current.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DRAG_THRESHOLD) return;

        // Crossed threshold — actually start the drag
        const { id, startX, startY } = pendingDrag.current;
        const cardEl = cardRefsMap.current.get(id);
        if (!cardEl) {
          pendingDrag.current = null;
          return;
        }

        createGhost(cardEl, startX, startY);

        isDragging.current = true;
        draggedIdRef.current = id;
        setDraggedId(id);
        setDropIndex(null);
        pendingDrag.current = null;

        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }

      if (!isDragging.current) return;
      e.preventDefault();
      updateGhostPosition(e.clientX, e.clientY);

      const idx = findDropIndex(e.clientY);
      setDropIndex(idx);
    },
    [updateGhostPosition, findDropIndex, createGhost]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      // If we never crossed the threshold, just clean up — it was a click
      if (pendingDrag.current) {
        pendingDrag.current = null;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
        return;
      }

      if (!isDragging.current) return;
      e.preventDefault();
      const sourceId = draggedIdRef.current;
      const targetIdx = findDropIndex(e.clientY);

      try {
        if (sourceId && targetIdx !== null) {
          setOrderedEvents((prev) => {
            const srcIdx = prev.findIndex((ev) => ev.id === sourceId);
            if (srcIdx === -1) return prev;
            const next = [...prev];
            const [moved] = next.splice(srcIdx, 1);
            // Adjust target index since we removed the source
            const adjustedIdx =
              targetIdx > srcIdx ? targetIdx - 1 : targetIdx;
            next.splice(adjustedIdx, 0, moved);
            saveOrder(next);
            return next;
          });
        }
      } finally {
        cleanupDrag();
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [findDropIndex, handlePointerMove, cleanupDrag]
  );

  const handlePointerCancel = useCallback(() => {
    cleanupDrag();
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("pointercancel", handlePointerCancel);
  }, [handlePointerMove, handlePointerUp, cleanupDrag]);

  function initiatePointerDrag(e: React.PointerEvent, id: string) {
    // Don't start drag from interactive elements (buttons, links, inputs)
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, form, [role='button']")) return;

    e.preventDefault();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    pendingDrag.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  }

  function startDragFromGrip(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    const cardEl = cardRefsMap.current.get(id);
    if (!cardEl) return;

    createGhost(cardEl, e.clientX, e.clientY);

    isDragging.current = true;
    draggedIdRef.current = id;
    setDraggedId(id);
    setDropIndex(null);

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  }

  useEffect(() => {
    const handleWindowBlur = () => handlePointerCancel();
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") handlePointerCancel();
    };
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      ghostRef.current?.remove();
      ghostRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [handlePointerMove, handlePointerUp, handlePointerCancel]);

  // Build the render list: cards + one placeholder at the drop position
  const renderItems: Array<
    { type: "card"; orgEvent: OrgEvent } | { type: "placeholder" }
  > = [];

  const draggedIndex =
    draggedId !== null
      ? orderedEvents.findIndex((e) => e.id === draggedId)
      : -1;

  // Create the list without the dragged card, then insert placeholder
  const withoutDragged = orderedEvents.filter((e) => e.id !== draggedId);

  if (draggedId && dropIndex !== null) {
    // Adjust drop index for the removed card
    const adjustedDrop =
      draggedIndex !== -1 && dropIndex > draggedIndex
        ? dropIndex - 1
        : dropIndex;
    const clamped = Math.max(0, Math.min(adjustedDrop, withoutDragged.length));

    for (let i = 0; i < withoutDragged.length; i++) {
      if (i === clamped) renderItems.push({ type: "placeholder" });
      renderItems.push({ type: "card", orgEvent: withoutDragged[i] });
    }
    if (clamped >= withoutDragged.length)
      renderItems.push({ type: "placeholder" });
  } else if (draggedId) {
    // Dragging but no valid drop target — show placeholder at original spot
    for (let i = 0; i < withoutDragged.length; i++) {
      // Insert placeholder at the original visual position
      if (i === draggedIndex) renderItems.push({ type: "placeholder" });
      renderItems.push({ type: "card", orgEvent: withoutDragged[i] });
    }
    if (draggedIndex >= withoutDragged.length)
      renderItems.push({ type: "placeholder" });
  } else {
    for (const orgEvent of orderedEvents) {
      renderItems.push({ type: "card", orgEvent });
    }
  }

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes card-pop-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          30% { transform: translateY(-8px) scale(1.02) rotate(-1deg); opacity: 0.9; }
          60% { transform: translateY(4px) scale(0.99); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes card-pop-down {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          30% { transform: translateY(8px) scale(1.02) rotate(1deg); opacity: 0.9; }
          60% { transform: translateY(-4px) scale(0.99); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes card-squish {
          0% { transform: scale(1, 1); }
          20% { transform: scale(1.03, 0.97); }
          40% { transform: scale(0.98, 1.02); }
          60% { transform: scale(1.01, 0.99); }
          100% { transform: scale(1, 1); }
        }
        .anim-pop-up { animation: card-pop-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .anim-pop-down { animation: card-pop-down 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .anim-squish { animation: card-squish 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
      <p className="text-xs text-gray-400">
        Drag cards to reorder. On touch devices, use the arrow controls.
      </p>
      <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {renderItems.map((item) => {
          if (item.type === "placeholder") {
            return (
              <div
                key="drop-placeholder"
                className="rounded-2xl border-2 border-dashed border-blue-400/40 bg-blue-500/5 transition-all duration-200"
                style={{
                  minHeight: `${draggedCardSizeRef.current.height || 140}px`,
                }}
              />
            );
          }

          const orgEvent = item.orgEvent;
          const event = orgEvent.events;
          if (!event) return null;
          const index = orderedEvents.findIndex((e) => e.id === orgEvent.id);

          // Arrow animation classes
          let animClass = "";
          if (arrowAnim) {
            if (arrowAnim.id === orgEvent.id) {
              animClass =
                arrowAnim.direction === "up" ? "anim-pop-up" : "anim-pop-down";
            } else if (arrowAnim.swapId === orgEvent.id) {
              animClass = "anim-squish";
            }
          }

          return (
            <div
              key={`card-${orgEvent.id}`}
              ref={(el) => {
                if (el) cardRefsMap.current.set(orgEvent.id, el);
                else cardRefsMap.current.delete(orgEvent.id);
              }}
              data-sort-card-id={orgEvent.id}
              onPointerDown={(e) => initiatePointerDrag(e, orgEvent.id)}
              className={`group relative rounded-2xl dashboard-panel dashboard-card p-5 cursor-grab active:cursor-grabbing touch-none ${animClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/dashboard/events/${event.tba_key}`}
                  className="flex-1 min-w-0"
                  draggable={false}
                >
                  <div className="flex items-center gap-2">
                    {orgEvent.is_attending ? (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-400"
                        title="Attending"
                      />
                    ) : (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-gray-500"
                        title="Not attending"
                      />
                    )}
                    <h4 className="truncate text-base font-semibold text-white">
                      {formatEventTitle(event)}
                    </h4>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {event.location}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDate(event.start_date)} &mdash;{" "}
                    {formatDate(event.end_date)}
                  </p>
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onPointerDown={(e) => startDragFromGrip(e, orgEvent.id)}
                    className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-gray-200 active:cursor-grabbing touch-none"
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
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
                    >
                      <circle cx="9" cy="5" r="1" />
                      <circle cx="9" cy="12" r="1" />
                      <circle cx="9" cy="19" r="1" />
                      <circle cx="15" cy="5" r="1" />
                      <circle cx="15" cy="12" r="1" />
                      <circle cx="15" cy="19" r="1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBy(orgEvent.id, -1)}
                    disabled={index === 0 || arrowAnim !== null}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Move event up"
                    title="Move up"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBy(orgEvent.id, 1)}
                    disabled={
                      index === orderedEvents.length - 1 ||
                      arrowAnim !== null
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Move event down"
                    title="Move down"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <form
                    action={async (formData: FormData) => {
                      await removeOrgEvent(formData);
                      router.refresh();
                    }}
                  >
                    <input
                      type="hidden"
                      name="orgEventId"
                      value={orgEvent.id}
                    />
                    <ConfirmButton
                      type="submit"
                      disabled={!isCaptain}
                      title="Remove event from dashboard?"
                      description="This only removes the event from your team's dashboard. It won't delete global event data."
                      confirmLabel="Remove event"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${
                        isCaptain
                          ? "border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200"
                          : "border-white/5 text-gray-600 cursor-not-allowed"
                      }`}
                      aria-label={
                        isCaptain
                          ? "Remove event"
                          : "Only captains can remove events"
                      }
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
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </ConfirmButton>
                  </form>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/dashboard/events/${event.tba_key}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-blue-300 dashboard-chip dashboard-chip-action"
                  draggable={false}
                >
                  Open event
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
                {!orgEvent.is_attending && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                    Not Attending
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
