"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";


interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
  user_role?: string;
}

interface ActivityCommentsProps {
  activityId: string;
  userId: string;
}

export function ActivityComments({ activityId, userId }: ActivityCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const supabase = createClient();

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_comments")
        .select("*")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set(data?.map((c) => c.user_id) ?? [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, role")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, { name: p.display_name, role: p.role }]) ?? []);

      const enriched = data?.map((c) => ({
        ...c,
        user_name: profileMap.get(c.user_id)?.name ?? "Unknown",
        user_role: profileMap.get(c.user_id)?.role ?? "student",
      })) ?? [];

      setComments(enriched);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [activityId, supabase]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadComments();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadComments]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("activity-comments")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_comments",
          filter: `activity_id=eq.${activityId}`,
        },
        () => {
          loadComments();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityId, loadComments, supabase]);

  // Post comment
  const handlePost = async () => {
    if (!newComment.trim()) return;

    setPosting(true);
    try {
      const { error } = await supabase.from("activity_comments").insert({
        activity_id: activityId,
        user_id: userId,
        content: newComment.trim(),
      });

      if (error) throw error;

      setNewComment("");
      await loadComments();
    } catch {
      // Handle error
    } finally {
      setPosting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
        Loading comments...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Discussion</h3>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
          No comments yet. Start the discussion!
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={`rounded-xl border p-3 ${
                comment.user_role === "teacher"
                  ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.user_name}</span>
                    {comment.user_role === "teacher" && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Teacher
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{comment.content}</p>
                </div>
                <span className="text-[10px] text-slate-400">{formatDate(comment.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* New comment form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handlePost();
            }
          }}
          placeholder="Add a comment..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || !newComment.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {posting ? "..." : "Post"}
        </button>
      </div>
    </div>
  );
}
