import { useState } from 'react';
import { collection, query, where, getDocs, updateDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
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
            // Parse JSON: { type: 'CONFIRM', regId, userId, t }
            let parsed;
            try {
                parsed = JSON.parse(qrData);
            } catch (e) {
                // If not JSON, maybe it's raw regId or invalid
                // Assume it might be raw string if dev, but strict protocol says JSON
                throw new Error("Invalid QR Format. Not a Confirmation QR.");
            }

            if (parsed.type !== 'CONFIRM') {
                 throw new Error("Wrong QR Type. This is not a Confirmation QR.");
            }

            const regRef = doc(db, `conferences/${conferenceId}/registrations/${parsed.regId}`);
            const regSnap = await getDoc(regRef);

            if (!regSnap.exists()) {
                throw new Error("Registration not found.");
            }

            const regData = regSnap.data() as Registration;

            // Fetch User for details
            const userRef = doc(db, `conferences/${conferenceId}/users/${regData.userId}`);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data() as ConferenceUser;

            setScannedReg(regData);
            setScannedUser(userData);
            setStatus({ loading: false, error: null, message: "Registration Found. Ready to Issue Badge." });

        } catch (err: any) {
            setStatus({ loading: false, error: err.message, message: null });
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
            
            // Update local state
            setScannedReg({ ...scannedReg, badgeQr, isCheckedIn: true });

        } catch (err: any) {
            setStatus({ loading: false, error: err.message, message: null });
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
