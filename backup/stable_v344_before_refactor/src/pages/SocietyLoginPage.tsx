import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';
import { Lock } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useSociety } from '../hooks/useSociety';
import LoadingSpinner from '../components/common/LoadingSpinner';

const SocietyLoginPage: React.FC = () => {
    const { society, loading: socLoading } = useSociety();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("🔥 LOGIN TRIGGERED", { email, pwLen: password?.length });

        console.log("Society Login Attempt...");
        // [Debug] Log credential details (masked)
        console.log("LOGIN DEBUG:", { email, passwordLength: password?.length });

        setLoading(true);

        try {
            // 1. Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Society Guard
            if (society) {
                const socRef = doc(db, 'societies', society.id);
                const socSnap = await getDoc(socRef);

                if (!socSnap.exists()) throw new Error("Society data missing");

                const data = socSnap.data();
                const adminEmails = data.adminEmails || [];

                // 3. Permission Check (with Super Admin Bypass)
                const SUPER_ADMIN_EMAIL = 'aaron@beoksolution.com';

                if (!adminEmails.includes(email) && email !== SUPER_ADMIN_EMAIL) {
                    await auth.signOut();
                    throw new Error("Unauthorized Access: You are not an admin of this society.");
                }

                toast.success(`Welcome back to ${society.name.en}`);
                alert(`로그인 성공! ${society.name.en} 관리자 페이지로 이동합니다.`);
                navigate('/admin'); // Redirect to dashboard
            } else {
                // Fallback if no society context (shouldn't happen on subdomain)
                toast.success("Logged in");
                alert("로그인 성공! 이동합니다.");
                navigate('/');
            }

        } catch (err: any) {
            console.error("Society Login Error:", err);
            alert(`로그인 실패:\n${err.message}`);
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
                                    placeholder="••••••••"
                                    className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-600/20 transform active:scale-[0.98] transition-all" disabled={loading}>
                                {loading ? 'Authorizing...' : 'Enter Console'}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="justify-center border-t border-slate-50 p-6 bg-slate-50/30">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                            Powered by eRegi SaaS Platform
                        </p>
                    </CardFooter>
                </Card>

                <div className="text-center">
                    <button onClick={() => navigate('/')} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-4">
                        Return to Hub
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SocietyLoginPage;
