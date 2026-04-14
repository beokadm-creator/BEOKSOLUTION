import { getFunctions, httpsCallable } from "firebase/functions";

export const registrationFunctions = {
  issueDigitalBadge: async (params: { confId: string; regId: string; issueOption: "DIGITAL_PRINT" }) => {
    const functions = getFunctions();
    const issueBadgeFn = httpsCallable(functions, "issueDigitalBadge");
    return (await issueBadgeFn(params)) as { data: { success: boolean; badgeQr?: string } };
  },

  resendBadgePrepToken: async (params: { confId: string; regId: string }) => {
    const functions = getFunctions();
    const resendNotificationFn = httpsCallable(functions, "resendBadgePrepToken");
    return (await resendNotificationFn(params)) as { data: { success: boolean; newToken: string } };
  },

  bulkSendNotifications: async (params: { confId: string; regIds: string[] }) => {
    const fns = getFunctions();
    const bulkFn = httpsCallable(fns, "bulkSendNotifications");
    return (await bulkFn(params)) as {
      data: { success: boolean; sent: number; failed: number; skipped: number; tokenGenerated: number };
    };
  },
};

