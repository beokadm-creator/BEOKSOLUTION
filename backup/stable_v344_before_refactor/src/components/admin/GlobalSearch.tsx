import React, { useState } from 'react';
import { Search, Building, ShieldCheck, Mail, Phone } from 'lucide-react';
import { getFirestore, collection, query, where, getDocs, limit, startAt, endAt, orderBy } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import LoadingSpinner from '../common/LoadingSpinner';

interface SearchResult {
    uid: string;
    email: string;
    name: string;
    phoneNumber?: string;
    photoURL?: string;
    affiliations?: {
        [key: string]: {
            verified: boolean;
            grade?: string;
            role?: string;
        }
    };
    claims?: {
        admin?: boolean;
        isSuper?: boolean;
    };
}

export default function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async (term: string) => {
        setKeyword(term);
        if (term.length < 2) {
            setResults([]);
            setSearched(false);
            return;
        }

        setLoading(true);
        setSearched(true);
        const db = getFirestore();
        try {
            // Strategy: Search by Email (Exact) OR Name (Prefix)
            // Note: Firestore OR queries are limited. We'll parallelize.

            const usersRef = collection(db, 'users');

            // 1. Email Search
            const qEmail = query(usersRef, where('email', '>=', term), where('email', '<=', term + '\uf8ff'), limit(5));

            // 2. Name Search (requires index usually, but basic sorting works for prefix)
            // Assume 'name' field exists.
            const qName = query(usersRef, where('name', '>=', term), where('name', '<=', term + '\uf8ff'), limit(5));

            const [snapEmail, snapName] = await Promise.all([getDocs(qEmail), getDocs(qName)]);

            const hitMap = new Map<string, SearchResult>();

            snapEmail.forEach(d => hitMap.set(d.id, { uid: d.id, ...d.data() } as SearchResult));
            snapName.forEach(d => hitMap.set(d.id, { uid: d.id, ...d.data() } as SearchResult));

            setResults(Array.from(hitMap.values()));
        } catch (e) {
            console.error("Global Search Error:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* The Omni-Bar Trigger */}
            <div className="relative w-full max-w-2xl mx-auto">
                <div
                    onClick={() => setIsOpen(true)}
                    className="relative cursor-pointer group"
                >
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-amber-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        readOnly
                        className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-[#2a2a2a] text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-[#333] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 sm:text-sm shadow-lg transition-all"
                        placeholder="Omni-Search: Search Users by Name, Email..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <span className="text-gray-500 text-xs border border-gray-600 rounded px-1.5 py-0.5">⌘K</span>
                    </div>
                </div>
            </div>

            {/* Modal */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-3xl bg-gray-50">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Search className="w-5 h-5 text-amber-600" />
                            User Global Search
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <Input
                            autoFocus
                            placeholder="Type to search users..."
                            className="h-12 text-lg bg-white shadow-sm border-blue-100 focus:border-blue-500"
                            onChange={(e) => handleSearch(e.target.value)}
                            value={keyword}
                        />

                        <div className="min-h-[300px] max-h-[500px] overflow-y-auto pr-2">
                            {loading && <LoadingSpinner text="Scanning Database..." />}

                            {!loading && searched && results.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <p>No users found matching "{keyword}"</p>
                                </div>
                            )}

                            <div className="grid gap-3">
                                {results.map(user => (
                                    <div key={user.uid} className="bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex items-start justify-between group">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 bg-slate-100 flex items-center justify-center text-slate-500 font-bold shrink-0">
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{user.name?.[0] || 'U'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                                    {user.name || 'Unknown User'}
                                                    {user.claims?.isSuper && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Super Admin</Badge>}
                                                </h4>
                                                <div className="text-sm text-gray-500 space-y-0.5 mt-1">
                                                    <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user.email || 'No Email'}</p>
                                                    {user.phoneNumber && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {user.phoneNumber}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Society Badges */}
                                        <div className="flex flex-wrap gap-2 justify-end max-w-[200px]">
                                            {user.affiliations && Object.entries(user.affiliations).map(([socId, aff]: [string, any]) => {
                                                if (!aff || !aff.verified) return null;
                                                return (
                                                    <div key={socId} className="flex flex-col items-center">
                                                        <Badge variant="outline" className="bg-blue-50 text-[#003366] border-blue-200 font-mono gap-1">
                                                            <Building className="w-3 h-3" />
                                                            {socId.toUpperCase()}
                                                        </Badge>
                                                        {aff.grade && <span className="text-[10px] text-gray-400 mt-0.5">{aff.grade}</span>}
                                                    </div>
                                                );
                                            })}
                                            {(!user.affiliations || Object.keys(user.affiliations).length === 0) && <span className="text-xs text-gray-400 italic">No affiliations</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
