"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

type RawMessage = {
  id: string;
  content: string;
  message_type: string;
  match_key: string | null;
  created_at: string;
  author_id: string;
  reply_to_id?: string | null;
  reply_to?: {
    id: string;
    content: string;
    author_id: string;
    created_at: string;
    profiles?:
      | { display_name: string; team_roles?: string[] | null }
      | { display_name: string; team_roles?: string[] | null }[]
      | null;
  } | null;
  profiles?:
    | { display_name: string; team_roles?: string[] | null }
    | { display_name: string; team_roles?: string[] | null }[]
    | null;
};

interface PulseClientProps {
  orgId: string;
  userId: string;
  displayName: string;
  teamRoles: string[];
  initialMessages: RawMessage[];
}

const MESSAGE_TYPES = [
  { value: "note", label: "Note" },
  { value: "strategy", label: "Strategy" },
  { value: "question", label: "Question" },
  { value: "alert", label: "Alert" },
] as const;

const TYPE_STYLES: Record<string, string> = {
  note: "border-white/10 bg-white/5",
  strategy: "border-blue-500/30 bg-blue-500/10",
  question: "border-amber-500/30 bg-amber-500/10",
  alert: "border-red-500/30 bg-red-500/10",
};

const ROLE_LABELS: Record<string, string> = {
  driver: "Driver",
  coach: "Coach",
  programmer: "Programmer",
  scout: "Scout",
  data: "Data / Analytics",
  mechanical: "Mechanical",
  electrical: "Electrical",
  cad: "CAD / Design",
  pit: "Pit Crew",
  mentor: "Mentor",
  other: "Other",
};

function buildOnlineList(
  state: Record<string, Array<{ userId: string; name: string; roles?: string[] }>>
) {
  const map = new Map<string, { id: string; name: string; roles: string[] }>();
  Object.values(state).forEach((entries) => {
    entries.forEach((entry) => {
      if (!entry.userId) return;
      map.set(entry.userId, {
        id: entry.userId,
        name: entry.name || "Teammate",
        roles: entry.roles ?? [],
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function extractMentions(text: string) {
  const matches = text.match(/@([a-z0-9_-]+)/gi) ?? [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

export function PulseClient({
  orgId,
  userId,
  displayName,
  teamRoles,
  initialMessages,
}: PulseClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const [messages, setMessages] = useState<RawMessage[]>(initialMessages);
  const [content, setContent] = useState("");
  const [matchKey, setMatchKey] = useState("");
  const [messageType, setMessageType] = useState<string>("note");
  const [filter, setFilter] = useState<string>("all");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<RawMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{ id: string; name: string; roles: string[] }>
  >([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const authorMapRef = useRef<Record<string, string>>({});
  const roleMapRef = useRef<Record<string, string[]>>({});
  const messageIdsRef = useRef(new Set<string>());
  const optimisticIdsRef = useRef(new Set<string>());
  const typingUsersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingThrottleRef = useRef(0);
  const tempCounterRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [notificationState, setNotificationState] = useState<
    "unsupported" | NotificationPermission
  >(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission;
  });

  const hydrateMessageRefs = useCallback(
    (list: RawMessage[]) => {
      const map: Record<string, string> = {};
      const roleMap: Record<string, string[]> = {};
      for (const message of list) {
        const profile = Array.isArray(message.profiles)
          ? message.profiles[0]
          : message.profiles;
        if (profile?.display_name) {
          map[message.author_id] = profile.display_name;
        }
        if (profile?.team_roles?.length) {
          roleMap[message.author_id] = profile.team_roles;
        }
      }
      if (displayName) {
        map[userId] = displayName;
      }
      if (teamRoles.length > 0) {
        roleMap[userId] = teamRoles;
      }
      authorMapRef.current = map;
      roleMapRef.current = roleMap;
      messageIdsRef.current = new Set(list.map((m) => m.id));
    },
    [displayName, teamRoles, userId]
  );

  const isMentioned = useCallback(
    (message: RawMessage) => {
      const mentions = extractMentions(message.content);
      if (mentions.length === 0) return false;
      if (mentions.includes("everyone") || mentions.includes("all")) return true;
      const aliases = new Set<string>();
      if (displayName) {
        aliases.add(displayName.toLowerCase());
        const first = displayName.split(/\s+/)[0];
        if (first) aliases.add(first.toLowerCase());
      }
      if (mentions.some((mention) => aliases.has(mention))) return true;
      if (teamRoles.length > 0) {
        const roleSet = new Set(teamRoles.map((role) => role.toLowerCase()));
        if (mentions.some((mention) => roleSet.has(mention))) return true;
      }
      return false;
    },
    [displayName, teamRoles]
  );

  useEffect(() => {
    hydrateMessageRefs(initialMessages);
  }, [hydrateMessageRefs, initialMessages]);

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      const { data, error: loadErr } = await supabase
        .from("team_messages")
        .select(
          "id, content, message_type, match_key, created_at, author_id, reply_to_id, profiles(display_name, team_roles)"
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!active) return;

      if (loadErr) {
        setLoadError(loadErr.message);
        return;
      }

      if (data) {
        let next = data as RawMessage[];
        const replyIds = Array.from(
          new Set(
            next
              .map((message) => message.reply_to_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        if (replyIds.length > 0) {
          const { data: replies } = await supabase
            .from("team_messages")
            .select(
              "id, content, author_id, created_at, profiles(display_name, team_roles)"
            )
            .in("id", replyIds);

          const replyMap = new Map(
            (replies ?? []).map((reply) => [reply.id, reply])
          );
          next = next.map((message) =>
            message.reply_to_id
              ? {
                  ...message,
                  reply_to: replyMap.get(message.reply_to_id) ?? null,
                }
              : message
          );
        }

        setMessages(next);
        hydrateMessageRefs(next);
        setLoadError(null);
      }
    };

    void loadMessages();
    return () => {
      active = false;
    };
  }, [orgId, supabase, hydrateMessageRefs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`team-messages-${orgId}`, {
        config: {
          presence: { key: userId },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<
          string,
          Array<{ userId: string; name: string; roles?: string[] }>
        >;
        const next = buildOnlineList(state);
        setOnlineUsers(next);
      })
      .on("presence", { event: "join" }, () => {
        const state = channel.presenceState() as Record<
          string,
          Array<{ userId: string; name: string; roles?: string[] }>
        >;
        const next = buildOnlineList(state);
        setOnlineUsers(next);
      })
      .on("presence", { event: "leave" }, () => {
        const state = channel.presenceState() as Record<
          string,
          Array<{ userId: string; name: string; roles?: string[] }>
        >;
        const next = buildOnlineList(state);
        setOnlineUsers(next);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `org_id=eq.${orgId}`,
        },
        async (payload) => {
          const next = payload.new as RawMessage;
          if (messageIdsRef.current.has(next.id)) return;

          if (!authorMapRef.current[next.author_id] || !roleMapRef.current[next.author_id]) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name, team_roles")
              .eq("id", next.author_id)
              .single();
            if (data?.display_name) {
              authorMapRef.current[next.author_id] = data.display_name;
            }
            if (data?.team_roles) {
              roleMapRef.current[next.author_id] = data.team_roles;
            }
          }

          if (next.reply_to_id) {
            const { data } = await supabase
              .from("team_messages")
              .select(
                "id, content, author_id, created_at, profiles(display_name, team_roles)"
              )
              .eq("id", next.reply_to_id)
              .single();
            if (data) {
              next.reply_to = data as RawMessage["reply_to"];
            }
          }

          const authorName =
            authorMapRef.current[next.author_id] ?? "Teammate";
          const mentioned = isMentioned(next);
          if (next.author_id !== userId) {
            const snippet =
              next.content.length > 80
                ? `${next.content.slice(0, 80)}…`
                : next.content;
            toast(
              mentioned
                ? `Mentioned you: ${authorName} — ${snippet}`
                : `${authorName}: ${snippet}`,
              "info"
            );
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted" &&
              document.visibilityState === "hidden"
            ) {
              new Notification(
                mentioned
                  ? `${authorName} mentioned you`
                  : `New ${next.message_type} update`,
                {
                  body: `${authorName}: ${snippet}`,
                }
              );
            }
          }

          setMessages((prev) => {
            if (prev.some((message) => message.id === next.id)) {
              return prev;
            }

            const tempIndex = prev.findIndex((message) => {
              if (!message.id.startsWith("temp-")) return false;
              if (message.author_id !== next.author_id) return false;
              if (message.content !== next.content) return false;
              const delta =
                Math.abs(
                  new Date(next.created_at).getTime() -
                    new Date(message.created_at).getTime()
                ) || 0;
              return delta < 5000;
            });

            if (tempIndex !== -1) {
              const updated = [...prev];
              const tempId = updated[tempIndex].id;
              updated[tempIndex] = { ...updated[tempIndex], ...next };
              optimisticIdsRef.current.delete(tempId);
              messageIdsRef.current.add(next.id);
              return updated;
            }

            messageIdsRef.current.add(next.id);
            return [...prev, next];
          });
        }
      )
      .on(
        "broadcast",
        { event: "typing" },
        (payload: { payload: { userId: string; name: string; typing: boolean } }) => {
          const { userId: typingId, name, typing } = payload.payload;
          if (!typingId || typingId === userId) return;
          if (typing) {
            if (typingUsersRef.current[typingId]) {
              clearTimeout(typingUsersRef.current[typingId]);
            }
            typingUsersRef.current[typingId] = setTimeout(() => {
              delete typingUsersRef.current[typingId];
              setTypingUsers(
                Object.keys(typingUsersRef.current).map(
                  (id) => authorMapRef.current[id] ?? "Teammate"
                )
              );
            }, 2500);
            authorMapRef.current[typingId] = name;
            setTypingUsers(
              Object.keys(typingUsersRef.current).map(
                (id) => authorMapRef.current[id] ?? "Teammate"
              )
            );
          } else {
            if (typingUsersRef.current[typingId]) {
              clearTimeout(typingUsersRef.current[typingId]);
            }
            delete typingUsersRef.current[typingId];
            setTypingUsers(
              Object.keys(typingUsersRef.current).map(
                (id) => authorMapRef.current[id] ?? "Teammate"
              )
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({
            userId,
            name: displayName || "Teammate",
            roles: teamRoles,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [orgId, supabase, toast, userId, displayName, teamRoles, isMentioned]);

  const filteredMessages = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((m) => m.message_type === filter);
  }, [messages, filter]);
  const lastMessageAt =
    messages.length > 0 ? messages[messages.length - 1].created_at : null;

  function resolveName(message: RawMessage) {
    const profile = Array.isArray(message.profiles)
      ? message.profiles[0]
      : message.profiles;
    return (
      profile?.display_name ||
      (message.author_id === userId ? displayName : null) ||
      "Teammate"
    );
  }

  function resolveReplyName(reply: RawMessage["reply_to"]) {
    if (!reply) return "Teammate";
    const profile = Array.isArray(reply.profiles)
      ? reply.profiles[0]
      : reply.profiles;
    return (
      profile?.display_name ||
      (reply.author_id === userId ? displayName : null) ||
      "Teammate"
    );
  }

  function resolveRoles(message: RawMessage) {
    const profile = Array.isArray(message.profiles)
      ? message.profiles[0]
      : message.profiles;
    return (
      profile?.team_roles ||
      (message.author_id === userId ? teamRoles : null) ||
      []
    );
  }

  function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderContent(text: string) {
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith("@") && part.length > 1) {
        return (
          <span
            key={`${part}-${index}`}
            className="rounded-md bg-blue-500/20 px-1.5 py-0.5 pulse-inline-mention"
          >
            {part}
          </span>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  }

  function formatRoles(roles: string[]) {
    return roles.map((role) => ROLE_LABELS[role] ?? role).join(" • ");
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    setError(null);

    const payload = {
      org_id: orgId,
      author_id: userId,
      content: content.trim(),
      message_type: messageType,
      match_key: matchKey.trim() || null,
      reply_to_id: replyTo?.id ?? null,
    };

    tempCounterRef.current += 1;
    const tempId = `temp-${userId}-${tempCounterRef.current}`;
    const optimisticMessage: RawMessage = {
      id: tempId,
      content: payload.content,
      message_type: payload.message_type,
      match_key: payload.match_key,
      created_at: new Date().toISOString(),
      author_id: userId,
      reply_to_id: payload.reply_to_id ?? null,
      profiles: {
        display_name: displayName,
        team_roles: teamRoles,
      },
      reply_to: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            author_id: replyTo.author_id,
            created_at: replyTo.created_at,
            profiles: replyTo.profiles ?? null,
          }
        : null,
    };

    optimisticIdsRef.current.add(tempId);
    setMessages((prev) => [...prev, optimisticMessage]);
    setContent("");
    setMatchKey("");
    setReplyTo(null);
    sendTyping(false);

    const { data, error: insertError } = await supabase
      .from("team_messages")
      .insert(payload)
      .select("id, content, message_type, match_key, created_at, author_id, reply_to_id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      optimisticIdsRef.current.delete(tempId);
      setSending(false);
      return;
    }

    authorMapRef.current[userId] = displayName;
    if (teamRoles.length > 0) {
      roleMapRef.current[userId] = teamRoles;
    }
    if (data?.id) {
      messageIdsRef.current.add(data.id);
    }
    if (data) {
      const nextMessage: RawMessage = {
        ...(data as RawMessage),
        profiles: {
          display_name: displayName,
          team_roles: teamRoles,
        },
        reply_to: optimisticMessage.reply_to,
      };
      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempId ? { ...message, ...nextMessage } : message
        )
      );
      optimisticIdsRef.current.delete(tempId);
    }
    setSending(false);
  }

  function sendTyping(typing: boolean) {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, name: displayName || "Teammate", typing },
    });
  }

  function handleContentChange(value: string) {
    setContent(value);
    const now = Date.now();
    if (now - typingThrottleRef.current > 1200) {
      typingThrottleRef.current = now;
      sendTyping(true);
    }
  }

  function handleContentBlur() {
    sendTyping(false);
  }

  function requestNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }
    Notification.requestPermission().then((permission) => {
      setNotificationState(permission);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
      <section className="rounded-2xl dashboard-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 dashboard-divider">
          <div>
            <h2 className="text-lg font-semibold pulse-text">Channel Feed</h2>
            <p className="text-xs pulse-muted">
              {messages.length} total updates
              {lastMessageAt ? ` • Last update ${formatTimestamp(lastMessageAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {["all", ...MESSAGE_TYPES.map((t) => t.value)].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === value ? "pulse-toggle-active" : "pulse-toggle"
                }`}
              >
                {value === "all" ? "All" : value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 h-[52vh] min-h-[320px] max-h-[620px] overflow-y-auto pr-2">
          <div className="space-y-2">
            {loadError && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Unable to load Team Pulse messages yet: {loadError}
              </div>
            )}
            {filteredMessages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-gray-950/50 p-6 text-center text-sm text-gray-400">
                No updates yet. Start the conversation!
              </div>
            ) : (
              filteredMessages.map((message) => {
                const name = resolveName(message);
                const roles = resolveRoles(message);
                const mentioned = isMentioned(message);
                const initials = name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase();
                const isSelf = message.author_id === userId;
                const tone = TYPE_STYLES[message.message_type] ?? TYPE_STYLES.note;
                const replyPreview = message.reply_to ?? null;

                return (
                  <div
                    key={message.id}
                    className={`rounded-2xl border px-3 py-2 ${tone} ${
                      mentioned ? "ring-1 ring-emerald-400/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-[11px] font-semibold text-white">
                        {initials || "T"}
                      </div>
                      <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold pulse-text">
                            {name}
                            {isSelf && (
                              <span className="ml-1 text-[10px] text-blue-500">
                                (you)
                              </span>
                            )}
                          </span>
                          <span className="pulse-muted">
                            {formatTime(message.created_at)}
                          </span>
                          {roles.length > 0 && (
                            <span className="text-[10px] uppercase tracking-wide pulse-muted">
                              {formatRoles(roles)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] uppercase tracking-wide">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 pulse-tag">
                            {message.message_type}
                          </span>
                          {message.match_key && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 pulse-tag">
                              {message.match_key}
                            </span>
                          )}
                          {mentioned && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 pulse-tag-mention">
                              mentioned you
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setReplyTo(message)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 normal-case pulse-text transition hover:bg-white/10"
                            aria-label={`Reply to ${name}`}
                            title="Reply"
                          >
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
                              <polyline points="9 17 4 12 9 7" />
                              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {replyPreview && (
                        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide pulse-muted">
                            Replying to {resolveReplyName(replyPreview)}
                          </div>
                          <p className="mt-1 text-sm pulse-text">
                            {replyPreview.content.length > 120
                              ? `${replyPreview.content.slice(0, 120)}…`
                              : replyPreview.content}
                          </p>
                        </div>
                      )}
                      <p className="mt-2 text-sm leading-relaxed pulse-text">
                        {renderContent(message.content)}
                      </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl dashboard-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold pulse-text">Post an update</h3>
              <p className="text-xs pulse-muted">
                Share quick strategy notes, questions, or alerts for your team.
              </p>
            </div>
          </div>

          {replyTo && (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-gray-900/40 px-3 py-2 text-xs text-gray-300">
              <div>
                Replying to {resolveReplyName(replyTo)}
                <p className="mt-1 text-sm text-gray-200">
                  {replyTo.content.length > 120
                    ? `${replyTo.content.slice(0, 120)}…`
                    : replyTo.content}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest pulse-muted">
                Type
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {MESSAGE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setMessageType(type.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      messageType === type.value
                        ? "pulse-toggle-active"
                        : "pulse-toggle"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest pulse-muted">
                Match tag (optional)
              </label>
              <input
                value={matchKey}
                onChange={(e) => setMatchKey(e.target.value)}
                placeholder="e.g. Q12 or SF2-1"
                className="mt-2 w-full rounded-lg px-3 py-2 text-sm pulse-text placeholder:text-gray-500 dashboard-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest pulse-muted">
                Message
              </label>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onBlur={handleContentBlur}
                rows={4}
                placeholder="Share the quick takeaway..."
                className="mt-2 w-full rounded-lg px-3 py-2 text-sm pulse-text placeholder:text-gray-500 dashboard-input"
              />
              <p className="mt-2 text-xs pulse-muted">
                Use @everyone or @driver/@coach/etc to ping teammates.
              </p>
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-slate-50 transition hover:bg-blue-500 disabled:opacity-50"
            >
              {sending ? "Posting..." : "Post to channel"}
            </button>
          </form>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl dashboard-panel p-6">
          <h4 className="text-sm font-semibold text-white">Active now</h4>
          <p className="mt-1 text-xs text-gray-400">
            {onlineUsers.length} online
          </p>
          <div className="mt-4 space-y-3">
            {onlineUsers.length === 0 ? (
              <p className="text-xs text-gray-400">Waiting for teammates...</p>
            ) : (
              onlineUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <div>
                    <p className="text-sm text-white">{user.name}</p>
                    {user.roles.length > 0 && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                        {formatRoles(user.roles)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            {typingUsers.length > 0 && (
              <p className="text-xs text-emerald-200">
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing...
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl dashboard-panel p-6 text-sm text-gray-300">
          <h4 className="text-sm font-semibold text-white">Notifications</h4>
          <p className="mt-2 text-xs text-gray-400">
            Enable desktop notifications for new Team Pulse updates.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              suppressHydrationWarning
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300"
            >
              {notificationState === "unsupported"
                ? "Not supported"
                : notificationState}
            </span>
            {notificationState === "default" && (
              <button
                type="button"
                onClick={requestNotifications}
                className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
              >
                Enable
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl dashboard-panel p-6 text-sm text-gray-300">
          <h4 className="text-sm font-semibold text-white">Pulse norms</h4>
          <ul className="mt-3 space-y-2">
            <li>Share concise match takeaways.</li>
            <li>Tag match numbers so captains can review fast.</li>
            <li>Use alerts for urgent pit/field calls.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
