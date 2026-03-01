import React, { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useVendor } from '../../hooks/useVendor';
import * as XLSX from 'xlsx';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { BarChart3, Users, Clock, Download, QrCode, Search, Building2, Phone, Mail, MapPin } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorDashboardPage() {
    const { activeVendorId } = useOutletContext<{ activeVendorId: string }>();
    const navigate = useNavigate();

    const vendorLogic = useVendor(activeVendorId);
    const { vendor, loading, error, conferences, visits } = vendorLogic;

    const [selectedConfId, setSelectedConfId] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const confMap = useMemo(() => {
        const m = new Map<string, string>();
        conferences.forEach(c => m.set(c.id, c.name));
        return m;
    }, [conferences]);

    const filteredLeads = useMemo(() => {
        let res = visits;
        if (selectedConfId !== 'all') {
            res = res.filter(v => v.conferenceId === selectedConfId);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(v =>
                ((v.visitorName || v.userName || v.name) as string || '').toLowerCase().includes(lower) ||
                ((v.visitorOrg || v.userOrg || v.affiliation) as string || '').toLowerCase().includes(lower) ||
                (v.visitorPhone || '').includes(lower) ||
                (v.visitorEmail || '').toLowerCase().includes(lower)
            );
        }
        return res;
    }, [visits, selectedConfId, searchTerm]);

    const handleExport = () => {
        if (!filteredLeads.length) return;

        const worksheet = XLSX.utils.json_to_sheet(filteredLeads.map((v: any) => ({
            'Name': v.visitorName || v.userName || v.name || '알 수 없음',
            'Affiliation': v.visitorOrg || v.userOrg || v.affiliation || '',
            'Phone': v.visitorPhone || '',
            'Email': v.visitorEmail || '',
            'Conference': confMap.get(v.conferenceId) || v.conferenceId,
            'Scanned At': v.timestamp?.toDate ? v.timestamp.toDate().toLocaleString() : new Date(v.scannedAt || v.timestamp).toLocaleString(),
            'Consent': v.isConsentAgreed ? 'Yes' : 'No (Anonymous)'
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
        XLSX.writeFile(workbook, `Vendor_Leads_${vendor?.name || 'CRM_Data'}.xlsx`);
    };

    if (loading) return <div className="p-8 flex justify-center text-gray-500"><LoadingSpinner /></div>;

    if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Partner CRM Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-1">학술대회 참가 현황 및 방문 고객(Lead) 데이터를 통합 관리하세요.</p>
                </div>
                <Button onClick={() => navigate('scanner')} className="bg-indigo-600 hover:bg-indigo-700 font-bold whitespace-nowrap shadow-sm h-11 px-6">
                    <QrCode className="w-5 h-5 mr-2" /> 모바일 스캐너 열기
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-gray-500 text-sm font-medium">총 누적 리드 (Total Leads)</span>
                            <Users className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="text-3xl font-bold text-indigo-900">{visits.length}</div>
                        <p className="text-xs text-indigo-400 mt-1">모든 행사의 총합 (중복 포함)</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-gray-500 text-sm font-medium">참여 학술대회 (Active Campaigns)</span>
                            <MapPin className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-3xl font-bold text-blue-900">{conferences.length}</div>
                        <p className="text-xs text-blue-400 mt-1">스폰서로 활발히 활동 중인 학회</p>
                    </CardContent>
                </Card>
                <Card className="col-span-1 lg:col-span-2 bg-gradient-to-br from-slate-50 to-white border-slate-200">
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-3 rounded-full flex-shrink-0">
                                <BarChart3 className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                    효율적인 현장 CRM 지원
                                    <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full uppercase">Beta</span>
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">부스에 방문하여 스캔한 고객들의 연락처를 엑셀로 한 번에 추출해서 향후 영업 및 마케팅(리마케팅)에 적극 활용해보세요.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Campaign Selection Grid */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-500" /> 내 캠페인 (참가 중인 학술대회)
                    </h2>
                </div>
                {conferences.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-6 text-center text-gray-500 shadow-inner">
                        현재 관리(스폰서)로 등록된 학술대회 내역이 없습니다. (슈퍼어드민 혹은 학회 어드민에게 문의하세요.)
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {/* 'All' card */}
                        <div
                            onClick={() => setSelectedConfId('all')}
                            className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${selectedConfId === 'all' ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-500 scale-[1.02]' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'}`}
                        >
                            <div className="font-bold text-sm text-gray-900">🌟 전체 데이터 통합 조회</div>
                            <div className="mt-3 text-2xl font-bold text-indigo-600">{visits.length} <span className="text-xs font-normal text-gray-500">Leads 전체</span></div>
                        </div>

                        {/* Individual Conference Cards */}
                        {conferences.map(conf => {
                            const confLeads = visits.filter(v => v.conferenceId === conf.id).length;
                            const isSelected = selectedConfId === conf.id;
                            return (
                                <div
                                    key={conf.id}
                                    onClick={() => setSelectedConfId(conf.id)}
                                    className={`cursor-pointer flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 ${isSelected ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500 scale-[1.02]' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'}`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5 pl-0.5">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                            <span className="text-[10px] font-bold uppercase text-green-600 tracking-wider">Active</span>
                                        </div>
                                        <div className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight" title={conf.name}>{conf.name}</div>
                                    </div>
                                    <div className="mt-4 flex justify-end items-end gap-1">
                                        <span className="text-3xl font-bold text-blue-600 leading-none">{confLeads}</span>
                                        <span className="text-xs font-medium text-gray-500 pb-0.5">Leads</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CRM Lead Viewer Section */}
            <Card className="shadow-md border border-gray-200">
                <CardHeader className="bg-gray-50/80 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 py-5 px-6">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">Lead Database <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold">{filteredLeads.length}건</span></CardTitle>
                        <CardDescription className="mt-1">
                            {selectedConfId === 'all' ? '모든 학술대회에서 스캔한 전체 방명록 리스트입니다.' : '선택한 학술대회의 수집 데이터만 표시합니다.'}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="이름, 소속, 휴대폰, 이메일 검색..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 w-full sm:w-64 shadow-sm"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredLeads.length === 0} className="whitespace-nowrap bg-white border-gray-300 shadow-sm h-10 px-4">
                            <Download className="w-4 h-4 mr-2" /> 엑셀 다운로드
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredLeads.length === 0 ? (
                        <div className="py-20 text-center text-gray-500 flex flex-col items-center bg-gray-50/30">
                            <Clock className="w-12 h-12 mb-3 opacity-20" />
                            <p className="font-medium">검색 결과 또는 수집 데이터가 없습니다.</p>
                            <p className="text-sm mt-1 text-gray-400">현장에서 QR 코드를 스캔하여 데이터를 수집하세요.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="sticky top-0 text-xs text-slate-500 uppercase bg-slate-100 shadow-[0_1px_0_0_#e2e8f0] z-10">
                                    <tr>
                                        <th className="px-6 py-4 font-bold tracking-wider">방문자 성함</th>
                                        <th className="px-6 py-4 font-bold tracking-wider">소속 정보</th>
                                        <th className="px-6 py-4 font-bold tracking-wider">연락처 / Email (CRM)</th>
                                        <th className="px-6 py-4 font-bold tracking-wider">수집 이벤트(학회)</th>
                                        <th className="px-6 py-4 font-bold tracking-wider">스캔 일시</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {filteredLeads.map((v: any, i) => (
                                        <tr key={v.id || i} className="hover:bg-indigo-50/50 transition-colors">
                                            <td className="px-6 py-4 border-l-4 border-l-transparent hover:border-l-indigo-500">
                                                <div className="font-bold text-gray-900">
                                                    {v.visitorName || v.userName || v.name || '알 수 없음'}
                                                </div>
                                                {(!v.isConsentAgreed && v.isConsentAgreed !== undefined) && (
                                                    <div className="mt-1">
                                                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">동의 거부 (익명)</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-700">
                                                {v.visitorOrg || v.userOrg || v.affiliation || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5 text-xs">
                                                    {v.visitorPhone && (
                                                        <div className="flex items-center gap-1.5 text-gray-700">
                                                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                            {v.visitorPhone}
                                                        </div>
                                                    )}
                                                    {v.visitorEmail && (
                                                        <div className="flex items-center gap-1.5 text-gray-700">
                                                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                            {v.visitorEmail}
                                                        </div>
                                                    )}
                                                    {!v.visitorPhone && !v.visitorEmail && (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 truncate max-w-[200px]" title={confMap.get(v.conferenceId) || v.conferenceId}>
                                                    {confMap.get(v.conferenceId) || v.conferenceId}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-500 font-mono tracking-tight">
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
