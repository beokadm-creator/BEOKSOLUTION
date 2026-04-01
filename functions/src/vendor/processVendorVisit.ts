import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createAuditLogEntry } from "../audit/logAuditEvent";
import { assertVendorActor, getAffiliationName, resolveRegistrationByScan } from "./shared";

export const processVendorVisit = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const { vendorId, confId, qrData, agreed, guestbookMessage } = data as {
        vendorId?: string;
        confId?: string;
        qrData?: string;
        agreed?: boolean;
        guestbookMessage?: string;
    };

    if (!vendorId || !confId || !qrData || typeof agreed !== "boolean") {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "vendorId, confId, qrData and agreed are required."
        );
    }

    const db = admin.firestore();
    const vendor = await assertVendorActor(db, vendorId, context.auth);
    const resolved = await resolveRegistrationByScan(db, confId, qrData);
    const conferenceSnap = await db.doc(`conferences/${confId}`).get();
    const conferenceFeatures = (conferenceSnap.data()?.features || {}) as {
        guestbookEnabled?: boolean;
        stampTourEnabled?: boolean;
    };

    const sponsorSnap = await db.doc(`conferences/${confId}/sponsors/${vendorId}`).get();
    const sponsorData = sponsorSnap.exists ? (sponsorSnap.data() as { isStampTourParticipant?: boolean }) : null;
    const now = admin.firestore.Timestamp.now();

    const visitorId = resolved.userId;
    const visitorName = resolved.userData?.name || resolved.regData?.userName || resolved.regData?.name || "Unknown";
    const visitorOrg = getAffiliationName(resolved.userData || {}, resolved.regData || {});
    const visitorPhone = resolved.userData?.phone || resolved.regData?.phone || resolved.regData?.userInfo?.phone || "";
    const visitorEmail = resolved.userData?.email || resolved.regData?.email || resolved.regData?.userInfo?.email || "";

    const leadRef = db.collection(`vendors/${vendorId}/leads`).doc(`${confId}_${visitorId}`);
    const stampRef = db.doc(`conferences/${confId}/stamps/${vendorId}_${visitorId}`);
    const guestbookRef = db.doc(`conferences/${confId}/guestbook_entries/${vendorId}_${visitorId}`);

    const guestbookText = (guestbookMessage || "").trim();

    const transactionResult = await db.runTransaction(async (tx) => {
        const leadSnap = await tx.get(leadRef);
        const stampSnap = await tx.get(stampRef);
        const guestbookSnap = await tx.get(guestbookRef);

        const existingLead = leadSnap.exists ? (leadSnap.data() as Record<string, any>) : null;
        const hasPreviousConsent = existingLead?.isConsentAgreed === true;

        tx.set(leadRef, {
            conferenceId: confId,
            visitorId,
            visitorName: agreed || hasPreviousConsent ? visitorName : "Anonymous (익명)",
            visitorOrg: agreed ? visitorOrg : (hasPreviousConsent ? existingLead?.visitorOrg : admin.firestore.FieldValue.delete()),
            visitorPhone: agreed ? visitorPhone : (hasPreviousConsent ? existingLead?.visitorPhone : admin.firestore.FieldValue.delete()),
            visitorEmail: agreed ? visitorEmail : (hasPreviousConsent ? existingLead?.visitorEmail : admin.firestore.FieldValue.delete()),
            timestamp: now,
            firstVisitedAt: existingLead?.firstVisitedAt || now,
            lastVisitedAt: now,
            visitCount: admin.firestore.FieldValue.increment(1),
            isConsentAgreed: agreed || hasPreviousConsent,
            consentStatus: "ACTIVE",
            retentionPeriodDays: (agreed || hasPreviousConsent) ? 1095 : 1825,
            updatedAt: now
        }, { merge: true });

        let stampGranted = false;
        if (conferenceFeatures.stampTourEnabled && sponsorData?.isStampTourParticipant === true && !stampSnap.exists) {
            tx.set(stampRef, {
                userId: visitorId,
                vendorId,
                vendorName: vendor.name,
                conferenceId: confId,
                timestamp: now,
                retentionPeriodDays: 730
            }, { merge: true });
            stampGranted = true;
        }

        let guestbookSaved = false;
        if (agreed && conferenceFeatures.guestbookEnabled) {
            tx.set(guestbookRef, {
                userId: visitorId,
                userName: visitorName,
                userOrg: visitorOrg,
                vendorId,
                vendorName: vendor.name,
                conferenceId: confId,
                leadId: leadRef.id,
                message: guestbookText || admin.firestore.FieldValue.delete(),
                timestamp: now,
                isConsentAgreed: true,
                updatedAt: now
            }, { merge: true });
            guestbookSaved = !guestbookSnap.exists || !!guestbookText || !!guestbookSnap.data()?.message;
        }

        return {
            leadId: leadRef.id,
            stampGranted,
            guestbookSaved,
            guestbookMessage: guestbookText
        };
    });

    await createAuditLogEntry({
        action: "LEAD_CREATED",
        entityType: "LEAD",
        entityId: transactionResult.leadId,
        vendorId,
        conferenceId: confId,
        details: {
            visitorId,
            isConsentAgreed: agreed,
            stampGranted: transactionResult.stampGranted,
            guestbookSaved: transactionResult.guestbookSaved
        },
        result: "SUCCESS",
        actorId: context.auth.uid,
        actorEmail: context.auth.token?.email,
        actorType: "VENDOR_ADMIN"
    });

    if (agreed) {
        await createAuditLogEntry({
            action: "CONSENT_GIVEN",
            entityType: "CONSENT",
            entityId: visitorId,
            vendorId,
            conferenceId: confId,
            details: { visitorId, vendorId },
            result: "SUCCESS",
            actorId: context.auth.uid,
            actorEmail: context.auth.token?.email,
            actorType: "VENDOR_ADMIN"
        });
    }

    if (transactionResult.stampGranted) {
        await createAuditLogEntry({
            action: "STAMP_CREATED",
            entityType: "STAMP",
            entityId: `${vendorId}_${visitorId}`,
            vendorId,
            conferenceId: confId,
            details: { visitorId, vendorId },
            result: "SUCCESS",
            actorId: context.auth.uid,
            actorEmail: context.auth.token?.email,
            actorType: "VENDOR_ADMIN"
        });
    }

    if (transactionResult.guestbookSaved) {
        await createAuditLogEntry({
            action: "GUESTBOOK_SIGN",
            entityType: "GUESTBOOK",
            entityId: `${vendorId}_${visitorId}`,
            vendorId,
            conferenceId: confId,
            details: {
                visitorId,
                hasMessage: !!transactionResult.guestbookMessage
            },
            result: "SUCCESS",
            actorId: context.auth.uid,
            actorEmail: context.auth.token?.email,
            actorType: "VENDOR_ADMIN"
        });
    }

    return {
        success: true,
        leadId: transactionResult.leadId,
        stampGranted: transactionResult.stampGranted,
        guestbookSaved: transactionResult.guestbookSaved,
        visitor: {
            id: visitorId,
            name: visitorName,
            organization: visitorOrg,
            phone: visitorPhone,
            email: visitorEmail
        }
    };
});
