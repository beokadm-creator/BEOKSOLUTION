import React, { useState } from 'react';
import { useSociety } from '../../hooks/useSociety';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Trash2, UserPlus, Link as LinkIcon, AlertTriangle } from 'lucide-react';

export default function AdminUsersPage() {
    const { society, loading: societyLoading } = useSociety();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    
    // Linking State
    const [linkMode, setLinkMode] = useState<{ active: boolean, existingUser?: any }>({ active: false });

    if (societyLoading) return <div>로딩 중...</div>;
    if (!society) return <div>No society context found.</div>;

    const adminEmails = society.adminEmails || [];

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setName('');
        setLinkMode({ active: false });
        setCreateModalOpen(false);
    };

    const handleCreateOrLink = async (forceLink = false) => {
        if (!email) return toast.error('Email is required');
        if (!forceLink && !password && !linkMode.active) return toast.error('Password is required for new users');

        setLoadingAction(true);
        const createFn = httpsCallable(functions, 'createSocietyAdminUser');

        try {
            const result = await createFn({
                email,
                password,
                name,
                societyId: society.id,
                forceLink: forceLink || linkMode.active
            });

            const data = result.data as any;

            if (data.success === false && data.code === 'auth/email-already-exists') {
                // Prompt to link
                setLinkMode({ active: true, existingUser: data.existingUser });
                toast.error('User already exists. Please confirm linking.');
                setLoadingAction(false);
                return;
            }

            if (data.warning) {
                toast('User created but with warnings: ' + data.warning, { icon: '⚠️' });
            } else {
                toast.success(forceLink || linkMode.active ? 'User linked successfully' : 'Admin created successfully');
            }
            
            resetForm();
            // In a real app, we might need to refresh the society doc manually if real-time listener isn't fast enough
            // But useSociety uses onSnapshot, so it should auto-update.

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to create/link admin');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleRemove = async (targetEmail: string) => {
        if (!confirm(`Are you sure you want to remove access for ${targetEmail}?`)) return;

        setLoadingAction(true);
        const removeFn = httpsCallable(functions, 'removeSocietyAdminUser');
        
        try {
            await removeFn({ email: targetEmail, societyId: society.id });
            toast.success('Access removed');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to remove admin');
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Admin Users</h1>
                <Button onClick={() => setCreateModalOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Admin
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {adminEmails.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-center text-gray-500">No admins found (this is strange)</td>
                            </tr>
                        ) : adminEmails.map((email: string) => (
                            <tr key={email}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Button variant="ghost" className="text-red-600 hover:text-red-900" onClick={() => handleRemove(email)} disabled={loadingAction}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Link Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {linkMode.active ? 'Link Existing User' : 'Add New Admin'}
                        </h2>

                        {linkMode.active ? (
                            <div className="mb-4 bg-amber-50 border border-amber-200 p-3 rounded">
                                <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    User Exists
                                </div>
                                <p className="text-sm text-amber-700">
                                    An account with email <strong>{email}</strong> already exists.
                                </p>
                                <p className="text-sm text-amber-700 mt-1">
                                    Do you want to grant them admin access to this society?
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input 
                                        type="email" 
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input 
                                        type="text" 
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password</label>
                                    <input 
                                        type="password" 
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <Button variant="outline" onClick={resetForm} disabled={loadingAction}>
                                취소
                            </Button>
                            
                            {linkMode.active ? (
                                <Button onClick={() => handleCreateOrLink(true)} disabled={loadingAction} className="bg-amber-600 hover:bg-amber-700 text-white">
                                    <LinkIcon className="w-4 h-4 mr-2" />
                                    Yes, Link User
                                </Button>
                            ) : (
                                <Button onClick={() => handleCreateOrLink(false)} disabled={loadingAction}>
                                    Create Admin
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
