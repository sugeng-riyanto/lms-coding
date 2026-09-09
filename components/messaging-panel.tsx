"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { mkT, type Lang } from "@/lib/i18n";
import { MESSAGES } from "@/lib/ui-text/messages";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  enrollment_id: string | null;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender_name?: string;
  recipient_name?: string;
}

interface MessagingPanelProps {
  lang?: Lang;
  userId: string;
  role: "teacher" | "student";
  onClose: () => void;
}

export function MessagingPanel({ lang = "en", userId, role, onClose }: MessagingPanelProps) {
  const t = mkT(MESSAGES, lang);
  const [tab, setTab] = useState<"inbox" | "sent" | "compose">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Compose state
  const [recipients, setRecipients] = useState<{ id: string; name: string }[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const supabase = createClient();

  // Load messages
  const loadMessages = useCallback(async (type: "inbox" | "sent") => {
    setLoading(true);
    try {
      let query = supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (type === "inbox") {
        query = query.eq("recipient_id", userId);
      } else {
        query = query.eq("sender_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch sender/recipient names
      const userIds = [...new Set([
        ...data.map((m) => m.sender_id),
        ...data.map((m) => m.recipient_id),
      ])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.display_name]) ?? []);

      const enriched = data.map((m) => ({
        ...m,
        sender_name: profileMap.get(m.sender_id) ?? "Unknown",
        recipient_name: profileMap.get(m.recipient_id) ?? "Unknown",
      }));

      setMessages(enriched);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  // Load recipients (students for teacher, teachers for student)
  const loadRecipients = useCallback(async () => {
    try {
      if (role === "teacher") {
        // Get students in teacher's cohorts via cohort_students
        const { data: cohortStudents } = await supabase
          .from("cohort_students")
          .select("student_id, cohort_id")
          .eq("status", "active");

        // Get teacher's cohorts
        const { data: teacherCohorts } = await supabase
          .from("cohorts")
          .select("id")
          .eq("teacher_id", userId);

        const teacherCohortIds = new Set(teacherCohorts?.map((c) => c.id) ?? []);
        const studentIds = [...new Set(
          cohortStudents
            ?.filter((cs) => teacherCohortIds.has(cs.cohort_id))
            .map((cs) => cs.student_id) ?? []
        )];

        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", studentIds);

          setRecipients(profiles?.map((p) => ({ id: p.id, name: p.display_name ?? "Student" })) ?? []);
        }
      } else {
        // Get teachers of student's cohorts
        const { data: studentCohorts } = await supabase
          .from("cohort_students")
          .select("cohort_id")
          .eq("student_id", userId)
          .eq("status", "active");

        const cohortIds = studentCohorts?.map((cs) => cs.cohort_id) ?? [];
        if (cohortIds.length > 0) {
          const { data: cohorts } = await supabase
            .from("cohorts")
            .select("teacher_id")
            .in("id", cohortIds);

          const teacherIds = [...new Set(cohorts?.map((c) => c.teacher_id) ?? [])];
          if (teacherIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", teacherIds);

            setRecipients(profiles?.map((p) => ({ id: p.id, name: p.display_name ?? "Teacher" })) ?? []);
          }
        }
      }
    } catch {
      setRecipients([]);
    }
  }, [role, userId, supabase]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadMessages(tab === "compose" ? "inbox" : tab);
    if (tab === "compose") loadRecipients();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tab, loadMessages, loadRecipients]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          loadMessages(tab === "compose" ? "inbox" : tab);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, tab, loadMessages, supabase]);

  // Mark as read
  const markAsRead = async (messageId: string) => {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", messageId)
      .is("read_at", null);
  };

  // Send message
  const handleSend = async () => {
    if (!selectedRecipient || !body.trim()) return;

    setSending(true);
    setSendResult(null);

    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: selectedRecipient,
        subject: subject.trim(),
        body: body.trim(),
      });

      if (error) throw error;

      setSendResult({ success: true, message: t("sendSuccess") });
      setSelectedRecipient("");
      setSubject("");
      setBody("");
      setTimeout(() => setTab("sent"), 1000);
    } catch (err) {
      setSendResult({ success: false, message: t("sendError") });
    } finally {
      setSending(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border bg-white shadow-2xl dark:bg-slate-900 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(["inbox", "sent", "compose"] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => { setTab(tabKey); setSelectedMessage(null); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${
                tab === tabKey
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tabKey === "inbox" ? t("inbox") : tabKey === "sent" ? t("sent") : t("compose")}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {t("loading")}
            </div>
          ) : tab === "compose" ? (
            /* Compose form */
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t("to")} *</label>
                <select
                  value={selectedRecipient}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">{role === "teacher" ? t("selectStudent") : t("selectTeacher")}</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{t("subject")}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder={t("subject")}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{t("message")} *</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-y"
                  placeholder={t("message")}
                />
              </div>

              {sendResult && (
                <p className={`text-sm ${sendResult.success ? "text-green-600" : "text-red-600"}`}>
                  {sendResult.message}
                </p>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !selectedRecipient || !body.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? t("loading") : t("send")}
              </button>
            </div>
          ) : selectedMessage ? (
            /* Message detail */
            <div className="p-4">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="mb-3 text-sm text-blue-600 hover:underline"
              >
                ← {tab === "inbox" ? t("inbox") : t("sent")}
              </button>
              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      {tab === "inbox" ? `From: ${selectedMessage.sender_name}` : `To: ${selectedMessage.recipient_name}`}
                    </p>
                    {selectedMessage.subject && (
                      <h3 className="mt-1 font-semibold">{selectedMessage.subject}</h3>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(selectedMessage.created_at)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{selectedMessage.body}</p>
              </div>
              {tab === "inbox" && !selectedMessage.read_at && (
                <button
                  type="button"
                  onClick={() => {
                    markAsRead(selectedMessage.id);
                    setSelectedMessage({ ...selectedMessage, read_at: new Date().toISOString() });
                  }}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  {t("markRead")}
                </button>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {tab === "inbox" ? t("emptyInbox") : t("emptySent")}
            </div>
          ) : (
            /* Message list */
            <ul>
              {messages.map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (tab === "inbox" && !msg.read_at) markAsRead(msg.id);
                    }}
                    className={`w-full border-b px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      tab === "inbox" && !msg.read_at ? "bg-blue-50/50 dark:bg-blue-950/30" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${tab === "inbox" && !msg.read_at ? "font-bold" : "font-medium"}`}>
                          {tab === "inbox" ? msg.sender_name : msg.recipient_name}
                        </p>
                        {msg.subject && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 truncate">{msg.subject}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-400 truncate">{msg.body}</p>
                      </div>
                      <span className="ml-2 shrink-0 text-[10px] text-slate-400">{formatDate(msg.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
