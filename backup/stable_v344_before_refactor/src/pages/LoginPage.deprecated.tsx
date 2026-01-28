import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '../components/ui/card';
import { Lock, UserPlus, LogIn, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

const LoginPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get('returnUrl');
    const isUserFlow = !!returnUrl;

    // Reset fields when switching tabs
    useEffect(() => {
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
        setAffiliation('');
        setLicenseNumber('');
        setConsent(false);
    }, [activeTab]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (activeTab === 'signup') {
                // --- SIGN UP FLOW ---
                if (!consent) throw new Error("You must agree to the Terms and Privacy Policy.");
                if (!name || !phone || !email || !password) throw new Error("Please fill in all required fields.");

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Update Auth Profile
                await updateProfile(user, { displayName: name });

                // Create User Document in 'users' collection
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    name: name,
                    phone: phone,
                    organization: affiliation,
                    licenseNumber: licenseNumber, // New Field
                    createdAt: Timestamp.now(),
                    role: 'USER', // Default role
                    consents: {
                        terms: true,
                        privacy: true,
                        thirdParty: true, // Implied by platform sign-up for conference usage
                        timestamp: Timestamp.now()
                    }
                });

                toast.success("Account created successfully!");
            } else {
                // --- SIGN IN FLOW ---
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
            }

            // [Fix-Step 118] PRIORITY OVERRIDE
            // If returnUrl exists, ALWAYS redirect there first.
            // Do NOT let subdomain logic hijack the flow for users.
            if (returnUrl) {
                navigate(returnUrl);
                return;
            }

            // Domain-based Admin Routing (Legacy Support)
            // This code only executes if NO returnUrl is present (i.e. direct access)
            const host = window.location.hostname;
            const parts = host.split('.');
            
            // Scenario A: Super Admin
            if (host === 'admin.eregi.co.kr' || (host.includes('localhost') && email === 'admin@eregi.co.kr')) {
                toast.success("Welcome, Super Administrator");
                navigate('/admin/super');
                return;
            }

            // Scenario B: Society Admin
            if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                const societyId = parts[0];
                const socRef = doc(db, 'societies', societyId);
                const socSnap = await getDoc(socRef);
                
                if (socSnap.exists()) {
                    const socData = socSnap.data();
                    const adminEmails = socData.adminEmails || [];
                    if (adminEmails.includes(email)) {
                        toast.success(`Welcome to ${socData.name.en} Admin Dashboard`);
                        navigate('/admin');
                        return;
                    }
                }
            }

            // Default User: Go to MyPage or Home
            toast.success(activeTab === 'signup' ? "Registered & Logged In" : "Logged in successfully");
            navigate('/'); 

        } catch (err: any) {
            console.error(err);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- ADMIN VIEW ---
    if (!isUserFlow) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
                 <Card className="w-full max-w-md shadow-lg border-slate-200">
                    <CardHeader className="space-y-1 text-center bg-slate-50 rounded-t-lg pb-6 border-b">
                        <div className="flex justify-center mb-4">
                            <div className="p-3 bg-slate-200 rounded-full">
                                <Lock className="w-6 h-6 text-slate-700" />
                            </div>
                        </div>
                        <CardTitle className="text-xl font-bold text-slate-800">Admin Portal Login</CardTitle>
                        <CardDescription>Authorized personnel only</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleAuth}>
                        <CardContent className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading}>
                                {loading ? 'Verifying...' : 'Access Dashboard'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        );
    }

    // --- USER VIEW (Dual Mode) ---
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
            <div className="w-full max-w-lg space-y-6">
                
                {/* Marketing Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">Welcome to e-Regi</h1>
                    <p className="text-slate-600">Sign up once, register for multiple conferences easily.</p>
                </div>

                <Card className="shadow-xl border-slate-100 overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="bg-slate-50 border-b border-slate-100 px-6 pt-6">
                             <TabsList className="grid w-full grid-cols-2 h-12">
                                <TabsTrigger value="login" className="text-base font-medium">Log In</TabsTrigger>
                                <TabsTrigger value="signup" className="text-base font-medium">Sign Up</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleAuth}>
                                <TabsContent value="login" className="space-y-4 mt-0">
                                    <div className="space-y-2">
                                        <Label htmlFor="login-email">Email</Label>
                                        <Input id="login-email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
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
                                        <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                                    </div>
                                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg" disabled={loading}>
                                        {loading ? 'Logging in...' : 'Log In'}
                                    </Button>
                                </TabsContent>

                                <TabsContent value="signup" className="space-y-4 mt-0">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-name">Full Name *</Label>
                                            <Input id="signup-name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-phone">Phone *</Label>
                                            <Input id="signup-phone" placeholder="010-1234-5678" value={phone} onChange={e => setPhone(e.target.value)} required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-email">Email (ID) *</Label>
                                        <Input id="signup-email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-password">Password *</Label>
                                        <Input id="signup-password" type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-aff">Affiliation</Label>
                                            <Input id="signup-aff" placeholder="University / Hospital" value={affiliation} onChange={e => setAffiliation(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-license">License No. (Optional)</Label>
                                            <Input id="signup-license" placeholder="12345" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-2 pt-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                        <Checkbox id="terms" checked={consent} onCheckedChange={(c) => setConsent(c === true)} />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label
                                                htmlFor="terms"
                                                className="text-sm font-medium leading-none cursor-pointer"
                                            >
                                                Agree to Terms & Privacy Policy
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                By creating an account, you consent to share your basic profile information with the conferences you register for.
                                            </p>
                                        </div>
                                    </div>

                                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg" disabled={loading}>
                                        {loading ? 'Creating Account...' : 'Create Account'}
                                    </Button>
                                </TabsContent>
                            </form>
                        </div>
                    </Tabs>
                </Card>

                {/* Benefits Footer */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Fast Registration</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>History Tracking</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Certificate Access</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
