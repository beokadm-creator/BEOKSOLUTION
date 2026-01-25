import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../../firebase';
// import { useNavigate } from 'react-router-dom'; // Removed: Using window.location.href
import toast from 'react-hot-toast';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../../components/ui/card';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

const AdminLoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. LOGIC: Input Sanitization
            const safeEmail = email.trim();
            const safePassword = password.trim();

            const userCredential = await signInWithEmailAndPassword(auth, safeEmail, safePassword);
            const user = userCredential.user;

            // 2. LOGIC: Strict Access Control
            if (user.email !== 'aaron@beoksolution.com') {
                await signOut(auth);
                setError("Access Denied: Super Admin Only");
                toast.error("Access Denied: Super Admin Only");
                return; // Stop here
            }

            // 3. LOGIC: Clean Redirect
            toast.success("Welcome, Super Admin");
            window.location.href = '/super'; // Hard Redirect

        } catch (err: any) {
            console.error("Login Error:", err);
            setError(`Login Failed: ${err.message}`);
            toast.error(`Login Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center">Super Admin Login</CardTitle>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-bold text-center">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input 
                                id="email" 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                required 
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <LoadingSpinner /> : 'Login'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="justify-center text-xs text-gray-500">
                    eRegi Super Admin
                </CardFooter>
            </Card>
        </div>
    );
};

export default AdminLoginPage;
