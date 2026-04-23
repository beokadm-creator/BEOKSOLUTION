import type {
  BadgeConfig,
  BadgeMenuLabels,
  ResolvedMenuVisibility,
} from "@/types/badge";

export function t(badgeLang: "ko" | "en", ko: string, en: string): string {
  return badgeLang === "ko" ? ko : en;
}

export function formatBadgeMinutes(
  badgeLang: "ko" | "en",
  minutes: number,
): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return badgeLang === "ko" ? `${h}시간 ${m}분` : `${h}h ${m}m`;
}

const ALL_MENU_KEYS: (keyof ResolvedMenuVisibility)[] = [
  "status",
  "sessions",
  "materials",
  "program",
  "translation",
  "stampTour",
  "home",
  "qna",
  "certificate",
];

export function resolveMenuVisibility(
  raw?: BadgeConfig["menuVisibility"],
): ResolvedMenuVisibility {
  const result: Record<string, boolean> = {};
  for (const key of ALL_MENU_KEYS) {
    result[key] = raw?.[key] ?? true;
  }
  return result as ResolvedMenuVisibility;
}

export function effectiveMenuVisibility(
  raw?: BadgeConfig["menuVisibility"],
): ResolvedMenuVisibility {
  const resolved = resolveMenuVisibility(raw);
  const anyTrue = ALL_MENU_KEYS.some((k) => resolved[k]);
  if (anyTrue) return resolved;
  return { ...resolved, status: true };
}

export function resolveMenuLabel(
  labels: BadgeMenuLabels | undefined,
  badgeLang: "ko" | "en",
  key: keyof BadgeMenuLabels,
  fallbackKo: string,
  fallbackEn: string,
): string {
  const entry = labels?.[key];
  if (badgeLang === "ko") return entry?.ko || fallbackKo;
  return entry?.en || fallbackEn;
}

export function badgeGridColsClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-2";
  if (count <= 3) return "grid-cols-3";
  if (count <= 4) return "grid-cols-4";
  if (count <= 5) return "grid-cols-5";
  return "grid-cols-6";
}
