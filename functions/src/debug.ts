
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getTemplateList, getTemplate } from './utils/nhnCloud';

export const debugNHNTemplate = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        const societyId = req.query.societyId as string;
        const templateCode = req.query.templateCode as string;

        if (!societyId) {
            res.status(400).json({ error: 'societyId is required' });
            return;
        }

        try {
            // Get NHN Cloud config from Firestore
            const infraSnap = await admin.firestore()
                .collection('societies')
                .doc(societyId)
                .collection('settings')
                .doc('infrastructure')
                .get();

            if (!infraSnap.exists) {
                res.status(404).json({ error: 'Infrastructure settings not found' });
                return;
            }

            const infraData = infraSnap.data();
            const nhnConfig = infraData?.notification;

            // Log available config (masked)
            console.log('Config found:', {
                hasAppKey: !!nhnConfig?.appKey,
                hasSecretKey: !!nhnConfig?.secretKey,
                hasSenderKey: !!nhnConfig?.senderKey,
                senderKey: nhnConfig?.senderKey // For debugging
            });

            if (!nhnConfig?.appKey || !nhnConfig?.secretKey || !nhnConfig?.senderKey) {
                res.status(400).json({
                    error: 'NHN Cloud configuration is incomplete',
                    config: {
                        hasAppKey: !!nhnConfig?.appKey,
                        hasSecretKey: !!nhnConfig?.secretKey,
                        hasSenderKey: !!nhnConfig?.senderKey
                    }
                });
                return;
            }

            let result;
            if (templateCode) {
                result = await getTemplate({
                    appKey: nhnConfig.appKey,
                    secretKey: nhnConfig.secretKey,
                    senderKey: nhnConfig.senderKey
                }, templateCode);
            } else {
                result = await getTemplateList({
                    appKey: nhnConfig.appKey,
                    secretKey: nhnConfig.secretKey,
                    senderKey: nhnConfig.senderKey
                });
            }

            res.status(200).json({
                message: templateCode ? `Single template fetch: ${templateCode}` : 'Template list fetch',
                requestInfo: {
                    societyId,
                    templateCode,
                    senderKey: nhnConfig.senderKey
                },
                result
            });
        } catch (error: any) {
            console.error("Error in debugNHNTemplate:", error);
            res.status(500).json({
                error: error.message,
                stack: error.stack,
                details: error.response?.data
            });
        }
    });

export const sendTestAlimTalkHTTP = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        const societyId = req.query.societyId as string;
        const templateCode = req.query.templateCode as string;
        const recipientNo = req.query.recipientNo as string;

        const testUrl = req.query.testUrl as string;

        if (!societyId || !templateCode || !recipientNo) {
            res.status(400).json({ error: 'Missing parameters: societyId, templateCode, recipientNo' });
            return;
        }

        try {
            // Import notification service dynamically to avoid circular dependencies if any
            const { sendAlimTalk } = require('./services/notificationService');

            // Dummy variables for testing
            const variables = {
                userName: '테스트',
                society: '테스트학회',
                eventName: '테스트 행사',
                badgePrepUrl: testUrl || 'https://Example.com/test-badge', // Allow user to override URL
                digitalBadgeQrUrl: 'https://Example.com/test-qr',
                organization: '테스트 소속',
                affiliation: '테스트 소속',
                registrationId: 'TEST-1234',
                // [FIX] Shorten startDate to avoid 14 char limit (in case it's used in restricted field)
                startDate: '26.01.01',
                venue: '테스트 장소',
                receiptNumber: 'RCP-001'
            };

            console.log(`[Debug] Sending test AlimTalk to ${recipientNo} with template ${templateCode}`);

            const result = await sendAlimTalk({
                phone: recipientNo,
                templateCode: templateCode,
                variables: variables
            }, societyId);

            res.status(200).json({
                message: 'Test send attempt completed',
                request: {
                    societyId,
                    templateCode,
                    recipientNo,
                    variables
                },
                result
            });

        } catch (error: any) {
            console.error("Error in sendTestAlimTalkHTTP:", error);
            res.status(500).json({
                error: error.message,
                stack: error.stack
            });
        }
    });
