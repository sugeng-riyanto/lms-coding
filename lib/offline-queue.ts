/**
 * IndexedDB-backed offline write queue.
 * Queues Supabase mutations when offline; replays when back online.
 * Data model: each queued action stores the full mutation for replay.
 */

const DB_NAME = "lms-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "pending-actions";

interface QueuedAction {
  id: string;
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  error?: string;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("table", "table", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue a mutation for later replay.
 */
export async function queueAction(
  action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">,
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const record: QueuedAction = {
    ...action,
    id,
    timestamp: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all queued actions, ordered by timestamp.
 */
export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("timestamp");
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a successfully replayed action.
 */
export async function removeAction(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Mark an action as failed (increment retry count, store error).
 */
export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const get = store.get(id);
    get.onsuccess = () => {
      const record = get.result as QueuedAction | undefined;
      if (record) {
        record.retryCount += 1;
        record.error = error;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get count of pending actions.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all queued actions (e.g., after a full sync).
 */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Replay all queued actions via a provided executor function.
 * Returns stats about the replay.
 */
export async function replayQueue(
  executor: (action: QueuedAction) => Promise<void>,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const actions = await getQueuedActions();
  let succeeded = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      await executor(action);
      await removeAction(action.id);
      succeeded++;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (action.retryCount >= 3) {
        // Max retries reached — remove to prevent infinite loop
        await removeAction(action.id);
      } else {
        await markFailed(action.id, error);
      }
      failed++;
    }
  }

  return { total: actions.length, succeeded, failed };
}

/**
 * React hook-friendly wrapper: returns pending count and a replay function.
 */
export function createOfflineQueueManager() {
  return {
    queue: queueAction,
    getPending: getPendingCount,
    getAll: getQueuedActions,
    replay: replayQueue,
    clear: clearQueue,
  };
}
