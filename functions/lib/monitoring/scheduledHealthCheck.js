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
exports.manualHealthCheck = exports.scheduledHealthCheck = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Scheduled: Infrastructure Health Check
 *
 * Runs every 6 hours and verifies core services (Firestore, Auth) are operational.
 * Logs results to Firestore at system/health_checks/logs.
 */
exports.scheduledHealthCheck = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
    const db = admin.firestore();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const results = {};
    // 1. Check Firestore connectivity
    try {
        const start = Date.now();
        await db.doc('system/health').get();
        results.firestore = { status: 'healthy', latencyMs: Date.now() - start };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.firestore = { status: 'unhealthy', error: msg };
    }
    // 2. Check Auth service
    try {
        await admin.auth().listUsers(1);
        results.auth = { status: 'healthy' };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.auth = { status: 'unhealthy', error: msg };
    }
    // Determine overall status
    const allHealthy = Object.values(results).every(r => r.status === 'healthy');
    const overallStatus = allHealthy ? 'healthy' : 'degraded';
    // Log result
    const logEntry = {
        timestamp,
        overallStatus,
        checks: results,
        triggeredBy: context.eventType || 'schedule',
    };
    await db.collection('system/health_checks/logs').add(logEntry);
    if (!allHealthy) {
        functions.logger.warn('[ScheduledHealthCheck] Degraded infrastructure detected:', JSON.stringify(results));
    }
    else {
        functions.logger.info('[ScheduledHealthCheck] All systems healthy');
    }
    return null;
});
/**
 * Callable: Manual Health Check
 *
 * On-demand health check for authenticated users.
 * Returns current infrastructure status without writing to Firestore logs.
 */
exports.manualHealthCheck = functions.https.onCall(async (_data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const db = admin.firestore();
    const results = {};
    try {
        const start = Date.now();
        await db.doc('system/health').get();
        results.firestore = { status: 'healthy', latencyMs: Date.now() - start };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.firestore = { status: 'unhealthy', error: msg };
    }
    try {
        await admin.auth().listUsers(1);
        results.auth = { status: 'healthy' };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.auth = { status: 'unhealthy', error: msg };
    }
    const allHealthy = Object.values(results).every(r => r.status === 'healthy');
    return {
        overallStatus: allHealthy ? 'healthy' : 'degraded',
        checks: results,
        timestamp: new Date().toISOString(),
    };
});
//# sourceMappingURL=scheduledHealthCheck.js.map