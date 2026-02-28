import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useVendor } from '../../hooks/useVendor';
import * as XLSX from 'xlsx';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { BarChart3, Users, Clock, Download, PlusCircle, RefreshCw, QrCode } from 'lucide-react';

export default function VendorDashboardPage() {
    const { activeVendorId } = useOutletContext<{ activeVendorId: string }>();
    const navigate = useNavigate();

    const vendorLogic = useVendor(activeVendorId);
    const { vendor, loading, error, conferences, conferenceId, setConferenceId, visits } = vendorLogic;

    const handleExport = () => {
        if (!visits.length) return;

        const worksheet = XLSX.utils.json_to_sheet(visits.map((v: any) => ({
            'Name': v.userName || v.name || '',
            'Affiliation': v.userOrg || v.affiliation || '',
            'Scanned At': v.timestamp?.toDate ? v.timestamp.toDate().toLocaleString() : new Date(v.scannedAt || v.timestamp).toLocaleString(),
            'Conference': v.conferenceId
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
        XLSX.writeFile(workbook, `Vendor_Leads_${vendor?.name || 'Data'}.xlsx`);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard Data...</div>;

    if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                {conferences.length > 0 && (
                    <div className="flex gap-2 items-center bg-white border px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="text-sm text-gray-500">Active Campaign:</span>
                        <select
                            value={conferenceId || ''}
                            onChange={e => setConferenceId(e.target.value)}
                            className="bg-transparent border-none text-sm font-semibold focus:ring-0 text-indigo-700 p-0 cursor-pointer"
                        >
                            {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center h-32">
                        <Users className="w-8 h-8 text-blue-500 mb-2" />
                        <span className="text-2xl font-bold">{visits.length}</span>
                        <span className="text-sm text-gray-500">Total Leads</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center h-32">
                        <BarChart3 className="w-8 h-8 text-indigo-500 mb-2" />
                        <span className="text-2xl font-bold">{conferences.length}</span>
                        <span className="text-sm text-gray-500">Active Campaigns</span>
                    </CardContent>
                </Card>
                <Card className="bg-indigo-600 text-white cursor-pointer hover:bg-indigo-500 transition-colors" onClick={() => navigate('scanner')}>
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center h-32">
                        <QrCode className="w-8 h-8 opacity-80 mb-2" />
                        <span className="text-lg font-bold">Open Scanner</span>
                        <span className="text-sm text-indigo-200">Start capturing leads</span>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        <CardTitle>Recent Leads</CardTitle>
                        <CardDescription>Latest visitors scanned via your QR scanner</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={visits.length === 0}>
                        <Download className="w-4 h-4 mr-2" /> Export Excel
                    </Button>
                </CardHeader>
                <CardContent>
                    {visits.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 flex flex-col items-center">
                            <Clock className="w-12 h-12 mb-3 opacity-20" />
                            <p>No leads collected yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">Visitor Name</th>
                                        <th className="px-6 py-3">Affiliation</th>
                                        <th className="px-6 py-3">Conference</th>
                                        <th className="px-6 py-3">Scanned Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visits.slice(0, 10).map((v: any, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="px-6 py-4 font-medium">{v.userName || v.name}</td>
                                            <td className="px-6 py-4">{v.userOrg || v.affiliation || '-'}</td>
                                            <td className="px-6 py-4 text-gray-500">{v.conferenceId}</td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {v.timestamp?.toDate ? v.timestamp.toDate().toLocaleString() : new Date(v.scannedAt || v.timestamp).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
