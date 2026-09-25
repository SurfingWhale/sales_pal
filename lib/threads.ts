// Threads Radar: the people who reply to or mention the owner's own Threads
// posts. They already know the work, which makes them the warmest DMs there
// are. Threads has no DM API, so the DM itself stays manual (Hunting).
//
// The owner connects their Threads account once. The token only reads their
// own account: posts, replies and mentions (threads_basic,
// threads_read_replies, threads_manage_mentions), all of which work without
// Meta's app review. It lives in users/{uid}/settings/threads.

export const THREADS_SCOPES = ["threads_basic", "threads_read_replies", "threads_manage_mentions"];

export interface ThreadsConnection {
  token: string;
  userId: string;
  username?: string;
  expiresAt: number;   // ms
  refreshedAt: number; // ms
}

// One person who spoke up under the owner's posts, newest words first.
export interface RadarItem {
  id: string;          // the reply or mention
  kind: "reply" | "mention";
  username: string;
  text: string;
  permalink: string;
  timestamp: string;   // ISO
  postText: string;    // the owner's post it was under ("" for a mention)
  postPermalink: string;
}

export interface RadarPerson {
  username: string;
  latest: RadarItem;
  count: number;
}

// A long-lived token lasts 60 days and can be refreshed once it is a day old.
// Refresh when it has under 30 days left, so an app opened monthly stays connected.
export function needsRefresh(c: ThreadsConnection, now = Date.now()): boolean {
  const DAY = 86400000;
  return now - c.refreshedAt > DAY && c.expiresAt - now < 30 * DAY && c.expiresAt > now;
}

// Everyone who replied or mentioned, one row per person, newest first. Replies
// by the owner are dropped server-side; the owner's own handle is dropped here too.
export function groupRadar(items: RadarItem[], ownUsername = ""): RadarPerson[] {
  const own = ownUsername.toLowerCase();
  const byUser = new Map<string, RadarPerson>();
  for (const it of items) {
    if (!it.username || it.username.toLowerCase() === own) continue;
    const key = it.username.toLowerCase();
    const p = byUser.get(key);
    if (!p) byUser.set(key, { username: it.username, latest: it, count: 1 });
    else {
      p.count++;
      if (it.timestamp > p.latest.timestamp) p.latest = it;
    }
  }
  return Array.from(byUser.values()).sort((a, b) => b.latest.timestamp.localeCompare(a.latest.timestamp));
}

export function profileUrl(username: string): string {
  return `https://www.threads.com/@${username}`;
}
