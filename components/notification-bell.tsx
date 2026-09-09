"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mkT, type Lang } from "@/lib/i18n";
import { NOTIFICATIONS } from "@/lib/ui-text/notifications";

interface Notification {
  id: string;
  type: "quiz_submission" | "assignment_submission" | "new_enrollment";
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  quiz_submission: "📝",
  assignment_submission: "📋",
  new_enrollment: "🎓",
};

export function NotificationBell({ lang = "en" }: { lang?: Lang }) {
  const t = mkT(NOTIFICATIONS, lang);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Load existing notifications
    const loadNotifications = async () => {
      const { data } = await supabase
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        const items: Notification[] = data.map((e) => ({
          id: e.id,
          type: e.event_type as Notification["type"],
          title: formatTitle(e.event_type),
          message: e.payload?.description ?? "",
          created_at: e.created_at,
          read: false,
        }));
        setNotifications(items);
        setUnread(items.length);
      }
    };

    loadNotifications();

    // Subscribe to new events
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        (payload) => {
          const event = payload.new as { id: string; event_type: string; payload: Record<string, unknown>; created_at: string };
          const notif: Notification = {
            id: event.id,
            type: event.event_type as Notification["type"],
            title: formatTitle(event.event_type),
            message: (event.payload?.description as string) ?? "",
            created_at: event.created_at,
            read: false,
          };
          setNotifications((prev) => [notif, ...prev].slice(0, 20));
          setUnread((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAllRead = () => {
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={t("ariaLabel")}
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border bg-white shadow-xl dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="font-semibold text-sm">{t("title")}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">{t("empty")}</div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`border-b px-4 py-3 text-sm last:border-0 ${
                    n.read ? "opacity-60" : "bg-blue-50 dark:bg-blue-950"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span>{TYPE_ICONS[n.type] ?? "📌"}</span>
                    <div className="flex-1">
                      <p className="font-medium">{n.title}</p>
                      {n.message && <p className="text-xs text-slate-600 dark:text-slate-400">{n.message}</p>}
                      <p className="mt-1 text-[10px] text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatTitle(type: string): string {
  const titles: Record<string, string> = {
    quiz_submission: "Quiz submitted",
    assignment_submission: "Assignment submitted",
    new_enrollment: "New enrollment",
  };
  return titles[type] ?? type;
}
