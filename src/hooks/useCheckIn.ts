import { useState } from 'react';
import { updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Registration, ConferenceUser, ConferenceInfo } from '../types/schema';
import { generateBadgeQr } from '../utils/transaction';
import { printBadge } from '../utils/printer';

export const useCheckIn = (conferenceId: string) => {
    const [status, setStatus] = useState<{ loading: boolean; error: string | null; message: string | null }>({
        loading: false,
        error: null,
        message: null
    });

    const [scannedReg, setScannedReg] = useState<Registration | null>(null);
    const [scannedUser, setScannedUser] = useState<ConferenceUser | null>(null);

    // 1. Scan Confirmation QR
    const scanConfirmationQr = async (qrData: string) => {
        setStatus({ loading: true, error: null, message: null });
        setScannedReg(null);
        setScannedUser(null);

        try {
            // [Modified] Support CONF- prefix
            let targetRegId = qrData;

            if (qrData.startsWith('CONF-')) {
                targetRegId = qrData.replace('CONF-', '');
            } else {
                try {
                    const parsed = JSON.parse(qrData);
                    if (parsed.type === 'CONFIRM' && parsed.regId) targetRegId = parsed.regId;
                } catch {
                    // JSON parsing failed, continue with original qrData
                }
            }

            if (!targetRegId) throw new Error("유효하지 않은 QR 코드입니다.");

            console.log('[useCheckIn] Scanning QR:', { qrData, targetRegId });

            // CRITICAL FIX: Try to find registration by document ID first
            const regRef = doc(db, `conferences/${conferenceId}/registrations/${targetRegId}`);
            let regSnap = await getDoc(regRef);

            // If not found by document ID, try to find by confirmationQr field
            if (!regSnap.exists()) {
                console.log('[useCheckIn] Not found by doc ID, searching by confirmationQr field');
                const { query, where, collection, getDocs } = await import('firebase/firestore');
                const q = query(
                    collection(db, `conferences/${conferenceId}/registrations`),
                    where('confirmationQr', '==', targetRegId)
                );
                const querySnap = await getDocs(q);

                if (querySnap.empty) {
                    throw new Error("등록 정보를 찾을 수 없습니다.");
                }

                // Use the first matching registration
                regSnap = querySnap.docs[0];
                console.log('[useCheckIn] Found by confirmationQr:', regSnap.id);
            } else {
                console.log('[useCheckIn] Found by doc ID:', regSnap.id);
            }

            const regData = { ...regSnap.data(), id: regSnap.id } as Registration;

            const userRef = doc(db, `conferences/${conferenceId}/users/${regData.userId}`);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data() as ConferenceUser;

            setScannedReg(regData);
            setScannedUser(userData);
            setStatus({ loading: false, error: null, message: "Registration Found. Ready to Issue Badge." });

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setStatus({ loading: false, error: message, message: null });
        }
    };

    // 2. Issue Badge (Transition)
    const issueBadge = async () => {
        if (!scannedReg || !scannedUser) return;
        setStatus({ loading: true, error: null, message: "Issuing Badge..." });

        try {
            // Check if already checked in?
            // If already checked in, we might be re-issuing (Reprint)
            // But if badgeQr is null, it's first time.

            let badgeQr = scannedReg.badgeQr;
            let isNewIssue = false;

            if (!badgeQr) {
                // Generate NEW Badge QR (UUID)
                badgeQr = generateBadgeQr();
                isNewIssue = true;
            }

            // Update Registration
            const regRef = doc(db, `conferences/${conferenceId}/registrations/${scannedReg.id}`);
            await updateDoc(regRef, {
                badgeQr: badgeQr,
                isCheckedIn: true,
                checkInTime: scannedReg.checkInTime || Timestamp.now(), // Keep original time if reprint
                updatedAt: Timestamp.now()
            });

            // Trigger Printing
            // Fetch badge layout from config
            const infoRef = doc(db, `conferences/${conferenceId}/info/general`);
            const infoSnap = await getDoc(infoRef);
            const infoData = infoSnap.data() as ConferenceInfo; // Need to cast safely

            if (infoData && infoData.badgeLayout) {
                await printBadge(infoData.badgeLayout, {
                    name: scannedUser.name,
                    organization: 'Member', // TODO: Add org to user schema or tier
                    badgeQr: badgeQr
                });
            } else {
                console.warn("No badge layout found, skipping print simulation.");
            }

            // Mock Sending Notification
            if (isNewIssue) {
                console.log(`[Notification] Sending Digital Badge URL to ${scannedUser.phone || scannedUser.email}`);
            }

            setStatus({ loading: false, error: null, message: `Badge ${isNewIssue ? 'Issued' : 'Reprinted'} Successfully!` });

            setScannedReg({ ...scannedReg, badgeQr, isCheckedIn: true });

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setStatus({ loading: false, error: message, message: null });
        }
    };

    return {
        status,
        scannedReg,
        scannedUser,
        scanConfirmationQr,
        issueBadge
    };
};
