"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface PresenceState {
  userId: string;
  role: string;
  name: string;
  online: boolean;
  cursor?: { x: number; y: number };
}

interface UsePresenceOptions {
  channelName: string;
  initialState: PresenceState;
  enabled?: boolean;
}

/**
 * Supabase Realtime presence hook.
 * Tracks who is online on a given channel (e.g., a quiz attempt or assignment page).
 * Returns list of present users and a broadcast function for cursor/selection sync.
 */
export function usePresence({ channelName, initialState, enabled = true }: UsePresenceOptions) {
  const [present, setPresent] = useState<PresenceState[]>([]);
  const [synced, setSynced] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient>>(createClient());

  useEffect(() => {
    if (!enabled) return;

    const supabase = supabaseRef.current;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const users = Object.values(state)
          .flat()
          .map((p) => p as unknown as PresenceState);
        setPresent(users);
        setSynced(true);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }: { key: string; newPresences: unknown[] }) => {
        void key;
        void newPresences;
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }: { key: string; leftPresences: unknown[] }) => {
        void key;
        void leftPresences;
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track(initialState);
        }
      });

    return () => {
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channelName, enabled, initialState]);

  const broadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event,
        payload,
      });
    }
  }, []);

  return { present, synced, broadcast };
}

/**
 * Broadcast cursor position for collaborative editing.
 * Throttled to 50ms to avoid flooding the channel.
 */
export function useLiveCursor(channelName: string, enabled = true) {
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number; name: string }>>({});
  const lastSentRef = useRef(0);
  const supabaseRef = useRef(createClient());

  const { broadcast } = usePresence({
    channelName: `${channelName}-cursors`,
    initialState: { userId: "", role: "", name: "", online: true },
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;

    function handleMouseMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastSentRef.current < 50) return;
      lastSentRef.current = now;
      broadcast("cursor", { x: e.clientX, y: e.clientY });
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [broadcast, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = supabaseRef.current ?? createClient();
    const channel = supabase.channel(`${channelName}-cursors`);

    channel
      .on("broadcast", { event: "cursor" }, ({ payload }: { payload: { userId: string; x: number; y: number; name: string } }) => {
        if (payload?.userId) {
          setCursors((prev) => ({
            ...prev,
            [payload.userId]: { x: payload.x, y: payload.y, name: payload.name },
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled]);

  return { cursors };
}
