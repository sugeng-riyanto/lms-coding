"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/i18n";

interface ContentVersion {
  id: string;
  version_number: number;
  content_json: Record<string, unknown>;
  title: string;
  changed_by: string;
  change_summary: string;
  created_at: string;
  changer_name?: string;
}

interface ContentVersionHistoryProps {
  lang?: Lang;
  activityId: string;
  currentContent: Record<string, unknown>;
  currentTitle: string;
  onRestore: (content: Record<string, unknown>, title: string) => void;
}

export function ContentVersionHistory({
  activityId,
  onRestore,
}: ContentVersionHistoryProps) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  const supabase = createClient();

  // Load versions
  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_content_versions")
        .select("*")
        .eq("activity_id", activityId)
        .order("version_number", { ascending: false });

      if (error) throw error;

      // Fetch changer names
      const userIds = [...new Set(data?.map((v) => v.changed_by) ?? [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.display_name]) ?? []);

      const enriched = data?.map((v) => ({
        ...v,
        changer_name: profileMap.get(v.changed_by) ?? "Unknown",
      })) ?? [];

      setVersions(enriched);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [activityId, supabase]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadVersions();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadVersions]);

  // Restore version
  const handleRestore = async (version: ContentVersion) => {
    setRestoring(true);
    try {
      // Update activity with old content
      const { error } = await supabase
        .from("activities")
        .update({
          content_json: version.content_json,
          title: version.title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activityId);

      if (error) throw error;

      // Create a new version记录 the restore
      await supabase.from("activity_content_versions").insert({
        activity_id: activityId,
        version_number: versions.length + 1,
        content_json: version.content_json,
        title: version.title,
        changed_by: (await supabase.auth.getUser()).data.user?.id,
        change_summary: `Restored from version ${version.version_number}`,
      });

      onRestore(version.content_json, version.title);
      setSelectedVersion(null);
      await loadVersions();
    } catch {
      // Handle error silently
    } finally {
      setRestoring(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
        Loading versions...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Version History</h3>
        <span className="text-xs text-slate-500">{versions.length} versions</span>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
          No version history yet. Save changes to create versions.
        </div>
      ) : (
        <ul className="space-y-2">
          {versions.map((version, idx) => {
            const isCurrent = idx === 0;
            const isSelected = selectedVersion?.id === version.id;

            return (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => setSelectedVersion(isSelected ? null : version)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isCurrent
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                      : isSelected
                      ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isCurrent
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                          }`}
                        >
                          v{version.version_number}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] text-green-600">Current</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {version.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {version.change_summary} by {version.changer_name}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(version.created_at)}
                    </span>
                  </div>
                </button>

                {/* Version details */}
                {isSelected && (
                  <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/50">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-medium">Version {version.version_number} Content</h4>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRestore(version)}
                          disabled={restoring}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {restoring ? "Restoring..." : "Restore this version"}
                        </button>
                      )}
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-lg bg-white p-3 text-xs dark:bg-slate-800">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(version.content_json, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
