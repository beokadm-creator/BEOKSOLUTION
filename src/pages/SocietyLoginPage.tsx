import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useSociety } from '../hooks/useSociety';
import { toast } from 'react-hot-toast';
import { Lock } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { SUPER_ADMINS } from '../constants/defaults';
import { auth, db } from '../firebase';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';

const SocietyLoginPage: React.FC = () => {
    const { society, loading: socLoading } = useSociety();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();  // ✅ navigate 추가

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        console.log(`🔐 [SocietyLogin] Login attempt: ${email}`);

        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);

            const isSuperAdmin = SUPER_ADMINS.includes(email);

            console.log(`🔐 [SocietyLogin] User: ${email}, IsSuperAdmin: ${isSuperAdmin}`);

            if (society) {
                if (isSuperAdmin) {
                    console.log(`🔐 [SocietyLogin] SUPER_ADMIN bypassing society check`);
                    toast.success(`Welcome Super Admin to ${society.name.en}`);
                    
                    // ✅ sessionStorage에 Super Admin 정보 저장
                    sessionStorage.setItem('societyAdmin', 'true');
                    sessionStorage.setItem('societyId', society.id);
                    sessionStorage.setItem('isSuperAdmin', 'true');
                    
                    navigate('/admin/society');
                    return;
                }

                const socRef = doc(db, 'societies', society.id);
                const socSnap = await getDoc(socRef);

                if (!socSnap.exists()) throw new Error("Society data missing");

                const data = socSnap.data();
                const adminEmails = data.adminEmails || [];

                const isAuthorized = adminEmails.includes(email);

                console.log(`🔐 [SocietyLogin] Society: ${society.id}, Authorized: ${isAuthorized}, AdminEmails:`, adminEmails);

                if (!isAuthorized) {
                    await auth.signOut();
                    throw new Error("Unauthorized Access: You are not an admin of this society.");
                }

                toast.success(`Welcome back to ${society.name.en}`);
                
                // ✅ sessionStorage에 admin 정보 저장 (AdminGuard에서 확인용)
                sessionStorage.setItem('societyAdmin', 'true');
                sessionStorage.setItem('societyId', society.id);
                
                navigate('/admin/society');
            } else {
                toast.success("Logged in");
                navigate('/');
            }

        } catch (err) {
            console.error("🔐 [SocietyLogin] Error:", err);
            toast.error(`로그인 실패:\n${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    if (socLoading) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <h1 className="sr-only">Society Manager Login</h1>

            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-600/20 rotate-3 transform">
                        <Lock className="w-8 h-8 text-white -rotate-3" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Society Console</h2>
                    <p className="mt-2 text-slate-500 font-medium italic">Managerial Access Only</p>
                </div>

                <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white/80 backdrop-blur-sm">
                    <CardHeader className="text-center bg-slate-50/50 border-b border-slate-100 p-8">
                        {society ? (
                            <>
                                <CardTitle className="text-2xl font-black text-slate-800">{society.name.ko}</CardTitle>
                                <CardDescription className="font-bold text-blue-600">{society.name.en}</CardDescription>
                            </>
                        ) : (
                            <CardTitle className="text-xl font-bold">Admin Authentication</CardTitle>
                        )}
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@society.org"
                                    className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" title="Password" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Secure Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="•••••••••"
                                    className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                                disabled={loading}
                            >
                                {loading ? '로그인 중...' : 'Society Admin Login'}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="bg-slate-50/50 p-6">
                        <p className="text-xs text-slate-500 text-center w-full">
                            🔒 Authorized personnel only. All access attempts are logged.
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default SocietyLoginPage;
