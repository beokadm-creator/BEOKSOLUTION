import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useVendor } from '../../hooks/useVendor';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { QrCode, Camera, Keyboard, AlertCircle, CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorScannerPage() {
    const { activeVendorId } = useOutletContext<{ activeVendorId: string }>();
    const vendorLogic = useVendor(activeVendorId);

    const {
        vendor,
        conferences,
        conferenceId,
        setConferenceId,
        scanBadge,
        scanResult,
        processVisit,
        loading,
        error,
        resetScan
    } = vendorLogic;

    const [qrInput, setQrInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Camera Scan State
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        // Stop scanner on unmount
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => console.error("Scanner stop fail on unmount:", err));
            }
        };
    }, []);

    useEffect(() => {
        if (!isScanning) {
            inputRef.current?.focus();
        }
    }, [scanResult, isScanning, loading]);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (qrInput.trim()) {
            scanBadge(qrInput.trim());
            setQrInput('');
        }
    };

    const startScanner = () => {
        if (isScanning) return;
        setIsScanning(true);
        setCameraError(null);

        setTimeout(() => {
            if (!scannerRef.current) {
                const html5QrCode = new Html5Qrcode("vendor-reader");
                scannerRef.current = html5QrCode;

                html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        console.log("QR Scanned via camera:", decodedText);
                        scanBadge(decodedText);
                        stopScanner(); // Stop after successful scan
                    },
                    (errorMessage) => {
                        // ignore general frame scan errors
                    }
                ).catch((err) => {
                    console.error("Camera fail:", err);
                    setCameraError("카메라 접근에 실패했습니다. 권한을 확인해주세요.");
                    setIsScanning(false);
                });
            }
        }, 300);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                scannerRef.current = null;
                setIsScanning(false);
            }).catch(err => {
                console.error("Scanner stop fail:", err);
                setIsScanning(false);
            });
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Lead Scanner</h1>
                    <p className="text-sm text-gray-500">Scan attendee badges to collect leads.</p>
                </div>
                {conferences.length > 0 && (
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500 uppercase font-semibold">Campaign Mode</span>
                        <select
                            value={conferenceId || ''}
                            onChange={e => setConferenceId(e.target.value)}
                            className="bg-indigo-50 border border-indigo-200 text-sm font-semibold rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-indigo-700 py-1.5 px-3"
                        >
                            {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <strong className="block font-bold">Error</strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                    <button onClick={() => vendorLogic.resetScan()} className="text-red-500 hover:text-red-700">✕</button>
                </div>
            )}

            {!scanResult ? (
                <Card className="shadow-lg border-t-4 border-t-indigo-600">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                            <QrCode className="w-8 h-8" />
                        </div>
                        <CardTitle>Scan Attendee Badge</CardTitle>
                        <CardDescription>
                            Use your device camera or external barcode scanner.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isScanning ? (
                            <div className="flex flex-col items-center">
                                <div id="vendor-reader" className="w-full max-w-sm rounded-lg overflow-hidden border-2 border-indigo-200 shadow-inner"></div>
                                {cameraError && <p className="text-red-500 text-sm mt-3 font-semibold">{cameraError}</p>}
                                <Button onClick={stopScanner} variant="outline" className="mt-4 border-red-200 text-red-600 hover:bg-red-50">
                                    Stop Camera
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <Button
                                    onClick={startScanner}
                                    className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md"
                                >
                                    <Camera className="w-5 h-5 mr-2" /> Start Mobile Camera
                                </Button>

                                <div className="relative w-full text-center my-2">
                                    <span className="bg-white px-3 text-sm text-gray-400 relative z-10">or use external scanner</span>
                                    <div className="absolute inset-x-0 top-1/2 -mt-px w-full border-t border-gray-200"></div>
                                </div>

                                <form onSubmit={handleScan} className="w-full flex gap-2">
                                    <div className="relative flex-1">
                                        <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={qrInput}
                                            onChange={e => setQrInput(e.target.value)}
                                            placeholder="Click here & scan..."
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            autoFocus
                                        />
                                    </div>
                                    <Button type="submit" variant="secondary" className="px-6 h-auto" disabled={loading}>
                                        {loading ? <LoadingSpinner text="로딩 중..." /> : 'Enter'}
                                    </Button>
                                </form>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card className="shadow-lg border-t-4 border-t-green-500 overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="bg-green-50 p-6 text-center border-b border-green-100">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
                        <h2 className="text-2xl font-bold text-green-800">Badge Scanned Successfully!</h2>
                        <p className="text-green-600 mt-1">Please confirm visitor details to save lead.</p>
                    </div>

                    <CardContent className="p-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div className="text-gray-500">Name</div>
                                <div className="font-bold text-gray-900 text-right">{scanResult.user.name || 'N/A'}</div>

                                <div className="text-gray-500">Affiliation</div>
                                <div className="font-medium text-gray-900 text-right">
                                    {scanResult.user.affiliations?.[0]?.name || (scanResult.user as any).affiliation || (scanResult.reg as any).affiliation || (scanResult.reg as any).organization || 'N/A'}
                                </div>

                                <div className="text-gray-500">Registration Type</div>
                                <div className="font-medium text-gray-900 text-right uppercase">
                                    {(scanResult.reg as any).type || (scanResult.reg as any).category || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 bg-blue-50 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-800">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                            <div>
                                <p className="font-bold mb-1">Information Privacy Consent</p>
                                <p>Does the visitor consent to providing their contact information (Email/Phone) to {vendor?.name}?</p>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-gray-50 p-6 flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1 py-6 text-base font-bold text-gray-600 border-gray-300"
                            onClick={() => processVisit(false)}
                            disabled={loading}
                        >
                            Decline (Stamp Only)
                        </Button>
                        <Button
                            className="flex-1 py-6 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => processVisit(true)}
                            disabled={loading}
                        >
                            Accept & Save Lead
                        </Button>
                    </CardFooter>
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                            <LoadingSpinner />
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
