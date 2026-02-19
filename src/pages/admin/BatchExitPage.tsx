import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import toast from 'react-hot-toast';

/**
 * Batch Exit Page - Admin Dashboard
 *
 * PURPOSE: Allow admins to batch exit all attendees at conference end
 * or when closing specific zones.
 *
 * FEATURES:
 * - Conference selection
 * - Zone filtering (optional)
 * - Real-time progress tracking
 * - Confirmation dialog
 * - Results summary
 */

export default function BatchExitPage() {
  const [confId, setConfId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [scannerId, setScannerId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    processedCount: number;
    timestamp: number;
  } | null>(null);

  const functions = getFunctions();

  const handleBatchExit = async () => {
    // Validation
    if (!confId.trim()) {
      toast.error('Conference ID is required');
      return;
    }

    // Confirmation
    const confirmed = window.confirm(
      `Are you sure you want to batch exit all attendees${zoneId ? ` in zone: ${zoneId}` : ''}?` +
      '\n\nThis will create EXIT records for all attendees who forgot to scan exit.'
    );

    if (!confirmed) return;

    setProcessing(true);
    setResult(null);

    try {
      // Call Cloud Function
      const batchExitFunction = httpsCallable(functions, 'batchExitAllAttendees');
      const response = await batchExitFunction({
        confId: confId.trim(),
        zoneId: zoneId.trim() || undefined,
        scannerId: scannerId.trim() || undefined
      });

      const data = response.data as { success: boolean; processedCount: number; timestamp: number };

      if (data.success) {
        setResult({
          processedCount: data.processedCount,
          timestamp: data.timestamp
        });

        toast.success(`Successfully exited ${data.processedCount} attendees`);
      } else {
        toast.error('Batch exit failed');
      }

    } catch (error: unknown) {
      console.error('Batch exit error:', error);
      toast.error(error.message || 'Failed to execute batch exit');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Batch Exit All Attendees</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-4">
          {/* Conference ID */}
          <div>
            <label htmlFor="confId" className="block text-sm font-medium text-gray-700 mb-1">
              Conference ID *
            </label>
            <input
              id="confId"
              type="text"
              value={confId}
              onChange={(e) => setConfId(e.target.value)}
              placeholder="e.g., kap_2026spring"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={processing}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the conference ID (format: societyId_slug)
            </p>
          </div>

          {/* Zone ID (Optional) */}
          <div>
            <label htmlFor="zoneId" className="block text-sm font-medium text-gray-700 mb-1">
              Zone ID (Optional)
            </label>
            <input
              id="zoneId"
              type="text"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              placeholder="e.g., main_hall, room_a"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={processing}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to exit attendees from all zones
            </p>
          </div>

          {/* Scanner ID (Optional) */}
          <div>
            <label htmlFor="scannerId" className="block text-sm font-medium text-gray-700 mb-1">
              Scanner ID (Optional)
            </label>
            <input
              id="scannerId"
              type="text"
              value={scannerId}
              onChange={(e) => setScannerId(e.target.value)}
              placeholder="e.g., admin@eregi.co.kr"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={processing}
            />
            <p className="text-xs text-gray-500 mt-1">
              Staff/admin ID for logging purposes
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              onClick={handleBatchExit}
              disabled={processing || !confId.trim()}
              className={`w-full py-3 px-4 rounded-md font-medium text-white ${
                processing || !confId.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              } transition-colors`}
            >
              {processing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Execute Batch Exit'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-green-800 mb-2">✅ Batch Exit Complete</h2>
          <div className="space-y-1 text-green-700">
            <p><strong>Processed:</strong> {result.processedCount} attendees</p>
            <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">ℹ️ What This Does</h3>
        <ul className="list-disc list-inside space-y-1 text-blue-700 text-sm">
          <li>Creates EXIT records for all attendees who forgot to scan exit</li>
          <li>Updates ENTRY logs to mark them as exited</li>
          <li>Optionally filters by zone/location</li>
          <li>All actions are logged with batch exit flag</li>
        </ul>
      </div>

      {/* Warning Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Important Notes</h3>
        <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
          <li>This action cannot be undone</li>
          <li>Only attendees with active ENTRY logs will be exited</li>
          <li>Attendance time calculations will be updated automatically</li>
          <li>Run this at conference end or when closing specific zones</li>
        </ul>
      </div>
    </div>
  );
}
