import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import corsLib from 'cors';
import { sendAlimTalk, getTemplate, NHNCloudConfig } from '../utils/nhnCloud';

const cors = corsLib({ origin: true });

export const sendAlimTalkTest = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        // CORS
        cors(req, res, async () => {
            if (req.method === 'OPTIONS') {
                res.status(204).send('');
                return;
            }

            // Allow GET and POST
            if (req.method !== 'POST' && req.method !== 'GET') {
                res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
                return;
            }

            const societyId = req.body.societyId || req.query.societyId;
            const phone = req.body.phone || req.query.phone;
            const templateCode = req.body.templateCode || req.query.templateCode;
            const senderKey = req.body.senderKey || req.query.senderKey;
            const mode = req.body.mode || req.query.mode; // 'send' or 'inspect'

            let templateParameter = req.body.templateParameter || req.query.templateParameter || {};

            // Parse templateParameter if it comes as a string (GET query param)
            if (typeof templateParameter === 'string') {
                try {
                    templateParameter = JSON.parse(templateParameter);
                } catch (e) {
                    console.warn('Failed to parse templateParameter JSON', e);
                    templateParameter = {};
                }
            }

            // Validation
            if (!societyId || !templateCode || !senderKey) {
                res.status(400).json({
                    error: 'Missing required fields: societyId, templateCode, senderKey'
                });
                return;
            }

            // Phone is required unless inspecting
            if (mode !== 'inspect' && !phone) {
                res.status(400).json({ error: 'Missing required fields: phone' });
                return;
            }

            try {
                // Fetch credentials from Firestore
                const infraSnap = await admin.firestore()
                    .collection('societies')
                    .doc(societyId)
                    .collection('settings')
                    .doc('infrastructure')
                    .get();

                if (!infraSnap.exists) {
                    res.status(404).json({ error: `Infrastructure settings not found for societyId: ${societyId}` });
                    return;
                }

                const infraData = infraSnap.data();
                const nhnConfig = infraData?.notification;

                if (!nhnConfig?.appKey || !nhnConfig?.secretKey) {
                    res.status(500).json({ error: 'NHN Cloud AppKey or SecretKey not configured in database.' });
                    return;
                }

                const config: NHNCloudConfig = {
                    appKey: nhnConfig.appKey,
                    secretKey: nhnConfig.secretKey,
                    senderKey: senderKey // Use the provided senderKey (or fallback to DB if needed)
                };

                // Mode: Inspect Template
                if (mode === 'inspect') {
                    const result = await getTemplate(config, templateCode);
                    res.status(200).json(result);
                    return;
                }

                // Mode: Send Message
                // Clean phone number (remove dashes)
                const cleanPhone = phone.replace(/-/g, '');

                const result = await sendAlimTalk(config, {
                    recipientNo: cleanPhone,
                    templateCode: templateCode,
                    templateParameter: templateParameter || {}
                });

                if (result.success) {
                    res.status(200).json(result);
                } else {
                    res.status(500).json(result);
                }

            } catch (error: any) {
                console.error('Send test failed', error);
                res.status(500).json({ error: error.message });
            }
        });
    });
