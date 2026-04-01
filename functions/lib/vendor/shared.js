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
exports.buildScanResponse = exports.resolveRegistrationByScan = exports.getAffiliationName = exports.assertVendorActor = exports.normalizeScanCode = void 0;
const functions = __importStar(require("firebase-functions"));
const normalizeScanCode = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed)
        return "";
    if (trimmed.startsWith("BADGE-")) {
        return trimmed;
    }
    return trimmed
        .replace(/^VOUCHER-/, "")
        .replace(/^CONF-/, "");
};
exports.normalizeScanCode = normalizeScanCode;
const assertVendorActor = async (db, vendorId, auth) => {
    if (!auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    if (!vendorSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Vendor not found.");
    }
    const vendorData = vendorSnap.data();
    const email = auth.token.email;
    const isOwner = vendorData.ownerUid === auth.uid;
    const isAdmin = !!email && vendorData.adminEmail === email;
    const isStaff = !!email && Array.isArray(vendorData.staffEmails) && vendorData.staffEmails.includes(email);
    if (!isOwner && !isAdmin && !isStaff) {
        throw new functions.https.HttpsError("permission-denied", "Vendor access denied.");
    }
    return {
        id: vendorId,
        name: vendorData.name || vendorId,
        email
    };
};
exports.assertVendorActor = assertVendorActor;
const ensurePaidRegistration = (collectionName, regData) => {
    if (collectionName === "external_attendees") {
        return;
    }
    const paid = regData.paymentStatus === "PAID" || regData.status === "PAID";
    if (!paid) {
        throw new functions.https.HttpsError("failed-precondition", "Registration is not paid.");
    }
};
const loadConferenceUser = async (db, confId, userId) => {
    if (!userId || userId === "GUEST")
        return null;
    const userSnap = await db.doc(`conferences/${confId}/users/${userId}`).get();
    return userSnap.exists ? userSnap.data() : null;
};
const getAffiliationName = (userData, regData) => {
    var _a, _b;
    const affiliations = userData === null || userData === void 0 ? void 0 : userData.affiliations;
    if (Array.isArray(affiliations)) {
        const first = affiliations[0];
        if (first && typeof first === "object" && "name" in first && first.name) {
            return first.name;
        }
    }
    if (affiliations && typeof affiliations === "object") {
        const firstKey = Object.keys(affiliations)[0];
        const firstValue = firstKey ? affiliations[firstKey] : null;
        if (firstValue && typeof firstValue === "object" && "name" in firstValue && firstValue.name) {
            return firstValue.name;
        }
    }
    return ((userData === null || userData === void 0 ? void 0 : userData.affiliation) ||
        (userData === null || userData === void 0 ? void 0 : userData.organization) ||
        (regData === null || regData === void 0 ? void 0 : regData.affiliation) ||
        (regData === null || regData === void 0 ? void 0 : regData.organization) ||
        ((_a = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _a === void 0 ? void 0 : _a.affiliation) ||
        ((_b = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _b === void 0 ? void 0 : _b.organization) ||
        "");
};
exports.getAffiliationName = getAffiliationName;
const toScanPayload = (registrationId, regData, userData) => {
    var _a, _b, _c, _d, _e, _f, _g;
    return ({
        user: {
            id: (userData === null || userData === void 0 ? void 0 : userData.id) || (regData === null || regData === void 0 ? void 0 : regData.userId) || registrationId,
            name: (userData === null || userData === void 0 ? void 0 : userData.name) || (regData === null || regData === void 0 ? void 0 : regData.userName) || (regData === null || regData === void 0 ? void 0 : regData.name) || ((_a = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _a === void 0 ? void 0 : _a.name) || "Unknown",
            email: (userData === null || userData === void 0 ? void 0 : userData.email) || (regData === null || regData === void 0 ? void 0 : regData.email) || ((_b = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _b === void 0 ? void 0 : _b.email) || "",
            phone: (userData === null || userData === void 0 ? void 0 : userData.phone) || (regData === null || regData === void 0 ? void 0 : regData.phone) || ((_c = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _c === void 0 ? void 0 : _c.phone) || "",
            affiliation: (0, exports.getAffiliationName)(userData || {}, regData || {}),
            organization: (userData === null || userData === void 0 ? void 0 : userData.organization) || (regData === null || regData === void 0 ? void 0 : regData.organization) || ""
        },
        reg: {
            id: registrationId,
            userId: (regData === null || regData === void 0 ? void 0 : regData.userId) || registrationId,
            type: (regData === null || regData === void 0 ? void 0 : regData.type) || (regData === null || regData === void 0 ? void 0 : regData.category) || (regData === null || regData === void 0 ? void 0 : regData.tier) || (regData === null || regData === void 0 ? void 0 : regData.userTier) || "",
            category: (regData === null || regData === void 0 ? void 0 : regData.category) || (regData === null || regData === void 0 ? void 0 : regData.tier) || (regData === null || regData === void 0 ? void 0 : regData.userTier) || "",
            affiliation: (regData === null || regData === void 0 ? void 0 : regData.affiliation) || (regData === null || regData === void 0 ? void 0 : regData.organization) || ((_d = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _d === void 0 ? void 0 : _d.affiliation) || "",
            organization: (regData === null || regData === void 0 ? void 0 : regData.organization) || ((_e = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _e === void 0 ? void 0 : _e.organization) || "",
            email: (regData === null || regData === void 0 ? void 0 : regData.email) || ((_f = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _f === void 0 ? void 0 : _f.email) || "",
            phone: (regData === null || regData === void 0 ? void 0 : regData.phone) || ((_g = regData === null || regData === void 0 ? void 0 : regData.userInfo) === null || _g === void 0 ? void 0 : _g.phone) || "",
            collectionName: regData === null || regData === void 0 ? void 0 : regData.collectionName
        }
    });
};
const resolveRegistrationByScan = async (db, confId, qrData) => {
    var _a, _b, _c, _d, _e, _f;
    const normalized = (0, exports.normalizeScanCode)(qrData);
    if (!normalized) {
        throw new functions.https.HttpsError("invalid-argument", "Missing QR data.");
    }
    const registrationCollections = [
        "registrations",
        "external_attendees"
    ];
    if (normalized.startsWith("BADGE-")) {
        for (const collectionName of registrationCollections) {
            const badgeQuery = await db
                .collection(`conferences/${confId}/${collectionName}`)
                .where("badgeQr", "==", normalized)
                .limit(1)
                .get();
            if (!badgeQuery.empty) {
                const docSnap = badgeQuery.docs[0];
                const regData = docSnap.data();
                ensurePaidRegistration(collectionName, regData);
                const userId = regData.userId || docSnap.id;
                const userData = (await loadConferenceUser(db, confId, userId)) || {
                    id: userId,
                    name: regData.userName || regData.name || ((_a = regData.userInfo) === null || _a === void 0 ? void 0 : _a.name) || "Unknown",
                    email: regData.email || ((_b = regData.userInfo) === null || _b === void 0 ? void 0 : _b.email) || "",
                    phone: regData.phone || ((_c = regData.userInfo) === null || _c === void 0 ? void 0 : _c.phone) || "",
                    affiliation: (0, exports.getAffiliationName)({}, regData)
                };
                return {
                    collectionName,
                    registrationId: docSnap.id,
                    regData: { ...regData, collectionName },
                    userId,
                    userData
                };
            }
        }
    }
    for (const collectionName of registrationCollections) {
        const directSnap = await db.doc(`conferences/${confId}/${collectionName}/${normalized}`).get();
        if (!directSnap.exists)
            continue;
        const regData = directSnap.data();
        ensurePaidRegistration(collectionName, regData);
        const userId = regData.userId || directSnap.id;
        const userData = (await loadConferenceUser(db, confId, userId)) || {
            id: userId,
            name: regData.userName || regData.name || ((_d = regData.userInfo) === null || _d === void 0 ? void 0 : _d.name) || "Unknown",
            email: regData.email || ((_e = regData.userInfo) === null || _e === void 0 ? void 0 : _e.email) || "",
            phone: regData.phone || ((_f = regData.userInfo) === null || _f === void 0 ? void 0 : _f.phone) || "",
            affiliation: (0, exports.getAffiliationName)({}, regData)
        };
        return {
            collectionName,
            registrationId: directSnap.id,
            regData: { ...regData, collectionName },
            userId,
            userData
        };
    }
    throw new functions.https.HttpsError("not-found", "Scanned attendee could not be found.");
};
exports.resolveRegistrationByScan = resolveRegistrationByScan;
const buildScanResponse = (resolved) => {
    return toScanPayload(resolved.registrationId, resolved.regData, resolved.userData);
};
exports.buildScanResponse = buildScanResponse;
//# sourceMappingURL=shared.js.map