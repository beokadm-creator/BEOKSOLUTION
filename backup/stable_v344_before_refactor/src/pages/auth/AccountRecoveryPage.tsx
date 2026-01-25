import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { ArrowLeft, Mail, Phone, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const AccountRecoveryPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('find-id');
    const [loading, setLoading] = useState(false);

    // Find ID State
    const [searchType, setSearchType] = useState<'phone' | 'license'>('phone');
    const [findIdName, setFindIdName] = useState('');
    const [findIdPhone, setFindIdPhone] = useState('');
    const [findIdLicense, setFindIdLicense] = useState('');
    const [foundEmail, setFoundEmail] = useState<string | null>(null);

    // Reset PW State
    const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
    const [resetStep, setResetStep] = useState<'verify' | 'reset-input'>('verify');
    
    const [resetEmail, setResetEmail] = useState('');
    const [resetName, setResetName] = useState('');
    const [resetPhone, setResetPhone] = useState('');
    
    // New Password Inputs
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // Phone Verification State (Mock)
    const [verificationCode, setVerificationCode] = useState('');
    const [sentCode, setSentCode] = useState('');
    const [showVerifyInput, setShowVerifyInput] = useState(false);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);

    // --- Logic: Find ID ---
    const handleFindId = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFoundEmail(null);

        try {
            // Query users by name and (phone OR license)
            const usersRef = collection(db, 'users');
            let q;

            if (searchType === 'phone') {
                q = query(
                    usersRef, 
                    where('name', '==', findIdName),
                    where('phone', '==', findIdPhone)
                );
            } else {
                q = query(
                    usersRef, 
                    where('name', '==', findIdName),
                    where('licenseNumber', '==', findIdLicense)
                );
            }
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                toast.error(`No account found with this name and ${searchType === 'phone' ? 'phone number' : 'license number'}.`);
            } else {
                // Get the first match
                const userData = querySnapshot.docs[0].data();
                const email = userData.email;
                
                // Mask the email: te**@gmail.com
                const [local, domain] = email.split('@');
                const maskedLocal = local.length > 2 
                    ? local.substring(0, 2) + '*'.repeat(local.length - 2)
                    : local; // Don't mask if too short
                
                setFoundEmail(`${maskedLocal}@${domain}`);
                toast.success("Account found!");
            }
        } catch (error: any) {
            console.error("Error finding account:", error);
            toast.error("Failed to search for account. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // --- Logic: Reset PW (Email) ---
    const handleResetPwByEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            await sendPasswordResetEmail(auth, resetEmail);
            toast.success("Password reset link sent to your email.");
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/user-not-found') {
                toast.error("No account found with this email.");
            } else if (error.code === 'auth/invalid-email') {
                toast.error("Invalid email format.");
            } else {
                toast.error("Failed to send reset email.");
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Logic: Reset PW (Phone) ---
    const handleSendCode = () => {
        if (!resetName || !resetPhone) {
            toast.error("Please enter name and phone number.");
            return;
        }
        
        // Mock verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setSentCode(code);
        setShowVerifyInput(true);
        toast.success(`Verification code sent! (Mock: ${code})`);
    };

    const handleVerifyCode = async () => {
        if (verificationCode === sentCode) {
            setIsPhoneVerified(true);
            setShowVerifyInput(false);
            toast.success("Phone verified successfully!");
            
            // Instead of auto-sending email, move to reset input step
            setResetStep('reset-input');
        } else {
            toast.error("Invalid verification code.");
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try {
            // Mock Update Logic (Since client SDK can't force update without re-auth)
            // In a real app, you would call a Cloud Function here: `updateUserPassword({ uid, newPassword })`
            // or rely on the email link method.
            
            // For this UI demo, we simulate success
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            alert("Password successfully updated! Please log in with your new password.");
            window.location.href = '/portal';
            
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 font-sans">
            <div className="w-full max-w-lg space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-slate-900">Account Recovery</h1>
                    <p className="text-slate-600">Find your ID or reset your password.</p>
                </div>

                <Card className="shadow-xl border-slate-100 overflow-hidden bg-white rounded-xl">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="bg-slate-50 border-b border-slate-100 px-6 pt-6">
                            <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-200/50 p-1 rounded-lg">
                                <TabsTrigger value="find-id" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Find ID</TabsTrigger>
                                <TabsTrigger value="reset-pw" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Reset Password</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="p-6">
                            {/* --- TAB: FIND ID --- */}
                            <TabsContent value="find-id" className="space-y-4 mt-0">
                                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${searchType === 'phone' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                                        onClick={() => setSearchType('phone')}
                                    >
                                        Name + Phone (Domestic)
                                    </button>
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${searchType === 'license' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                                        onClick={() => setSearchType('license')}
                                    >
                                        Name + License (Intl)
                                    </button>
                                </div>

                                <form onSubmit={handleFindId} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="find-name">Full Name</Label>
                                        <Input 
                                            id="find-name" 
                                            placeholder="John Doe" 
                                            value={findIdName} 
                                            onChange={e => setFindIdName(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                    
                                    {searchType === 'phone' ? (
                                        <div className="space-y-2">
                                            <Label htmlFor="find-phone">Phone Number</Label>
                                            <Input 
                                                id="find-phone" 
                                                placeholder="010-1234-5678" 
                                                value={findIdPhone} 
                                                onChange={e => setFindIdPhone(e.target.value)} 
                                                required 
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label htmlFor="find-license">License Number</Label>
                                            <Input 
                                                id="find-license" 
                                                placeholder="License Number" 
                                                value={findIdLicense} 
                                                onChange={e => setFindIdLicense(e.target.value)} 
                                                required 
                                            />
                                        </div>
                                    )}
                                    
                                    {foundEmail && (
                                        <div className="p-4 bg-blue-50 text-blue-800 rounded-md text-center border border-blue-100">
                                            Your ID (Email) is: <br/>
                                            <span className="font-bold text-lg">{foundEmail}</span>
                                        </div>
                                    )}

                                    <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading}>
                                        {loading ? 'Searching...' : 'Find Email'}
                                    </Button>
                                </form>
                            </TabsContent>

                            {/* --- TAB: RESET PASSWORD --- */}
                            <TabsContent value="reset-pw" className="space-y-4 mt-0">
                                {resetStep === 'verify' ? (
                                    <>
                                        <div className="flex space-x-2 mb-4">
                                            <Button 
                                                type="button" 
                                                variant={resetMethod === 'email' ? 'default' : 'outline'} 
                                                onClick={() => setResetMethod('email')}
                                                className="flex-1 text-xs"
                                                size="sm"
                                            >
                                                <Mail className="w-3 h-3 mr-2" /> Via Email
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant={resetMethod === 'phone' ? 'default' : 'outline'} 
                                                onClick={() => setResetMethod('phone')}
                                                className="flex-1 text-xs"
                                                size="sm"
                                            >
                                                <Phone className="w-3 h-3 mr-2" /> Via Phone
                                            </Button>
                                        </div>

                                        {resetMethod === 'email' ? (
                                            <form onSubmit={handleResetPwByEmail} className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="reset-email">Enter your Email</Label>
                                                    <Input 
                                                        id="reset-email" 
                                                        type="email" 
                                                        placeholder="name@example.com" 
                                                        value={resetEmail} 
                                                        onChange={e => setResetEmail(e.target.value)} 
                                                        required 
                                                    />
                                                </div>
                                                <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading}>
                                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                                </Button>
                                            </form>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Full Name</Label>
                                                    <Input 
                                                        placeholder="John Doe" 
                                                        value={resetName} 
                                                        onChange={e => setResetName(e.target.value)} 
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Phone Number</Label>
                                                    <div className="flex gap-2">
                                                        <Input 
                                                            placeholder="010-1234-5678" 
                                                            value={resetPhone} 
                                                            onChange={e => setResetPhone(e.target.value)} 
                                                            disabled={isPhoneVerified}
                                                        />
                                                        {!isPhoneVerified && (
                                                            <Button type="button" onClick={handleSendCode} variant="outline">
                                                                Verify
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

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
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    // --- STEP 2: NEW PASSWORD INPUT ---
                                    <form onSubmit={handleUpdatePassword} className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                        <div className="text-center pb-2">
                                            <h3 className="font-semibold text-lg text-green-700">Verification Successful</h3>
                                            <p className="text-xs text-slate-500">Please enter your new password.</p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="new-pw">New Password</Label>
                                            <Input 
                                                id="new-pw" 
                                                type="password" 
                                                placeholder="Min 6 characters" 
                                                value={newPassword} 
                                                onChange={e => setNewPassword(e.target.value)} 
                                                required 
                                                minLength={6}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirm-pw">Confirm Password</Label>
                                            <Input 
                                                id="confirm-pw" 
                                                type="password" 
                                                placeholder="Re-enter password" 
                                                value={confirmPassword} 
                                                onChange={e => setConfirmPassword(e.target.value)} 
                                                required 
                                            />
                                        </div>

                                        <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading}>
                                            {loading ? 'Updating...' : 'Update Password'}
                                        </Button>
                                    </form>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                    
                    <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                        <Link to="/auth" className="text-sm text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> Back to Login
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AccountRecoveryPage;
