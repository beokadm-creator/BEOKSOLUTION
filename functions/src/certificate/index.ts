import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

type CertificateSourceType = 'registration' | 'external_attendee';

type AdminRole = 'SUPER_ADMIN' | 'CONFERENCE_ADMIN';

interface AttendeeData {
  name: string;
  email?: string;
  organization?: string;
  affiliation?: string;
  userInfo?: { name?: string; email?: string; affiliation?: string };
}

interface AdminActor {
  uid: string;
  email: string | null;
  role: AdminRole;
}

function generateVerificationToken(): string {
  return `crt_${crypto.randomBytes(24).toString('base64url')}`;
}

async function resolveAttendee(
  db: admin.firestore.Firestore,
  confId: string,
  regId: string
): Promise<{ data: AttendeeData; sourceType: CertificateSourceType } | null> {
  let snap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();
  if (snap.exists) {
    return { data: snap.data() as AttendeeData, sourceType: 'registration' };
  }

  snap = await db.collection(`conferences/${confId}/external_attendees`).doc(regId).get();
  if (snap.exists) {
    return { data: snap.data() as AttendeeData, sourceType: 'external_attendee' };
  }

  return null;
}

function extractAttendeeFields(data: AttendeeData) {
  return {
    name: data.name || data.userInfo?.name || '',
    email: data.email || data.userInfo?.email,
    organization: data.organization || data.affiliation || data.userInfo?.affiliation,
  };
}

/**
 * Authorization check following the same pattern as assertStampTourAdmin.
 * Super admins (token.admin or token.super) are always allowed.
 * Otherwise, the caller must exist in conferences/{confId}/admins/{email}.
 */
async function assertCertificateAdmin(
  db: admin.firestore.Firestore,
  confId: string,
  auth: functions.https.CallableContext['auth']
): Promise<AdminActor> {
  if (!auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const email = auth.token.email;
  const isSuper = auth.token.admin === true || auth.token.super === true;
  if (isSuper) {
    return { uid: auth.uid, email: email || null, role: 'SUPER_ADMIN' };
  }

  if (!email) {
    throw new functions.https.HttpsError('permission-denied', 'Admin email not found');
  }

  const adminSnap = await db.doc(`conferences/${confId}/admins/${email}`).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Conference admin access denied');
  }

  return { uid: auth.uid, email, role: 'CONFERENCE_ADMIN' };
}

async function resolveRegIdFromBadgeToken(
  db: admin.firestore.Firestore,
  confId: string,
  token: string
): Promise<string | null> {
  const tokenSnap = await db.collection(`conferences/${confId}/badge_tokens`).doc(token).get();
  if (!tokenSnap.exists) return null;

  const tokenData = tokenSnap.data();
  if (!tokenData) return null;

  const now = admin.firestore.Timestamp.now();
  if (tokenData.expiresAt && tokenData.expiresAt.toMillis() < now.toMillis()) return null;
  if (tokenData.status !== 'ACTIVE' && tokenData.status !== 'ISSUED') return null;

  return tokenData.registrationId || null;
}

/**
 * Security: enforce checked-in eligibility for non-admin certificate issuance.
 * Admins can issue regardless (e.g. post-event bulk issuance).
 */
async function assertCheckedIn(
  db: admin.firestore.Firestore,
  confId: string,
  regId: string
): Promise<void> {
  let snap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();
  if (!snap.exists) {
    snap = await db.collection(`conferences/${confId}/external_attendees`).doc(regId).get();
  }
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Registration not found');
  }

  const data = snap.data();
  if (!data) {
    throw new functions.https.HttpsError('not-found', 'Registration data invalid');
  }

  if (!data.isCheckedIn && !data.badgeIssued) {
    throw new functions.https.HttpsError('failed-precondition', 'Attendee must be checked in before certificate issuance');
  }
}

/**
 * Authorization result describing how the caller is allowed to issue.
 */
type IssueAuthResult =
  | { mode: 'ADMIN'; actor: AdminActor }
  | { mode: 'OWNER'; uid: string }
  | { mode: 'BADGE_TOKEN'; token: string };

async function resolveIssueAuthorization(
  db: admin.firestore.Firestore,
  confId: string,
  regId: string | undefined,
  badgeToken: string | undefined,
  auth: functions.https.CallableContext['auth']
): Promise<IssueAuthResult> {
  // Path 1: Badge token — self-service, no auth required
  if (badgeToken) {
    const resolvedRegId = await resolveRegIdFromBadgeToken(db, confId, badgeToken);
    if (!resolvedRegId) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid or expired badge token');
    }
    if (regId && resolvedRegId !== regId) {
      throw new functions.https.HttpsError('permission-denied', 'Badge token does not match requested registration');
    }
    return { mode: 'BADGE_TOKEN', token: badgeToken };
  }

  // Path 2: Authenticated owner — self-service via Firebase Auth
  if (auth && regId) {
    const attendee = await resolveAttendee(db, confId, regId);
    if (attendee) {
      const attendeeUserId = (attendee.data as { userId?: string }).userId;
      if (attendeeUserId && attendeeUserId !== 'GUEST' && attendeeUserId === auth.uid) {
        return { mode: 'OWNER', uid: auth.uid };
      }
    }
  }

  // Path 3: Admin — existing behavior
  const adminActor = await assertCertificateAdmin(db, confId, auth);
  return { mode: 'ADMIN', actor: adminActor };
}

export const issueCertificate = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL',
  })
  .https.onCall(async (data, context) => {
    const { confId, regId, badgeToken, allowBeforeCheckIn } = data;
    if (!confId || !regId) {
      throw new functions.https.HttpsError('invalid-argument', 'confId and regId are required');
    }

    const db = admin.firestore();

  const authResult = await resolveIssueAuthorization(db, confId, regId, badgeToken, context.auth);

  if (authResult.mode !== 'ADMIN') {
    const canBypassCheckIn = authResult.mode === 'OWNER' && allowBeforeCheckIn === true;
    if (canBypassCheckIn) {
      const [confSnap, attendee] = await Promise.all([
        db.collection('conferences').doc(confId).get(),
        resolveAttendee(db, confId, regId),
      ]);
      const features = confSnap.data()?.features as Record<string, unknown> | undefined;
      const certEnabled = !!features?.certificateEnabled;
      const reg = attendee?.data as Record<string, unknown> | undefined;
      const status = String(reg?.status || '');
      const paymentStatus = String(reg?.paymentStatus || '');
      const paid = status === 'PAID' || paymentStatus === 'PAID';
      if (!certEnabled || !paid) {
        throw new functions.https.HttpsError('failed-precondition', 'Certificate not available');
      }
    } else {
      await assertCheckedIn(db, confId, regId);
    }
  }

    const attendee = await resolveAttendee(db, confId, regId);
    if (!attendee) {
      throw new functions.https.HttpsError('not-found', 'Registration or external attendee not found');
    }

    const fields = extractAttendeeFields(attendee.data);
    if (!fields.name) {
      throw new functions.https.HttpsError('failed-precondition', 'Attendee name is required for certificate issuance');
    }

    try {
      const certsCollection = db.collection(`conferences/${confId}/certificates`);

      const result = await db.runTransaction(async (tx) => {
        const existingSnap = await tx.get(
          certsCollection.where('sourceId', '==', regId).where('status', '==', 'ISSUED').limit(1)
        );

        if (!existingSnap.empty) {
          const existing = existingSnap.docs[0].data();
          return {
            success: true as const,
            certificateId: existingSnap.docs[0].id,
            certificateNumber: existing.certificateNumber,
            verificationToken: existing.verificationToken,
            message: 'Certificate already issued' as const,
          };
        }

        const now = admin.firestore.Timestamp.now();
        const verificationToken = generateVerificationToken();

        const certRef = certsCollection.doc();
        const certId = certRef.id;

        tx.set(certRef, {
          id: certId,
          conferenceId: confId,
          sourceType: attendee.sourceType,
          sourceId: regId,
          certificateNumber: '__PENDING__',
          verificationToken,
          attendeeName: fields.name,
          attendeeEmail: fields.email,
          attendeeOrganization: fields.organization,
          status: 'ISSUED',
          issuedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        return {
          certId,
          certRef,
          verificationToken,
          now,
          isNew: true as const,
          attendee,
          fields,
        };
      });

      if ('message' in result && result.message === 'Certificate already issued') {
        return result;
      }

      const r = result as { certId: string; certRef: admin.firestore.DocumentReference; verificationToken: string; now: admin.firestore.Timestamp; isNew: boolean; attendee: { sourceType: CertificateSourceType }; fields: { name: string } };

      const counterRef = db.doc(`conferences/${confId}/settings/certificate_counter`);
      const certificateNumber = await db.runTransaction(async (tx) => {
        const counterSnap = await tx.get(counterRef);
        let nextNum: number;

        if (counterSnap.exists) {
          const current = counterSnap.data();
          nextNum = current?.nextSerialNumber || 1;
        } else {
          nextNum = 1;
        }

        tx.set(counterRef, {
          id: 'certificate_counter',
          nextSerialNumber: nextNum + 1,
          updatedAt: r.now,
        }, { merge: true });

        const num = `CERT-${String(nextNum).padStart(4, '0')}`;
        tx.update(r.certRef, { certificateNumber: num });
        return num;
      });

      const logCollectionName = r.attendee.sourceType === 'external_attendee'
        ? 'external_attendees'
        : 'registrations';

      const logMethod = authResult.mode === 'ADMIN' ? 'ADMIN_CALLABLE'
        : authResult.mode === 'OWNER' ? 'SELF_SERVICE'
        : 'BADGE_TOKEN_SELF_SERVICE';

      const logEntry: Record<string, unknown> = {
        type: 'CERTIFICATE_ISSUED',
        timestamp: r.now,
        certificateId: r.certId,
        certificateNumber,
        method: logMethod,
      };

      if (authResult.mode === 'ADMIN') {
        logEntry.adminUid = authResult.actor.uid;
        logEntry.adminEmail = authResult.actor.email;
      } else if (authResult.mode === 'OWNER') {
        logEntry.ownerUid = authResult.uid;
      } else {
        logEntry.badgeToken = authResult.token;
      }

      await db.collection(`conferences/${confId}/${logCollectionName}/${regId}/logs`).add(logEntry);

      functions.logger.info(`[Certificate] Issued ${certificateNumber} for ${regId} (${r.attendee.sourceType}) via ${logMethod}`);

      return {
        success: true,
        certificateId: r.certId,
        certificateNumber,
        verificationToken: r.verificationToken,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      functions.logger.error('[Certificate] Issue failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to issue certificate';
      throw new functions.https.HttpsError('internal', errorMessage);
    }
  });

async function resolveCertificateNumber(
  db: admin.firestore.Firestore,
  confId: string,
  certId: string
): Promise<string | null> {
  const snap = await db.doc(`conferences/${confId}/certificates/${certId}`).get();
  if (!snap.exists) return null;
  return snap.data()?.certificateNumber || null;
}

async function lookupCertificateByToken(
  db: admin.firestore.Firestore,
  token: string
): Promise<Record<string, unknown>> {
  const certsSnap = await db.collectionGroup('certificates')
    .where('verificationToken', '==', token)
    .limit(1)
    .get();

  if (certsSnap.empty) {
    return { valid: false, error: 'NOT_FOUND' };
  }

  const cert = certsSnap.docs[0].data();

  if (cert.status === 'REVOKED') {
    return {
      valid: false,
      error: 'REVOKED',
      certificateNumber: cert.certificateNumber,
      attendeeName: cert.attendeeName,
      revokedAt: cert.revokedAt,
      revokeReason: cert.revokeReason,
    };
  }

  if (cert.status === 'REISSUED') {
    return {
      valid: false,
      error: 'SUPERSEDED',
      certificateNumber: cert.certificateNumber,
      attendeeName: cert.attendeeName,
      supersededAt: cert.reissuedAt,
      replacementCertificateNumber: cert.supersededById
        ? await resolveCertificateNumber(db, cert.conferenceId, cert.supersededById)
        : null,
    };
  }

  const confSnap = await db.collection('conferences').doc(cert.conferenceId).get();
  const conference = confSnap.data();

  return {
    valid: true,
    certificateNumber: cert.certificateNumber,
    conferenceTitle: conference?.title?.ko || conference?.title?.en || '',
    attendeeName: cert.attendeeName,
    attendeeOrganization: cert.attendeeOrganization,
    issuedAt: cert.issuedAt,
  };
}

export const verifyCertificate = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL',
  })
  .https.onCall(async (data) => {
    const { token } = data;
    if (!token) {
      throw new functions.https.HttpsError('invalid-argument', 'Verification token is required');
    }

    const db = admin.firestore();

    try {
      return await lookupCertificateByToken(db, token);
    } catch (error) {
      functions.logger.error('[Certificate] Verification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      throw new functions.https.HttpsError('internal', errorMessage);
    }
  });

export const verifyCertificatePublic = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL',
  })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ valid: false, error: 'METHOD_NOT_ALLOWED' });
      return;
    }

    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ valid: false, error: 'MISSING_TOKEN' });
      return;
    }

    const db = admin.firestore();

    try {
      const result = await lookupCertificateByToken(db, token);
      res.status(result.valid ? 200 : 200).json(result);
    } catch (error) {
      functions.logger.error('[Certificate] Public verification failed:', error);
      res.status(500).json({ valid: false, error: 'INTERNAL_ERROR' });
    }
  });

export const revokeCertificate = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL',
  })
  .https.onCall(async (data, context) => {
    const { confId, certificateId, reason } = data;
    if (!confId || !certificateId) {
      throw new functions.https.HttpsError('invalid-argument', 'confId and certificateId are required');
    }

    const db = admin.firestore();

    const adminActor = await assertCertificateAdmin(db, confId, context.auth);

    const now = admin.firestore.Timestamp.now();

    try {
      const certRef = db.doc(`conferences/${confId}/certificates/${certificateId}`);
      const certSnap = await certRef.get();

      if (!certSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Certificate not found');
      }

      const cert = certSnap.data();
      if (cert?.status === 'REVOKED') {
        throw new functions.https.HttpsError('failed-precondition', 'Certificate is already revoked');
      }
      if (cert?.status === 'REISSUED') {
        throw new functions.https.HttpsError('failed-precondition', 'Certificate has been reissued; revoke the replacement instead');
      }

      await certRef.update({
        status: 'REVOKED',
        revokedAt: now,
        revokedBy: adminActor.uid,
        revokeReason: reason || null,
        updatedAt: now,
      });

      const logCollectionName = cert?.sourceType === 'external_attendee'
        ? 'external_attendees'
        : 'registrations';
      await db.collection(`conferences/${confId}/${logCollectionName}/${cert?.sourceId}/logs`).add({
        type: 'CERTIFICATE_REVOKED',
        timestamp: now,
        certificateId,
        certificateNumber: cert?.certificateNumber,
        revokedBy: adminActor.uid,
        revokedByEmail: adminActor.email,
        reason,
        method: 'ADMIN_CALLABLE',
      });

      functions.logger.info(`[Certificate] Revoked ${cert?.certificateNumber} by ${adminActor.role} ${adminActor.uid}`);

      return { success: true, certificateId, status: 'REVOKED' };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      functions.logger.error('[Certificate] Revoke failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke certificate';
      throw new functions.https.HttpsError('internal', errorMessage);
    }
  });

export const logCertificateDownload = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL',
  })
  .https.onCall(async (data, context) => {
    const { confId, certificateId, badgeToken } = data;
    if (!confId || !certificateId) {
      throw new functions.https.HttpsError('invalid-argument', 'confId and certificateId are required');
    }

    const db = admin.firestore();

    const certRef = db.doc(`conferences/${confId}/certificates/${certificateId}`);
    const certSnap = await certRef.get();
    if (!certSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Certificate not found');
    }

    const cert = certSnap.data();
    if (!cert || cert.status === 'REVOKED') {
      throw new functions.https.HttpsError('failed-precondition', 'Certificate is revoked and cannot be downloaded');
    }

    let method: string;
    let callerUid: string | undefined;
    let callerEmail: string | undefined;

    if (badgeToken) {
      const resolvedRegId = await resolveRegIdFromBadgeToken(db, confId, badgeToken);
      if (!resolvedRegId || resolvedRegId !== cert.sourceId) {
        throw new functions.https.HttpsError('permission-denied', 'Badge token does not match certificate owner');
      }
      method = 'BADGE_TOKEN';
    } else if (context.auth) {
      const attendee = await resolveAttendee(db, confId, cert.sourceId);
      const attendeeUserId = (attendee?.data as { userId?: string })?.userId;
      const isSuper = context.auth.token.admin === true || context.auth.token.super === true;

      if (isSuper || (await isAdminForConference(db, confId, context.auth))) {
        method = 'ADMIN';
        callerUid = context.auth.uid;
        callerEmail = context.auth.token.email;
      } else if (attendeeUserId && attendeeUserId !== 'GUEST' && attendeeUserId === context.auth.uid) {
        method = 'OWNER';
        callerUid = context.auth.uid;
        callerEmail = context.auth.token.email;
      } else {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to log this download');
      }
    } else {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication or badge token required');
    }

    const now = admin.firestore.Timestamp.now();

    try {
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(certRef);
        const freshData = freshSnap.data();
        const currentCount = freshData?.downloadCount || 0;

        tx.update(certRef, {
          downloadCount: currentCount + 1,
          updatedAt: now,
        });
      });

      await certRef.collection('download_logs').add({
        downloadedAt: now,
        method,
        callerUid: callerUid || null,
        callerEmail: callerEmail || null,
        userAgent: (context.rawRequest as { headers?: { 'user-agent'?: string } })?.headers?.['user-agent'] || null,
      });

      functions.logger.info(`[Certificate] Download logged for ${cert.certificateNumber} via ${method}`);

      return { success: true, downloadCount: (cert.downloadCount || 0) + 1 };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      functions.logger.error('[Certificate] Download log failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to log download';
      throw new functions.https.HttpsError('internal', errorMessage);
    }
  });

async function isAdminForConference(
  db: admin.firestore.Firestore,
  confId: string,
  auth: functions.https.CallableContext['auth']
): Promise<boolean> {
  if (!auth) return false;
  if (auth.token.admin === true || auth.token.super === true) return true;
  const email = auth.token.email;
  if (!email) return false;
  const adminSnap = await db.doc(`conferences/${confId}/admins/${email}`).get();
  return adminSnap.exists;
}

export const reissueCertificate = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL',
  })
  .https.onCall(async (data, context) => {
    const { confId, certificateId, reason } = data;
    if (!confId || !certificateId) {
      throw new functions.https.HttpsError('invalid-argument', 'confId and certificateId are required');
    }

    const db = admin.firestore();

    const adminActor = await assertCertificateAdmin(db, confId, context.auth);

    const now = admin.firestore.Timestamp.now();

    try {
      const oldCertRef = db.doc(`conferences/${confId}/certificates/${certificateId}`);
      const oldCertSnap = await oldCertRef.get();

      if (!oldCertSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Certificate not found');
      }

      const oldCert = oldCertSnap.data();
      if (!oldCert) {
        throw new functions.https.HttpsError('not-found', 'Certificate data invalid');
      }

      if (oldCert.status === 'REVOKED' || oldCert.status === 'REISSUED') {
        const label = oldCert.status === 'REVOKED' ? 'revoked' : 'already reissued';
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Certificate is ${label}. Reissue is only available for ISSUED certificates.`
        );
      }

      const attendee = await resolveAttendee(db, confId, oldCert.sourceId);
      if (!attendee) {
        throw new functions.https.HttpsError('not-found', 'Original registration/attendee not found');
      }

      const fields = extractAttendeeFields(attendee.data);
      if (!fields.name) {
        throw new functions.https.HttpsError('failed-precondition', 'Attendee name is required for reissue');
      }

      const certsCollection = db.collection(`conferences/${confId}/certificates`);
      const newCertRef = certsCollection.doc();
      const newCertId = newCertRef.id;
      const newVerificationToken = generateVerificationToken();

      const counterRef = db.doc(`conferences/${confId}/settings/certificate_counter`);
      const certificateNumber = await db.runTransaction(async (tx) => {
        const counterSnap = await tx.get(counterRef);
        let nextNum: number;

        if (counterSnap.exists) {
          const current = counterSnap.data();
          nextNum = current?.nextSerialNumber || 1;
        } else {
          nextNum = 1;
        }

        tx.set(counterRef, {
          id: 'certificate_counter',
          nextSerialNumber: nextNum + 1,
          updatedAt: now,
        }, { merge: true });

        const num = `CERT-${String(nextNum).padStart(4, '0')}`;
        return num;
      });

      await db.runTransaction(async (tx) => {
        tx.set(newCertRef, {
          id: newCertId,
          conferenceId: confId,
          sourceType: oldCert.sourceType,
          sourceId: oldCert.sourceId,
          certificateNumber,
          verificationToken: newVerificationToken,
          attendeeName: fields.name,
          attendeeEmail: fields.email,
          attendeeOrganization: fields.organization,
          status: 'ISSUED',
          issuedAt: now,
          previousCertificateId: certificateId,
          createdAt: now,
          updatedAt: now,
        });

        tx.update(oldCertRef, {
          status: 'REISSUED',
          supersededById: newCertId,
          reissuedAt: now,
          reissuedBy: adminActor.uid,
          reissuedReason: reason || null,
          updatedAt: now,
        });
      });

      const logCollectionName = oldCert.sourceType === 'external_attendee'
        ? 'external_attendees'
        : 'registrations';

      await db.collection(`conferences/${confId}/${logCollectionName}/${oldCert.sourceId}/logs`).add({
        type: 'CERTIFICATE_REISSUED',
        timestamp: now,
        oldCertificateId: certificateId,
        oldCertificateNumber: oldCert.certificateNumber,
        newCertificateId: newCertId,
        newCertificateNumber: certificateNumber,
        reissuedBy: adminActor.uid,
        reissuedByEmail: adminActor.email,
        reason: reason || null,
        method: 'ADMIN_CALLABLE',
      });

      functions.logger.info(
        `[Certificate] Reissued ${oldCert.certificateNumber} → ${certificateNumber} for ${oldCert.sourceId} by ${adminActor.role} ${adminActor.uid}`
      );

      return {
        success: true,
        oldCertificateId: certificateId,
        newCertificateId: newCertId,
        newCertificateNumber: certificateNumber,
        verificationToken: newVerificationToken,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      functions.logger.error('[Certificate] Reissue failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reissue certificate';
      throw new functions.https.HttpsError('internal', errorMessage);
    }
  });
