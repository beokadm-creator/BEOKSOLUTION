import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Shield, Plus, X, Globe, Save, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
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

        let origin = newOrigin.trim();
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
            toast.success("Origin added successfully");
        } catch (e) {
            console.error("Error adding origin", e);
            toast.error("Failed to add origin");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveOrigin = async (origin: string) => {
        if (!confirm(`Remove ${origin} from allowed access list?`)) return;

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
        <div className="p-8 max-w-5xl mx-auto space-y-8 bg-[#0a0a0a] min-h-screen text-slate-200">
            {/* Header Section */}
            <div className="flex items-center justify-between pb-6 border-b border-[#222]">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <Shield className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Security Policy Manager</h1>
                        <p className="text-slate-500 text-sm mt-1">Configure global Cross-Origin Resource Sharing (CORS) rules</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchSecuritySettings}
                    className="border-[#333] hover:bg-[#222] text-slate-400 hover:text-white transition-all"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Policy
                </Button>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Origin List */}
                <Card className="lg:col-span-2 bg-[#111] border-[#222] shadow-2xl overflow-hidden">
                    <CardHeader className="border-b border-[#222] bg-[#151515]">
                        <CardTitle className="text-white flex items-center gap-2 text-lg">
                            <Globe className="w-5 h-5 text-blue-400" />
                            Allowed Origins
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            The following domains are permitted to interact with the API.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        {loading ? (
                            <div className="flex h-40 items-center justify-center">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Input Form */}
                                <form onSubmit={handleAddOrigin} className="flex gap-3 items-end">
                                    <div className="flex-1 space-y-2">
                                        <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Origin URL</Label>
                                        <Input
                                            value={newOrigin}
                                            onChange={(e) => setNewOrigin(e.target.value)}
                                            placeholder="https://dashboard.example.com"
                                            className="bg-[#0a0a0a] border-[#333] text-white placeholder:text-slate-700 h-10 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>
                                    <Button type="submit" disabled={saving || !newOrigin} className="bg-blue-600 hover:bg-blue-500 text-white h-10 px-6 font-medium shadow-[0_0_10px_rgba(37,99,235,0.2)]">
                                        {saving ? <LoadingSpinner /> : <><Plus className="w-4 h-4 mr-2" /> Authorize</>}
                                    </Button>
                                </form>

                                <div className="h-px bg-[#222]" />

                                {/* Origins List */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Active Rules ({allowedOrigins.length})</Label>

                                    {allowedOrigins.length === 0 && (
                                        <div className="p-8 border border-dashed border-[#333] rounded-lg text-center bg-[#0f0f0f]">
                                            <AlertTriangle className="w-8 h-8 text-amber-500/50 mx-auto mb-3" />
                                            <p className="text-slate-500 text-sm">No origins configured. The API denies all CORS requests by default.</p>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-3">
                                        {allowedOrigins.map((origin) => (
                                            <Badge
                                                key={origin}
                                                variant="outline"
                                                className="pl-3 pr-1.5 py-1.5 gap-3 bg-[#1a1a1a] border-[#333] text-slate-300 hover:bg-[#222] hover:border-slate-600 transition-all group"
                                            >
                                                <span className="font-mono text-sm">{origin}</span>
                                                <button
                                                    onClick={() => handleRemoveOrigin(origin)}
                                                    className="bg-black/20 hover:bg-red-500/20 hover:text-red-400 text-slate-600 rounded-full p-1 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right: Info Panel */}
                <div className="space-y-6">
                    <Card className="bg-[#111] border-[#222] shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-base text-white">Security Snapshot</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#333]">
                                <div className="p-2 bg-green-500/10 rounded-full text-green-500">
                                    <CheckCircle className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-200">Active Policy</p>
                                    <p className="text-xs text-slate-500">Database-backed config</p>
                                </div>
                            </div>

                            <div className="text-xs text-slate-500 leading-relaxed space-y-2">
                                <p>
                                    <span className="text-amber-500 font-bold">Latency Warning:</span> Changes to CORS origins propagate to Cloud Functions instances immediately upon their next cold start or cache refresh (typ. 5-10m).
                                </p>
                                <p>
                                    Ensure you include the protocol (https://) and exclude any trailing slashes when adding new domains.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-4 rounded-lg border border-blue-900/30 bg-blue-900/10">
                        <h4 className="text-blue-400 font-bold text-sm mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Best Practice
                        </h4>
                        <p className="text-xs text-blue-200/60 leading-relaxed">
                            Restrict allowed origins only to trusted domains. Allowing wildcards or untrusted domains can expose user data to XSS attacks.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
