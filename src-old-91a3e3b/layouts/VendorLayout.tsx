
import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { VendorProvider } from '../contexts/VendorContext';
import { useSubdomain } from '../hooks/useSubdomain';
import { useVendor } from '../hooks/useVendor';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { QrCode, LogOut, Camera, X, CheckCircle, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { APP_VERSION } from '../constants/defaults';

export default function VendorLayout() {
  const { vid } = useParams<{ vid: string }>();
  const { subdomain } = useSubdomain();
  const navigate = useNavigate();
  
  // 0. Resolve Vendor ID (Handle Slug vs ID)
  const [resolvedVid, setResolvedVid] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    if (!vid) return;
    const resolveVendor = async () => {
        try {
            // Step 1: Check if vid is a valid ID
            const docRef = doc(db, 'vendors', vid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                  // Security Check
                  if (subdomain && data.id && data.id.split('_')[0] !== subdomain) {
                    console.error('Society Mismatch');
                    setResolvedVid(null);
                } else {
                    setResolvedVid(docSnap.id);
                }
            } else {
                // Step 2: Fallback to slug search
                const q = query(collection(db, 'vendors'), where('slug', '==', vid), limit(1));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                     const docData = querySnapshot.docs[0];
                     const data = docData.data();
                     if (subdomain && data.societyId !== subdomain) {
                         console.error('Society Mismatch');
                         setResolvedVid(null);
                     } else {
                         setResolvedVid(docData.id);
                     }
                } else {
                    console.error('Vendor not found');
                    setResolvedVid(null);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsResolving(false);
        }
    };
    resolveVendor();
  }, [vid, subdomain]);

  // Use the hook with RESOLVED ID
  const vendorLogic = useVendor(resolvedVid || '');
  const { vendor, loading, error, scanResult, scanBadge, processVisit, resetScan, visits } = vendorLogic;

  // Local UI State
  const [isScanning, setIsScanning] = useState(false);
  const [showConsentPopup, setShowConsentPopup] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Trigger Consent Popup when scanResult is available
  useEffect(() => {
    if (scanResult) {
        setIsScanning(false); // Stop scanning
        stopScanner();
        setShowConsentPopup(true);
    }
  }, [scanResult]);

  // Start Scanner
  const startScanner = () => {
      if (isScanning) return; // Prevent double init
      setIsScanning(true);
      setErrorState(null);
      
      // Delay to ensure DOM is ready
      setTimeout(() => {
          if (!scannerRef.current) {
              const html5QrCode = new Html5Qrcode("reader");
              scannerRef.current = html5QrCode;
              
              const config = { fps: 10, qrbox: { width: 250, height: 250 } };
              
              html5QrCode.start(
                  { facingMode: "environment" }, 
                  config,
                  (decodedText) => {
                      // Success
                      console.log("QR Scanned:", decodedText);
                      scanBadge(decodedText);
                      // Stop scanning immediately to prevent duplicate scans
                      html5QrCode.stop().then(() => {
                          html5QrCode.clear(); // Ensure UI is cleared
                          scannerRef.current = null;
                          setIsScanning(false);
                      }).catch(err => console.error(err));
                  },
                  (errorMessage) => {
                      // Ignore errors for now (scanning in progress)
                  }
              ).catch(err => {
                  console.error("Error starting scanner", err);
                  setErrorState("Camera Access Failed");
                  setIsScanning(false);
              });
          }
      }, 100);
  };

  const stopScanner = () => {
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
              scannerRef.current = null;
              setIsScanning(false);
          }).catch(console.error);
      } else {
          setIsScanning(false);
      }
  };

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (scannerRef.current) {
              scannerRef.current.stop().then(() => {
                  scannerRef.current?.clear();
              }).catch(console.error);
          }
      };
  }, []);

  const [errorState, setErrorState] = useState<string | null>(null);

  // Handle Consent
  const handleConsent = async (agreed: boolean) => {
      await processVisit(agreed);
      setShowConsentPopup(false);
      // Optional: Auto restart scanner?
  };

  if (!vid) return <div>Invalid Vendor ID</div>;

  return (
    <VendorProvider value={{ ...vendorLogic, isConsentGiven: false, setConsentGiven: () => {}, societyId: subdomain || undefined }}>
      <div className="flex flex-col h-screen bg-zinc-950 text-white font-sans">
         {/* Header */}
         <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900 shadow-sm z-10">
             <div className="flex items-center gap-2">
                 <QrCode className="w-5 h-5 text-emerald-500" />
                 <span className="font-bold tracking-tight">{vendor?.name || 'Loading...'}</span>
             </div>
             <div className="flex items-center gap-3">
                 <span className="text-xs text-zinc-500 font-mono">v{APP_VERSION}</span>
                 <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" onClick={() => navigate('/admin/login')}>
                    <LogOut className="w-4 h-4" />
                 </Button>
             </div>
         </header>

         <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-lg mx-auto w-full">
             
             {/* Scanner Section */}
             <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden mb-6 relative">
                 {isScanning ? (
                     <div className="relative bg-black aspect-square md:aspect-video flex items-center justify-center">
                         <div id="reader" className="w-full h-full"></div>
                         <Button 
                            variant="destructive" 
                            size="icon" 
                            className="absolute top-4 right-4 rounded-full z-20"
                            onClick={stopScanner}
                         >
                            <X className="w-5 h-5" />
                         </Button>
                         <div className="absolute bottom-4 left-0 w-full text-center text-xs text-white/70 z-20 pointer-events-none">
                             Scanning...
                         </div>
                     </div>
                 ) : (
                     <div className="p-10 flex flex-col items-center justify-center text-center aspect-square md:aspect-video bg-gradient-to-b from-zinc-900 to-zinc-950">
                         <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-zinc-700">
                            <Camera className="w-10 h-10 text-zinc-400" />
                         </div>
                         <h2 className="text-2xl font-bold text-white mb-2">Scan Badge</h2>
                         <p className="text-zinc-400 text-sm mb-8 max-w-[200px]">
                             Tap below to activate camera and scan attendee QR code.
                         </p>
                         <Button 
                            onClick={startScanner} 
                            size="lg" 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-6 rounded-xl text-lg shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95"
                         >
                             <QrCode className="w-5 h-5 mr-2" />
                             Activate Camera
                         </Button>
                     </div>
                 )}
                 
                 {/* Error Overlay */}
                 {(error || errorState) && (
                     <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30 p-6 text-center backdrop-blur-sm">
                         <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                         <p className="text-red-400 font-medium mb-6">{error || errorState}</p>
                         <Button variant="outline" onClick={() => { setErrorState(null); resetScan(); }} className="border-zinc-700 text-white hover:bg-zinc-800">
                             Dismiss
                         </Button>
                     </div>
                 )}
             </div>

             {/* Recent Scans / Dashboard */}
             <div className="space-y-4">
                 <div className="flex items-center justify-between px-1">
                     <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Recent Leads</h3>
                     <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">{visits.length} Collected</span>
                 </div>
                 
                 <div className="space-y-2">
                     {visits.length === 0 ? (
                         <div className="text-center py-8 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-lg">
                             No scans yet today.
                         </div>
                     ) : (
                         visits.map((visit) => (
                             <div key={visit.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition-colors hover:border-zinc-700">
                                 <div className="flex items-center gap-3">
                                     <div className={`w-2 h-10 rounded-full ${visit.isConsentAgreed ? 'bg-emerald-500' : 'bg-red-500/50'}`}></div>
                                     <div>
                                         <p className="font-medium text-zinc-200">
                                             {visit.visitorName}
                                         </p>
                                         <p className="text-xs text-zinc-500">
                                             {visit.visitorOrg || 'No Org'}
                                         </p>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-xs text-zinc-500 font-mono">
                                         {visit.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                     </p>
                                     {visit.isConsentAgreed && <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto mt-1" />}
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
             </div>

             <div className="mt-8">
                <Outlet />
             </div>
         </main>

         {/* Consent Popup (The Gate) */}
         <Dialog open={showConsentPopup} onOpenChange={(open) => { if(!open) handleConsent(false); }}>
             <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-800 text-white">
                 <DialogHeader>
                     <DialogTitle className="text-xl font-bold flex items-center gap-2">
                         <ShieldCheck className="w-6 h-6 text-emerald-500" />
                         정보 제공 동의
                     </DialogTitle>
                     <DialogDescription className="text-zinc-400 pt-2">
                         <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 mb-4">
                            <p className="font-semibold text-white text-lg mb-1">{scanResult?.user.name}</p>
                            <p className="text-sm">{(scanResult?.user as any).affiliations?.[0] || (scanResult?.user as any).affiliation || (scanResult?.user as any).org}</p>
                        </div>
                         본 부스({vendor?.name})에 귀하의 명함 정보(성함, 소속, 연락처)를 제공하시겠습니까?
                     </DialogDescription>
                 </DialogHeader>
                 <DialogFooter className="flex gap-2 sm:justify-end mt-4">
                     <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => handleConsent(false)}
                        className="flex-1 sm:flex-none text-zinc-400 hover:text-white hover:bg-zinc-800"
                     >
                         거부 (Deny)
                     </Button>
                     <Button 
                        type="button" 
                        onClick={() => handleConsent(true)} 
                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                     >
                         동의 (Agree)
                     </Button>
                 </DialogFooter>
             </DialogContent>
         </Dialog>
         
         {/* Loading Overlay */}
         {loading && (
             <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                 <RefreshCw className="w-8 h-8 text-white animate-spin" />
             </div>
         )}
      </div>
    </VendorProvider>
  );
}


