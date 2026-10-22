// The paid tools and who may use them in a guild until its Leader says
// otherwise (PRD-015). Shared by the server (lib/access.ts) and Atur guild.

import type { Role } from "@/lib/guild";

export type PaidTool = "places" | "geocode" | "scan";
export const PAID_TOOLS: PaidTool[] = ["places", "geocode", "scan"];

export const TOOL_LABEL: Record<PaidTool, string> = { places: "Cari bisnis", geocode: "Cari alamat", scan: "Scan gambar (AI)" };
export const TOOL_HINT: Record<PaidTool, string> = {
  places: "Cari bisnis di Google Maps. Paling boros jatah gratis (900 pencarian sebulan buat semua akun).",
  geocode: "Cari alamat buat titik lead di peta. Tempel link Maps & OpenStreetMap tetap jalan buat semua.",
  scan: "Baca lead dari screenshot, tabel, atau kartu nama pakai AI (x.ai, berbayar). 300 scan sebulan buat semua akun.",
};

// The Leader always may; these are the other roles allowed by default.
export const DEFAULT_ROLES: Record<PaidTool, Role[]> = {
  places: ["leader", "officer"],
  geocode: ["leader", "officer", "member"],
  scan: ["leader", "officer", "member"],
};

// guilds/{g}/settings/tools: { places?: Role[], geocode?: Role[] }
export type ToolRoles = Partial<Record<PaidTool, Role[]>>;
export const rolesFor = (t: ToolRoles, tool: PaidTool): Role[] =>
  Array.isArray(t[tool]) ? ["leader", ...t[tool]!.filter(r => r !== "leader")] : DEFAULT_ROLES[tool];
