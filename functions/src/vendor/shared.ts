import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

type VendorDoc = {
    name?: string;
    ownerUid?: string;
    adminEmail?: string;
    staffEmails?: string[];
};

type ResolvedRegistration = {
    collectionName: "registrations" | "external_attendees";
    registrationId: string;
    regData: Record<string, any>;
    userId: string;
    userData: Record<string, any>;
};

export const normalizeScanCode = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("BADGE-")) {
        return trimmed;
    }

    return trimmed
        .replace(/^VOUCHER-/, "")
        .replace(/^CONF-/, "");
};

export const assertVendorActor = async (
    db: admin.firestore.Firestore,
    vendorId: string,
    auth: functions.https.CallableContext["auth"]
) => {
    if (!auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    if (!vendorSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Vendor not found.");
    }

    const vendorData = vendorSnap.data() as VendorDoc;
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

const ensurePaidRegistration = (
    collectionName: "registrations" | "external_attendees",
    regData: Record<string, any>
) => {
    if (collectionName === "external_attendees") {
        return;
    }

    const paid = regData.paymentStatus === "PAID" || regData.status === "PAID";
    if (!paid) {
        throw new functions.https.HttpsError("failed-precondition", "Registration is not paid.");
    }
};

const loadConferenceUser = async (
    db: admin.firestore.Firestore,
    confId: string,
    userId: string
) => {
    if (!userId || userId === "GUEST") return null;

    const userSnap = await db.doc(`conferences/${confId}/users/${userId}`).get();
    return userSnap.exists ? (userSnap.data() as Record<string, any>) : null;
};

export const getAffiliationName = (userData: Record<string, any>, regData: Record<string, any>) => {
    const affiliations = userData?.affiliations;
    if (Array.isArray(affiliations)) {
        const first = affiliations[0];
        if (first && typeof first === "object" && "name" in first && first.name) {
            return first.name as string;
        }
    }

    if (affiliations && typeof affiliations === "object") {
        const firstKey = Object.keys(affiliations)[0];
        const firstValue = firstKey ? affiliations[firstKey] : null;
        if (firstValue && typeof firstValue === "object" && "name" in firstValue && firstValue.name) {
            return firstValue.name as string;
        }
    }

    return (
        userData?.affiliation ||
        userData?.organization ||
        regData?.affiliation ||
        regData?.organization ||
        regData?.userInfo?.affiliation ||
        regData?.userInfo?.organization ||
        ""
    );
};

const toScanPayload = (registrationId: string, regData: Record<string, any>, userData: Record<string, any>) => ({
    user: {
        id: userData?.id || regData?.userId || registrationId,
        name: userData?.name || regData?.userName || regData?.name || regData?.userInfo?.name || "Unknown",
        email: userData?.email || regData?.email || regData?.userInfo?.email || "",
        phone: userData?.phone || regData?.phone || regData?.userInfo?.phone || "",
        affiliation: getAffiliationName(userData || {}, regData || {}),
        organization: userData?.organization || regData?.organization || ""
    },
    reg: {
        id: registrationId,
        userId: regData?.userId || registrationId,
        type: regData?.type || regData?.category || regData?.tier || regData?.userTier || "",
        category: regData?.category || regData?.tier || regData?.userTier || "",
        affiliation: regData?.affiliation || regData?.organization || regData?.userInfo?.affiliation || "",
        organization: regData?.organization || regData?.userInfo?.organization || "",
        email: regData?.email || regData?.userInfo?.email || "",
        phone: regData?.phone || regData?.userInfo?.phone || "",
        collectionName: regData?.collectionName
    }
});

export const resolveRegistrationByScan = async (
    db: admin.firestore.Firestore,
    confId: string,
    qrData: string
): Promise<ResolvedRegistration> => {
    const normalized = normalizeScanCode(qrData);
    if (!normalized) {
        throw new functions.https.HttpsError("invalid-argument", "Missing QR data.");
    }

    const registrationCollections: Array<"registrations" | "external_attendees"> = [
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
                const regData = docSnap.data() as Record<string, any>;
                ensurePaidRegistration(collectionName, regData);
                const userId = regData.userId || docSnap.id;
                const userData = (await loadConferenceUser(db, confId, userId)) || {
                    id: userId,
                    name: regData.userName || regData.name || regData.userInfo?.name || "Unknown",
                    email: regData.email || regData.userInfo?.email || "",
                    phone: regData.phone || regData.userInfo?.phone || "",
                    affiliation: getAffiliationName({}, regData)
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
        if (!directSnap.exists) continue;

        const regData = directSnap.data() as Record<string, any>;
        ensurePaidRegistration(collectionName, regData);
        const userId = regData.userId || directSnap.id;
        const userData = (await loadConferenceUser(db, confId, userId)) || {
            id: userId,
            name: regData.userName || regData.name || regData.userInfo?.name || "Unknown",
            email: regData.email || regData.userInfo?.email || "",
            phone: regData.phone || regData.userInfo?.phone || "",
            affiliation: getAffiliationName({}, regData)
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

export const buildScanResponse = (resolved: ResolvedRegistration) => {
    return toScanPayload(resolved.registrationId, resolved.regData, resolved.userData);
};
