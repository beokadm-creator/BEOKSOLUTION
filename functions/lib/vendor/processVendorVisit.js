"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVendorVisit = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const logAuditEvent_1 = require("../audit/logAuditEvent");
const shared_1 = require("./shared");
exports.processVendorVisit = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const { vendorId, confId, qrData, agreed, guestbookMessage } = data;
    if (!vendorId || !confId || !qrData || typeof agreed !== "boolean") {
        throw new functions.https.HttpsError("invalid-argument", "vendorId, confId, qrData and agreed are required.");
    }
    const db = admin.firestore();
    const vendor = await (0, shared_1.assertVendorActor)(db, vendorId, context.auth);
    const resolved = await (0, shared_1.resolveRegistrationByScan)(db, confId, qrData);
    const conferenceSnap = await db.doc(`conferences/${confId}`).get();
    const conferenceFeatures = (((_a = conferenceSnap.data()) === null || _a === void 0 ? void 0 : _a.features) || {});
    const sponsorSnap = await db.doc(`conferences/${confId}/sponsors/${vendorId}`).get();
    const sponsorData = sponsorSnap.exists ? sponsorSnap.data() : null;
    const now = admin.firestore.Timestamp.now();
    const visitorId = resolved.userId;
    const visitorName = ((_b = resolved.userData) === null || _b === void 0 ? void 0 : _b.name) || ((_c = resolved.regData) === null || _c === void 0 ? void 0 : _c.userName) || ((_d = resolved.regData) === null || _d === void 0 ? void 0 : _d.name) || "Unknown";
    const visitorOrg = (0, shared_1.getAffiliationName)(resolved.userData || {}, resolved.regData || {});
    const visitorPhone = ((_e = resolved.userData) === null || _e === void 0 ? void 0 : _e.phone) || ((_f = resolved.regData) === null || _f === void 0 ? void 0 : _f.phone) || ((_h = (_g = resolved.regData) === null || _g === void 0 ? void 0 : _g.userInfo) === null || _h === void 0 ? void 0 : _h.phone) || "";
    const visitorEmail = ((_j = resolved.userData) === null || _j === void 0 ? void 0 : _j.email) || ((_k = resolved.regData) === null || _k === void 0 ? void 0 : _k.email) || ((_m = (_l = resolved.regData) === null || _l === void 0 ? void 0 : _l.userInfo) === null || _m === void 0 ? void 0 : _m.email) || "";
    const leadRef = db.collection(`vendors/${vendorId}/leads`).doc(`${confId}_${visitorId}`);
    const stampRef = db.doc(`conferences/${confId}/stamps/${vendorId}_${visitorId}`);
    const guestbookRef = db.doc(`conferences/${confId}/guestbook_entries/${vendorId}_${visitorId}`);
    const guestbookText = (guestbookMessage || "").trim();
    const transactionResult = await db.runTransaction(async (tx) => {
        var _a;
        const leadSnap = await tx.get(leadRef);
        const stampSnap = await tx.get(stampRef);
        const guestbookSnap = await tx.get(guestbookRef);
        const existingLead = leadSnap.exists ? leadSnap.data() : null;
        const hasPreviousConsent = (existingLead === null || existingLead === void 0 ? void 0 : existingLead.isConsentAgreed) === true;
        tx.set(leadRef, {
            conferenceId: confId,
            visitorId,
            visitorName: agreed || hasPreviousConsent ? visitorName : "Anonymous (익명)",
            visitorOrg: agreed ? visitorOrg : (hasPreviousConsent ? existingLead === null || existingLead === void 0 ? void 0 : existingLead.visitorOrg : admin.firestore.FieldValue.delete()),
            visitorPhone: agreed ? visitorPhone : (hasPreviousConsent ? existingLead === null || existingLead === void 0 ? void 0 : existingLead.visitorPhone : admin.firestore.FieldValue.delete()),
            visitorEmail: agreed ? visitorEmail : (hasPreviousConsent ? existingLead === null || existingLead === void 0 ? void 0 : existingLead.visitorEmail : admin.firestore.FieldValue.delete()),
            timestamp: now,
            firstVisitedAt: (existingLead === null || existingLead === void 0 ? void 0 : existingLead.firstVisitedAt) || now,
            lastVisitedAt: now,
            visitCount: admin.firestore.FieldValue.increment(1),
            isConsentAgreed: agreed || hasPreviousConsent,
            consentStatus: "ACTIVE",
            retentionPeriodDays: (agreed || hasPreviousConsent) ? 1095 : 1825,
            updatedAt: now
        }, { merge: true });
        let stampGranted = false;
        if (conferenceFeatures.stampTourEnabled && (sponsorData === null || sponsorData === void 0 ? void 0 : sponsorData.isStampTourParticipant) === true && !stampSnap.exists) {
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
            guestbookSaved = !guestbookSnap.exists || !!guestbookText || !!((_a = guestbookSnap.data()) === null || _a === void 0 ? void 0 : _a.message);
        }
        return {
            leadId: leadRef.id,
            stampGranted,
            guestbookSaved,
            guestbookMessage: guestbookText
        };
    });
    await (0, logAuditEvent_1.createAuditLogEntry)({
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
        actorEmail: (_o = context.auth.token) === null || _o === void 0 ? void 0 : _o.email,
        actorType: "VENDOR_ADMIN"
    });
    if (agreed) {
        await (0, logAuditEvent_1.createAuditLogEntry)({
            action: "CONSENT_GIVEN",
            entityType: "CONSENT",
            entityId: visitorId,
            vendorId,
            conferenceId: confId,
            details: { visitorId, vendorId },
            result: "SUCCESS",
            actorId: context.auth.uid,
            actorEmail: (_p = context.auth.token) === null || _p === void 0 ? void 0 : _p.email,
            actorType: "VENDOR_ADMIN"
        });
    }
    if (transactionResult.stampGranted) {
        await (0, logAuditEvent_1.createAuditLogEntry)({
            action: "STAMP_CREATED",
            entityType: "STAMP",
            entityId: `${vendorId}_${visitorId}`,
            vendorId,
            conferenceId: confId,
            details: { visitorId, vendorId },
            result: "SUCCESS",
            actorId: context.auth.uid,
            actorEmail: (_q = context.auth.token) === null || _q === void 0 ? void 0 : _q.email,
            actorType: "VENDOR_ADMIN"
        });
    }
    if (transactionResult.guestbookSaved) {
        await (0, logAuditEvent_1.createAuditLogEntry)({
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
            actorEmail: (_r = context.auth.token) === null || _r === void 0 ? void 0 : _r.email,
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
//# sourceMappingURL=processVendorVisit.js.map