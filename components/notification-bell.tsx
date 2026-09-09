"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { markNotificationRead } from "@/features/actions";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { NOTIFICATIONS } from "@/lib/ui-text/notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell({
  notifications,
  lang = "id",
}: {
  notifications: Notification[];
  lang?: Lang;
}) {
  const t = mkT(NOTIFICATIONS, lang);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleMarkRead(id: string) {
    const result = await markNotificationRead({ notificationId: id });
    if (result.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    }
  }

  async function handleMarkAllRead() {
    const unread = items.filter((n) => !n.read_at);
    for (const n of unread) {
      await markNotificationRead({ notificationId: n.id });
    }
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={fmt(t("ariaLabel"), { count: String(unreadCount) })}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("title")}
          className="absolute right-0 z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border bg-white shadow-lg dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h3 className="text-sm font-semibold">{t("title")}</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t("empty")}</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b px-4 py-3 last:border-0 ${!n.read_at ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${!n.read_at ? "font-semibold" : ""}`}>{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!n.read_at && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
                          aria-label={t("markRead")}
                        >
                          {t("markRead")}
                        </button>
                      )}
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (!n.read_at) handleMarkRead(n.id);
                            setOpen(false);
                          }}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                        >
                          →
                        </Link>
                      )}
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
