import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import type { ErrorLog, ErrorSeverity, ErrorCategory } from '@/types/schema';

/**
 * Error Logger Utility
 *
 * Logs errors to Firestore for monitoring and alerting
 * Uses Cloud Function (logError) for secure logging with deduplication
 */

/**
 * Classify error based on error type or message
 */
function classifyError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    name.includes('networkerror')
  ) {
    return 'NETWORK';
  }

  // Auth errors
  if (
    message.includes('auth') ||
    message.includes('unauthorized') ||
    message.includes('permission') ||
    message.includes('token')
  ) {
    return 'AUTH';
  }

  // Payment errors
  if (
    message.includes('payment') ||
    message.includes('card') ||
    message.includes('transaction')
  ) {
    return 'PAYMENT';
  }

  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  ) {
    return 'VALIDATION';
  }

  // Data integrity errors
  if (
    message.includes('data') ||
    message.includes('integrity') ||
    message.includes('consistency')
  ) {
    return 'DATA_INTEGRITY';
  }

  // Default: runtime error
  return 'RUNTIME';
}

/**
 * Determine error severity
 */
function determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
  const message = error.message.toLowerCase();

  // Critical: Payment failures, data integrity, auth system failures
  if (
    category === 'PAYMENT' ||
    category === 'DATA_INTEGRITY' ||
    message.includes('critical') ||
    message.includes('system failure')
  ) {
    return 'CRITICAL';
  }

  // High: Auth errors, network failures affecting core functionality
  if (
    category === 'AUTH' ||
    (category === 'NETWORK' && message.includes('api'))
  ) {
    return 'HIGH';
  }

  // Medium: Validation errors, non-critical network issues
  if (category === 'VALIDATION' || category === 'NETWORK') {
    return 'MEDIUM';
  }

  // Low: Unknown or minor runtime errors
  return 'LOW';
}

/**
 * Generate unique error ID based on error message and stack
 * This helps with deduplication - same error gets same ID
 */
function generateErrorId(error: Error): string {
  // Create hash from error message + stack (first 3 lines)
  const stackPreview = error.stack
    ? error.stack.split('\n').slice(0, 3).join('\n')
    : error.message;

  const combined = `${error.name}:${error.message}:${stackPreview}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `err_${Math.abs(hash)}`;
}

/**
 * Log error to Firestore via Cloud Function
 *
 * Flow:
 * 1. Client calls this function
 * 2. Function calls Cloud Function (logError)
 * 3. Cloud Function checks if error already exists today
 * 4. If exists: increment occurrenceCount
 * 5. If new: create new log entry
 * 6. If critical: send email alert
 */
export async function logError(
  error: Error,
  context?: {
    component?: string;
    action?: string;
    apiEndpoint?: string;
    firestoreQuery?: string;
    [key: string]: unknown;
  }
): Promise<void> {
  try {
    // Skip logging in development (optional - you may want to log everything)
    if (import.meta.env.MODE === 'development') {
      console.warn('[DEV] Error logging skipped in development:', error);
      return;
    }

    // Classify error
    const category = classifyError(error);
    const severity = determineSeverity(error, category);
    const errorId = generateErrorId(error);

    // Get current user info
    const userId = auth.currentUser?.uid;
    const userAgent = navigator.userAgent;
    const url = window.location.href;
    const route = window.location.pathname;

    // Prepare error log data
    const errorData: Omit<ErrorLog, 'id' | 'timestamp' | 'resolved' | 'alertSent' | 'occurrenceCount' | 'firstSeenAt' | 'lastSeenAt'> = {
      severity,
      category,
      message: error.message,
      stack: error.stack,
      userId,
      userAgent,
      url,
      route,
      metadata: {
        ...context,
        component: context?.component || 'Unknown',
        errorName: error.name,
      },
    };

    // Call Cloud Function to log error
    // Note: We'll implement logError Cloud Function next
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('@/firebase');
    const logErrorFunction = httpsCallable(functions, 'logError');

    await logErrorFunction({
      errorId,
      errorData,
    });

    console.log('[ErrorLogger] Error logged successfully:', errorId);
  } catch (loggingError) {
    // Fail gracefully - don't let error logging break the app
    console.error('[ErrorLogger] Failed to log error:', loggingError);
  }
}

/**
 * Log network error (convenience function)
 */
export async function logNetworkError(
  error: Error,
  apiEndpoint: string
): Promise<void> {
  await logError(error, {
    apiEndpoint,
    category: 'NETWORK',
  });
}

/**
 * Log performance issue
 */
export async function logPerformanceIssue(
  metricName: string,
  value: number,
  threshold: number,
  context?: {
    url?: string;
    route?: string;
    [key: string]: unknown;
  }
): Promise<void> {
  try {
    if (import.meta.env.MODE === 'development') {
      console.warn('[DEV] Performance logging skipped in development:', metricName, value);
      return;
    }

    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('@/firebase');
    const logPerformanceFunction = httpsCallable(functions, 'logPerformance');

    await logPerformanceFunction({
      metricName,
      value,
      threshold,
      context: {
        ...context,
        userId: auth.currentUser?.uid,
        url: context?.url || window.location.href,
        route: context?.route || window.location.pathname,
        userAgent: navigator.userAgent,
      },
    });

    console.log('[ErrorLogger] Performance logged successfully:', metricName);
  } catch (loggingError) {
    console.error('[ErrorLogger] Failed to log performance:', loggingError);
  }
}
