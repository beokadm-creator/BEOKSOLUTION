import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Shield, Plus, X, Globe, Save, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

export default function SecurityPolicyManager() {
    const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);
    const [newOrigin, setNewOrigin] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchSecuritySettings = async () => {
        setLoading(true);
        try {
            // Assuming we store this in system/settings or system/security
            // The prompt says "Security Engine", let's use system/security for clearer separation or system/settings if that's the convention.
            // SuperAdminPage uses system/settings. Let's check if it has allowedOrigins.
            // I'll use system/settings for now as it's already there.
            const docRef = doc(db, 'system', 'settings');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setAllowedOrigins(data.allowedOrigins || []);
            }
        } catch (e) {
            console.error("Failed to fetch security settings", e);
            toast.error("Failed to load security policy");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecuritySettings();
    }, []);

    const handleAddOrigin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrigin) return;
        
        // Basic validation
        let origin = newOrigin.trim();
        // Remove trailing slash
        if (origin.endsWith('/')) origin = origin.slice(0, -1);
        
        if (allowedOrigins.includes(origin)) {
            toast.error("Origin already exists");
            return;
        }

        try {
            setSaving(true);
            const docRef = doc(db, 'system', 'settings');
            await setDoc(docRef, {
                allowedOrigins: arrayUnion(origin),
                updatedAt: new Date()
            }, { merge: true });
            
            setAllowedOrigins(prev => [...prev, origin]);
            setNewOrigin('');
            toast.success("Origin added to CORS policy");
        } catch (e) {
            console.error("Error adding origin", e);
            toast.error("Failed to add origin");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveOrigin = async (origin: string) => {
        if (!confirm(`Remove ${origin} from allowed origins?`)) return;

        try {
            setSaving(true);
            const docRef = doc(db, 'system', 'settings');
            await updateDoc(docRef, {
                allowedOrigins: arrayRemove(origin)
            });
            
            setAllowedOrigins(prev => prev.filter(o => o !== origin));
            toast.success("Origin removed");
        } catch (e) {
            console.error("Error removing origin", e);
            toast.error("Failed to remove origin");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <Shield className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Security Policy Manager</h1>
                    <p className="text-slate-400">Configure CORS and Access Control Policies</p>
                </div>
            </div>

            <Card className="bg-[#1a1a1a] border-[#333] text-slate-200">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-400" />
                        CORS Allowed Origins
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Domains listed here will be permitted to access the API via CORS.
                        Changes typically take effect within 5-10 minutes on the edge.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {allowedOrigins.length === 0 && (
                                    <span className="text-slate-500 italic">No origins configured. API may be restricted.</span>
                                )}
                                {allowedOrigins.map((origin) => (
                                    <Badge key={origin} variant="outline" className="pl-3 pr-1 py-1 gap-2 bg-[#252525] border-[#444] text-slate-200 hover:bg-[#333]">
                                        {origin}
                                        <button 
                                            onClick={() => handleRemoveOrigin(origin)}
                                            className="hover:bg-red-500/20 hover:text-red-400 rounded-full p-0.5 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>

                            <form onSubmit={handleAddOrigin} className="flex gap-4">
                                <div className="flex-1">
                                    <Label className="text-xs text-slate-500 mb-1.5 block">Add New Origin</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={newOrigin}
                                            onChange={(e) => setNewOrigin(e.target.value)}
                                            placeholder="https://admin.eregi.co.kr" 
                                            className="bg-[#252525] border-[#444] text-white placeholder:text-slate-600"
                                        />
                                        <Button type="submit" disabled={saving || !newOrigin} className="bg-blue-600 hover:bg-blue-700 text-white">
                                            {saving ? <LoadingSpinner /> : <><Plus className="w-4 h-4 mr-2" /> Add</>}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        * Must include protocol (https://). Do not include trailing slash.
                                    </p>
                                </div>
                            </form>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="bg-amber-900/20 border border-amber-900/50 rounded-lg p-4 text-sm text-amber-200/80">
                <strong>Note:</strong> This configuration updates the database. The Cloud Functions must be configured to read this list dynamically for it to take effect.
            </div>
        </div>
    );
}
