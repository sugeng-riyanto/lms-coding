"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mkT, type Lang } from "@/lib/i18n";
import { MESSAGES } from "@/lib/ui-text/messages";

interface MessageBellProps {
  lang?: Lang;
  userId: string;
  onOpen: () => void;
}

export function MessageBell({ lang = "en", userId, onOpen }: MessageBellProps) {
  const t = mkT(MESSAGES, lang);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    // Load initial unread count
    const loadCount = async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      setUnread(count ?? 0);
    };

    loadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel("message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          setUnread((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          // If message was marked as read, decrement count
          if (payload.new.read_at && !payload.old.read_at) {
            setUnread((prev) => Math.max(0, prev - 1));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
      aria-label={t("ariaLabel")}
    >
      <span className="text-xl">💬</span>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
