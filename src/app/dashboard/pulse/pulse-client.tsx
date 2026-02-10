"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

type RawMessage = {
  id: string;
  content: string;
  message_type: string;
  match_key: string | null;
  created_at: string;
  author_id: string;
  profiles?: { display_name: string } | { display_name: string }[] | null;
};

interface PulseClientProps {
  orgId: string;
  userId: string;
  displayName: string;
  initialMessages: RawMessage[];
}

const MESSAGE_TYPES = [
  { value: "note", label: "Note" },
  { value: "strategy", label: "Strategy" },
  { value: "question", label: "Question" },
  { value: "alert", label: "Alert" },
] as const;

const TYPE_STYLES: Record<string, string> = {
  note: "border-white/10 bg-white/5 text-gray-200",
  strategy: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  question: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  alert: "border-red-500/30 bg-red-500/10 text-red-100",
};

export function PulseClient({
  orgId,
  userId,
  displayName,
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
  const endRef = useRef<HTMLDivElement | null>(null);
  const authorMapRef = useRef<Record<string, string>>({});
  const messageIdsRef = useRef(new Set<string>());
  const typingUsersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingThrottleRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [notificationState, setNotificationState] = useState<
    "unsupported" | NotificationPermission
  >("unsupported");

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const message of initialMessages) {
      const profile = Array.isArray(message.profiles)
        ? message.profiles[0]
        : message.profiles;
      if (profile?.display_name) {
        map[message.author_id] = profile.display_name;
      }
    }
    if (displayName) {
      map[userId] = displayName;
    }
    authorMapRef.current = map;
    messageIdsRef.current = new Set(initialMessages.map((m) => m.id));
  }, [initialMessages, displayName, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setNotificationState(Notification.permission);
      } else {
        setNotificationState("unsupported");
      }
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`team-messages-${orgId}`)
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
          messageIdsRef.current.add(next.id);

          if (!authorMapRef.current[next.author_id]) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", next.author_id)
              .single();
            if (data?.display_name) {
              authorMapRef.current[next.author_id] = data.display_name;
            }
          }

          const authorName =
            authorMapRef.current[next.author_id] ?? "Teammate";
          if (next.author_id !== userId) {
            const snippet =
              next.content.length > 80
                ? `${next.content.slice(0, 80)}…`
                : next.content;
            toast(`${authorName}: ${snippet}`, "info");
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted" &&
              document.visibilityState === "hidden"
            ) {
              new Notification(`New ${next.message_type} update`, {
                body: `${authorName}: ${snippet}`,
              });
            }
          }

          setMessages((prev) => [...prev, next]);
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
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [orgId, supabase, toast, userId]);

  const filteredMessages = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((m) => m.message_type === filter);
  }, [messages, filter]);

  function resolveName(message: RawMessage) {
    const profile = Array.isArray(message.profiles)
      ? message.profiles[0]
      : message.profiles;
    return (
      profile?.display_name ||
      authorMapRef.current[message.author_id] ||
      "Teammate"
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
    };

    const { data, error: insertError } = await supabase
      .from("team_messages")
      .insert(payload)
      .select("id, content, message_type, match_key, created_at, author_id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSending(false);
      return;
    }

    authorMapRef.current[userId] = displayName;
    if (data?.id) {
      messageIdsRef.current.add(data.id);
    }
    setMessages((prev) => [...prev, data as RawMessage]);
    setContent("");
    setMatchKey("");
    setSending(false);
    sendTyping(false);
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
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Channel Feed</h2>
            <p className="text-xs text-gray-400">
              {messages.length} total updates
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {["all", ...MESSAGE_TYPES.map((t) => t.value)].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === value
                    ? "border-blue-500/40 bg-blue-500/20 text-blue-100"
                    : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20"
                }`}
              >
                {value === "all" ? "All" : value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-gray-950/50 p-6 text-center text-sm text-gray-400">
              No updates yet. Start the conversation!
            </div>
          ) : (
            filteredMessages.map((message) => {
              const name = resolveName(message);
              const initials = name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();
              const isSelf = message.author_id === userId;
              const tone = TYPE_STYLES[message.message_type] ?? TYPE_STYLES.note;

              return (
                <div
                  key={message.id}
                  className={`rounded-2xl border px-4 py-3 ${tone}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-semibold text-white">
                      {initials || "T"}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-white">
                          {name}
                          {isSelf && (
                            <span className="ml-1 text-[10px] text-blue-200">
                              (you)
                            </span>
                          )}
                        </span>
                        <span className="text-gray-400">
                          {formatTime(message.created_at)}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-200">
                          {message.message_type}
                        </span>
                        {message.match_key && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-200">
                            {message.match_key}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-100">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {typingUsers.length > 0 && (
            <div className="px-2 text-xs text-gray-400">
              {typingUsers.join(", ")}{" "}
              {typingUsers.length === 1 ? "is" : "are"} typing...
            </div>
          )}
          <div ref={endRef} />
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-white">Post an update</h3>
          <p className="mt-1 text-sm text-gray-300">
            Share quick strategy notes, questions, or alerts for your team.
          </p>

          <form onSubmit={handleSend} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
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
                        ? "border-blue-500/40 bg-blue-500/20 text-blue-100"
                        : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
                Match tag (optional)
              </label>
              <input
                value={matchKey}
                onChange={(e) => setMatchKey(e.target.value)}
                placeholder="e.g. Q12 or SF2-1"
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
                Message
              </label>
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={handleContentBlur}
              rows={5}
              placeholder="Share the quick takeaway..."
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {sending ? "Posting..." : "Post to channel"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 text-sm text-gray-300 shadow-sm">
          <h4 className="text-sm font-semibold text-white">Notifications</h4>
          <p className="mt-2 text-xs text-gray-400">
            Enable desktop notifications for new Team Pulse updates.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
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

        <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 text-sm text-gray-300 shadow-sm">
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
