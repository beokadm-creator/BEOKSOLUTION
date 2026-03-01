import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import toast from 'react-hot-toast';
import { Store, LogIn, ShieldAlert } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const auth = getAuth();
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check if this user is actually a vendor (owner, adminEmail, or staff)
            const vQuery1 = query(collection(db, 'vendors'), where('adminEmail', '==', user.email));
            const vQuery2 = query(collection(db, 'vendors'), where('ownerUid', '==', user.uid));
            const vQuery3 = query(collection(db, 'vendors'), where('staffEmails', 'array-contains', user.email));

            const [snap1, snap2, snap3] = await Promise.all([getDocs(vQuery1), getDocs(vQuery2), getDocs(vQuery3)]);

            if (snap1.empty && snap2.empty && snap3.empty) {
                // Not a vendor admin
                toast.error("등록된 관리자 권한이 없습니다. (슈퍼어드민에게 권한 부여를 요청하세요)");
                await auth.signOut();
                setLoading(false);
                return;
            }

            toast.success('로그인 성공!');
            navigate('/partner');
        } catch (error: any) {
            console.error('Vendor login failed:', error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                toast.error('이메일 또는 비밀번호가 올바르지 않습니다.');
            } else {
                toast.error('로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center text-indigo-600 mb-6">
                    <Store className="w-16 h-16 p-3 bg-white rounded-2xl shadow-sm border border-indigo-100" />
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                    Partner Portal
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    참여 학회 대시보드 및 리드 수집 시스템
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <Card className="shadow-xl border-t-4 border-t-indigo-600">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LogIn className="w-5 h-5" /> 파트너스 로그인
                        </CardTitle>
                        <CardDescription>
                            슈퍼어드민으로부터 부여받은 관리자 이메일과 비밀번호로 로그인하세요. (일반 로그인 계정과 동일할 수 있습니다)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email">이메일 계정 (Admin Email)</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@partner.com"
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">비밀번호</Label>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || !email || !password}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-lg font-bold"
                            >
                                {loading ? <LoadingSpinner text="로딩 중..." /> : '로그인'}
                            </Button>
                        </form>

                        <div className="mt-6 border-t border-gray-200 pt-6">
                            <div className="bg-orange-50 p-4 rounded-lg flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-orange-800">
                                    <p className="font-bold mb-1">처음 방문이신가요?</p>
                                    <p>eRegi 통합 마이페이지(UserHub)에서 먼저 회원가입을 완료하신 후, 해당 이메일 주소를 주최 측에 전달하여 파트너 관리자 권한을 요청해주세요.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
