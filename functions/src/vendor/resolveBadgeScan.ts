import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { assertVendorActor, buildScanResponse, resolveRegistrationByScan } from "./shared";

export const resolveVendorBadgeScan = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const { vendorId, confId, qrData } = data as {
        vendorId?: string;
        confId?: string;
        qrData?: string;
    };

    if (!vendorId || !confId || !qrData) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "vendorId, confId and qrData are required."
        );
    }

    const db = admin.firestore();
    await assertVendorActor(db, vendorId, context.auth);
    const resolved = await resolveRegistrationByScan(db, confId, qrData);

    return buildScanResponse(resolved);
});
