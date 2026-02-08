import { logPerformanceIssue } from '@/utils/errorLogger';

/**
 * API Performance Tracking Utility
 *
 * Wraps Firestore operations to track response times
 * Usage:
 * ```typescript
 * const result = await trackFirestoreOperation(
 *   'getUserData',
 *   getDoc(doc(db, 'users', uid))
 * );
 * ```
 */

/**
 * Performance thresholds for different operation types (in milliseconds)
 */
const THRESHOLDS = {
    // Simple get operations
    SINGLE_DOCUMENT_GET: 1000,
    // Simple queries with one where clause
    SIMPLE_QUERY: 2000,
    // Complex queries with multiple conditions
    COMPLEX_QUERY: 5000,
    // Batch operations
    BATCH_WRITE: 3000,
    // Transactions
    TRANSACTION: 5000,
};

/**
 * Track a Firestore operation and log if it exceeds threshold
 */
export async function trackFirestoreOperation<T>(
    operationName: string,
    operation: Promise<T>,
    options?: {
        threshold?: number;
        metadata?: Record<string, unknown>;
    }
): Promise<T> {
    const startTime = performance.now();
    const threshold = options?.threshold || THRESHOLDS.SINGLE_DOCUMENT_GET;

    try {
        const result = await operation;
        const duration = performance.now() - startTime;

        // Log if operation took longer than threshold
        if (duration > threshold) {
            await logPerformanceIssue(
                `API_${operationName}`,
                duration,
                threshold,
                {
                    ...options?.metadata,
                    operationType: 'FIRESTORE',
                    status: 'success',
                }
            );
        }

        return result;
    } catch (error: any) {
        const duration = performance.now() - startTime;

        // Log failed operations
        await logPerformanceIssue(
            `API_${operationName}_FAILED`,
            duration,
            threshold,
            {
                ...options?.metadata,
                operationType: 'FIRESTORE',
                status: 'error',
                errorMessage: error?.message || 'Unknown error',
            }
        );

        throw error;
    }
}

/**
 * Track a Cloud Function call
 */
export async function trackFunctionCall<T>(
    functionName: string,
    operation: Promise<T>,
    options?: {
        threshold?: number;
        metadata?: Record<string, unknown>;
    }
): Promise<T> {
    const startTime = performance.now();
    const threshold = options?.threshold || 5000; // 5s default for functions

    try {
        const result = await operation;
        const duration = performance.now() - startTime;

        if (duration > threshold) {
            await logPerformanceIssue(
                `FUNCTION_${functionName}`,
                duration,
                threshold,
                {
                    ...options?.metadata,
                    operationType: 'CLOUD_FUNCTION',
                    status: 'success',
                }
            );
        }

        return result;
    } catch (error: any) {
        const duration = performance.now() - startTime;

        await logPerformanceIssue(
            `FUNCTION_${functionName}_FAILED`,
            duration,
            threshold,
            {
                ...options?.metadata,
                operationType: 'CLOUD_FUNCTION',
                status: 'error',
                errorMessage: error?.message || 'Unknown error',
            }
        );

        throw error;
    }
}

/**
 * Decorator for automatic tracking (TypeScript experimental decorators)
 * Usage:
 * ```typescript
 * class MyService {
 *   @TrackOperation('getUserData', { threshold: 2000 })
 *   async getUserData(uid: string) {
 *     return await getDoc(doc(db, 'users', uid));
 *   }
 * }
 * ```
 */
export function TrackOperation(
    operationName: string,
    options?: { threshold?: number; metadata?: Record<string, unknown> }
) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const startTime = performance.now();
            const threshold = options?.threshold || THRESHOLDS.SINGLE_DOCUMENT_GET;

            try {
                const result = await originalMethod.apply(this, args);
                const duration = performance.now() - startTime;

                if (duration > threshold) {
                    await logPerformanceIssue(
                        `METHOD_${operationName}`,
                        duration,
                        threshold,
                        {
                            ...options?.metadata,
                            operationType: 'METHOD',
                            className: target.constructor.name,
                            methodName: propertyKey,
                            status: 'success',
                        }
                    );
                }

                return result;
            } catch (error: any) {
                const duration = performance.now() - startTime;

                await logPerformanceIssue(
                    `METHOD_${operationName}_FAILED`,
                    duration,
                    threshold,
                    {
                        ...options?.metadata,
                        operationType: 'METHOD',
                        className: target.constructor.name,
                        methodName: propertyKey,
                        status: 'error',
                        errorMessage: error?.message || 'Unknown error',
                    }
                );

                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Hook to track component render performance
 */
export function trackRenderPerformance(
    componentName: string,
    threshold: number = 100 // 100ms default for render time
) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        if (propertyKey !== 'render' && !originalMethod?.isReactComponent) {
            return descriptor;
        }

        descriptor.value = function (...args: any[]) {
            const startTime = performance.now();
            const result = originalMethod.apply(this, args);
            const duration = performance.now() - startTime;

            if (duration > threshold) {
                logPerformanceIssue(
                    `RENDER_${componentName}`,
                    duration,
                    threshold,
                    {
                        operationType: 'RENDER',
                        status: 'slow-render',
                    }
                );
            }

            return result;
        };

        return descriptor;
    };
}
