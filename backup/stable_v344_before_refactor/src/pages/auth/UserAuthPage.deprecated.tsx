import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth, db, functions } from '../../firebase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card } from '../../components/ui/card';
import { Checkbox as UiCheckbox } from '../../components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { CheckCircle2, Phone, Mail } from 'lucide-react';
import { doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';

const UserAuthPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Nationality State
    const [nationality, setNationality] = useState<'DOMESTIC' | 'INTERNATIONAL'>('DOMESTIC');
    
    // Phone Verification State
    const [verificationCode, setVerificationCode] = useState('');
    const [sentCode, setSentCode] = useState(''); // In real app, verify on server
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [showVerifyInput, setShowVerifyInput] = useState(false);

    // Terms Modal State
    const [viewingTerm, setViewingTerm] = useState<{ title: string, content: string } | null>(null);
    const [platformTerms, setPlatformTerms] = useState({ terms: '', privacy: '', thirdParty: '' });

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get('returnUrl');

    // Fetch Platform Terms
    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const docRef = doc(db, 'system', 'settings');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setPlatformTerms({
                        terms: data.terms || 'No terms content.',
                        privacy: data.privacy || 'No privacy content.',
                        thirdParty: data.thirdParty || 'No content.'
                    });
                }
            } catch (e) {
                console.error("Failed to fetch terms", e);
            }
        };
        fetchTerms();
    }, []);

    // Reset fields when switching tabs
    useEffect(() => {
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
        setAffiliation('');
        setLicenseNumber('');
        setConsent(false);
        setNationality('DOMESTIC');
        setIsPhoneVerified(false);
        setShowVerifyInput(false);
    }, [activeTab]);

    const handleSendCode = async () => {
        if (!phone) return toast.error("Please enter a phone number");
        // Simple client-side mock for now, or call cloud function
        const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
        setSentCode(mockCode);
        setShowVerifyInput(true);
        
        try {
            // Call Cloud Function Placeholder
            const sendFn = httpsCallable(functions, 'sendAuthCode');
            await sendFn({ phone, code: mockCode });
            toast.success(`Verification code sent! (Mock: ${mockCode})`);
        } catch (e) {
            console.error(e);
            toast.success(`Verification code sent! (Mock: ${mockCode})`); // Fallback if CF fails
        }
    };

    const handleVerifyCode = () => {
        if (verificationCode === sentCode) {
            setIsPhoneVerified(true);
            toast.success("Phone verified successfully!");
            setShowVerifyInput(false);
        } else {
            toast.error("Invalid code");
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (activeTab === 'signup') {
                // --- SIGN UP FLOW ---
                if (!consent) throw new Error("You must agree to the Terms and Privacy Policy.");
                if (!name || !email || !password) throw new Error("Please fill in all required fields.");
                
                if (nationality === 'DOMESTIC') {
                    if (!phone) throw new Error("Phone number is required for domestic users.");
                    if (!isPhoneVerified) throw new Error("Please verify your phone number.");
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // International Email Verification
                if (nationality === 'INTERNATIONAL') {
                    await sendEmailVerification(user);
                    toast.success("Verification email sent. Please check your inbox.");
                }

                // Update Auth Profile
                await updateProfile(user, { displayName: name });

                // Create User Document in 'users' collection
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    name: name,
                    phone: phone, // Optional for International
                    organization: affiliation,
                    licenseNumber: licenseNumber,
                    nationality: nationality,
                    isForeigner: nationality === 'INTERNATIONAL',
                    createdAt: Timestamp.now(),
                    role: 'USER', 
                    consents: {
                        terms: true,
                        privacy: true,
                        thirdParty: true,
                        timestamp: Timestamp.now()
                    }
                });

                toast.success("Account created successfully!");
            } else {
                // --- SIGN IN FLOW ---
                await signInWithEmailAndPassword(auth, email, password);
            }

            // --- REDIRECT LOGIC ---
            if (returnUrl) {
                navigate(returnUrl);
            } else {
                navigate('/');
            }

        } catch (err: any) {
            console.error(err);
            let message = err.message;
            
            // Map Firebase Error Codes to Korean
            if (err.code === 'auth/user-not-found') {
                message = "가입되지 않은 사용자입니다. 회원가입을 진행해주세요.";
            } else if (err.code === 'auth/wrong-password') {
                message = "비밀번호가 올바르지 않습니다.";
            } else if (err.code === 'auth/invalid-email') {
                message = "이메일 형식이 잘못되었습니다.";
            } else if (err.code === 'auth/too-many-requests') {
                message = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";
            }
            
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 font-sans">
            <div className="w-full max-w-lg space-y-6">
                
                {/* Marketing Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">Welcome to e-Regi</h1>
                    <p className="text-slate-600">Sign up once, register for multiple conferences easily.</p>
                </div>

                <Card className="shadow-xl border-slate-100 overflow-hidden bg-white rounded-xl">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="bg-slate-50 border-b border-slate-100 px-6 pt-6">
                             <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-200/50 p-1 rounded-lg">
                                <TabsTrigger value="login" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Log In</TabsTrigger>
                                <TabsTrigger value="signup" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Sign Up</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleAuth}>
                                <TabsContent value="login" className="space-y-4 mt-0">
                                    <div className="space-y-2">
                                        <Label htmlFor="login-email">Email</Label>
                                        <Input id="login-email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="login-password">Password</Label>
                                            <button 
                                                type="button" 
                                                style={{ border: '4px solid red', padding: '5px', fontWeight: 'bold', background: '#ffebeb' }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    alert("Recover Button Clicked! Redirecting...");
                                                    window.location.href = '/auth/recovery';
                                                }}
                                            >
                                                FORGOT PASSWORD (CLICK ME)
                                            </button>
                                        </div>
                                        <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-11" />
                                    </div>
                                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-semibold mt-2" disabled={loading}>
                                        {loading ? 'Logging in...' : 'Log In'}
                                    </Button>
                                </TabsContent>

                                <TabsContent value="signup" className="space-y-4 mt-0">
                                    {/* Nationality Toggle */}
                                    <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                                        <button 
                                            type="button"
                                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${nationality === 'DOMESTIC' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                                            onClick={() => setNationality('DOMESTIC')}
                                        >
                                            Domestic (내국인)
                                        </button>
                                        <button 
                                            type="button"
                                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${nationality === 'INTERNATIONAL' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                                            onClick={() => setNationality('INTERNATIONAL')}
                                        >
                                            International (외국인)
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-name">Full Name *</Label>
                                            <Input id="signup-name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required className="h-10" />
                                        </div>
                                        
                                        {/* Phone Field Logic */}
                                        {nationality === 'DOMESTIC' ? (
                                            <div className="space-y-2">
                                                <Label htmlFor="signup-phone">Phone (Verified) *</Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        id="signup-phone" 
                                                        placeholder="010-1234-5678" 
                                                        value={phone} 
                                                        onChange={e => setPhone(e.target.value)} 
                                                        disabled={isPhoneVerified}
                                                        className="h-10" 
                                                    />
                                                    {!isPhoneVerified && (
                                                        <Button type="button" onClick={handleSendCode} variant="outline" size="sm" className="h-10 px-2 text-xs whitespace-nowrap">
                                                            Verify
                                                        </Button>
                                                    )}
                                                </div>
                                                {isPhoneVerified && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Verified</span>}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Label htmlFor="signup-phone">Phone (Optional)</Label>
                                                <Input id="signup-phone" placeholder="+1 234..." value={phone} onChange={e => setPhone(e.target.value)} className="h-10" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Verification Input for Domestic */}
                                    {showVerifyInput && !isPhoneVerified && (
                                        <div className="flex gap-2 items-center bg-blue-50 p-2 rounded border border-blue-100">
                                            <Input 
                                                placeholder="Enter 6-digit code" 
                                                value={verificationCode} 
                                                onChange={e => setVerificationCode(e.target.value)} 
                                                className="h-9 bg-white" 
                                            />
                                            <Button type="button" onClick={handleVerifyCode} size="sm" className="h-9">Confirm</Button>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="signup-email">Email (ID) *</Label>
                                        <Input id="signup-email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-password">Password *</Label>
                                        <Input id="signup-password" type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-10" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-aff">Affiliation</Label>
                                            <Input id="signup-aff" placeholder="University / Hospital" value={affiliation} onChange={e => setAffiliation(e.target.value)} className="h-10" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-license">License No. (Optional)</Label>
                                            <Input id="signup-license" placeholder="12345" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className="h-10" />
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-2 pt-4 bg-slate-50 p-4 rounded-lg border border-slate-100 mt-2">
                                        <UiCheckbox id="terms" checked={consent} onCheckedChange={(c) => setConsent(c === true)} />
                                        <div className="grid gap-1.5 leading-none">
                                            <div className="text-sm font-medium leading-none cursor-pointer text-slate-700 flex flex-wrap gap-1">
                                                Agree to 
                                                <button type="button" onClick={() => setViewingTerm({title: 'Terms of Service', content: platformTerms.terms})} className="text-blue-600 hover:underline">Terms</button>,
                                                <button type="button" onClick={() => setViewingTerm({title: 'Privacy Policy', content: platformTerms.privacy})} className="text-blue-600 hover:underline">Privacy</button>,
                                                &
                                                <button type="button" onClick={() => setViewingTerm({title: 'Third Party Consent', content: platformTerms.thirdParty})} className="text-blue-600 hover:underline">3rd Party</button>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-snug mt-1">
                                                By creating an account, you consent to share your basic profile information with the conferences you register for.
                                            </p>
                                        </div>
                                    </div>

                                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-semibold mt-2" disabled={loading}>
                                        {loading ? 'Creating Account...' : 'Create Account'}
                                    </Button>
                                </TabsContent>
                            </form>
                        </div>
                    </Tabs>
                </Card>

                {/* Benefits Footer */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-500 pt-4">
                    <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="font-medium">Fast Registration</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="font-medium">History Tracking</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="font-medium">Certificate Access</span>
                    </div>
                </div>
            </div>

            {/* Terms Modal */}
            <Dialog open={!!viewingTerm} onOpenChange={() => setViewingTerm(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{viewingTerm?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-md border font-mono">
                        {viewingTerm?.content || "No content available."}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserAuthPage;