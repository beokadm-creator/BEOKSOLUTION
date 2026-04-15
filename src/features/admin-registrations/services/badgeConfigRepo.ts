import { doc, getDoc } from "firebase/firestore";

import { db } from "@/firebase";

import type { BadgeLayout, BadgeConfigDoc } from "../types";

export const badgeConfigRepo = {
  async getActiveBadgeLayout(conferenceId: string): Promise<BadgeLayout | null> {
    const cfgSnap = await getDoc(doc(db, `conferences/${conferenceId}/settings/badge_config`));
    if (!cfgSnap.exists()) return null;

    const data = cfgSnap.data() as BadgeConfigDoc;
    if (!data.badgeLayoutEnabled || !data.badgeLayout) return null;

    return {
      width: data.badgeLayout.width || 800,
      height: data.badgeLayout.height || 1200,
      elements: data.badgeLayout.elements || [],
      unit: data.badgeLayout.unit,
      enableCutting: data.badgeLayout.enableCutting ?? true,
      printerDpmm: data.badgeLayout.printerDpmm,
      printOffsetXmm: data.badgeLayout.printOffsetXmm,
      printOffsetYmm: data.badgeLayout.printOffsetYmm,
      printStartOffsetMm: data.badgeLayout.printStartOffsetMm,
      mediaType: data.badgeLayout.mediaType,
      marginXMm: data.badgeLayout.marginXMm,
      marginYMm: data.badgeLayout.marginYMm,
    };
  },
};
