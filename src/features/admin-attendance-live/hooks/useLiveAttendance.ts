import { useState, useEffect } from 'react';
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { Registration, DailyRule, ZoneRule } from '../types';

interface UseLiveAttendanceReturn {
    registrations: Registration[];
    loading: boolean;
    rules: DailyRule | null;
    zones: ZoneRule[];
    availableDates: string[];
    selectedDate: string;
    setSelectedDate: (date: string) => void;
    currentTime: Date;
}

export function useLiveAttendance(cid: string | undefined): UseLiveAttendanceReturn {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [rules, setRules] = useState<DailyRule | null>(null);
    const [zones, setZones] = useState<ZoneRule[]>([]);
    
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // UI update every minute
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!cid) return;
        const fetchDates = async () => {
            const confRef = doc(db, 'conferences', cid);
            const confSnap = await getDoc(confRef);
            if (confSnap.exists()) {
                const data = confSnap.data();
                const start = (data.dates?.start || data.startDate)?.toDate();
                const end = (data.dates?.end || data.endDate)?.toDate();
                if (start && end) {
                    const list = [];
                    const curr = new Date(start);
                    while (curr <= end) {
                        const kstMs = curr.getTime() + 9 * 60 * 60 * 1000;
                        list.push(new Date(kstMs).toISOString().split('T')[0]);
                        curr.setDate(curr.getDate() + 1);
                    }
                    setAvailableDates(list);
                    const todayKstMs = new Date().getTime() + 9 * 60 * 60 * 1000;
                    const today = new Date(todayKstMs).toISOString().slice(0, 10);
                    if (!list.includes(today) && list.length > 0) {
                        setSelectedDate(list[0]);
                    }
                }
            }
        };
        fetchDates();
    }, [cid]);

    useEffect(() => {
        if (!cid) return;

        setTimeout(() => setLoading(true), 0);

        // 1. Listen to rules
        const rulesRef = doc(db, `conferences/${cid}/settings/attendance`);
        const unsubscribeRules = onSnapshot(rulesRef, (snap) => {
            if (snap.exists()) {
                const allRules = snap.data().rules || {};
                const targetRule = allRules[selectedDate];
                setRules(targetRule || null);
                if (targetRule) setZones(targetRule.zones || []);
                else setZones([]);
            } else {
                setRules(null);
                setZones([]);
            }
        });

        // 2. Listen to registrations (PAID only)
        const qReg = query(
            collection(db, 'conferences', cid, 'registrations'),
            where('paymentStatus', '==', 'PAID')
        );

        // 3. Listen to external attendees
        const qExt = query(
            collection(db, 'conferences', cid, 'external_attendees'),
            where('deleted', '==', false)
        );

        let regs: Registration[] = [];
        let exts: Registration[] = [];

        const updateCombined = () => {
            const combinedData = [...regs, ...exts];
            combinedData.sort((a, b) => {
                if (a.attendanceStatus === 'INSIDE' && b.attendanceStatus !== 'INSIDE') return -1;
                if (a.attendanceStatus !== 'INSIDE' && b.attendanceStatus === 'INSIDE') return 1;
                return a.userName.localeCompare(b.userName);
            });
            setRegistrations(combinedData);
            setLoading(false);
        };

        const unsubscribeReg = onSnapshot(qReg, (snap) => {
            regs = snap.docs
                .filter(d => {
                    const data = d.data();
                    return data.badgeIssued === true && !!data.badgeQr;
                })
                .map(d => {
                    const docData = d.data();
                    const flattened = {
                        id: d.id,
                        ...docData,
                        totalMinutes: docData.totalMinutes || 0,
                        dailyMinutes: docData.dailyMinutes || {},
                        zoneMinutes: docData.zoneMinutes || {},
                        zoneCompleted: docData.zoneCompleted || {},
                        attendanceStatus: docData.attendanceStatus || 'OUTSIDE',
                        isExternal: false
                    } as Registration;

                    flattened.userName = docData.userName || docData.name || docData.userInfo?.name || 'Unknown';
                    flattened.userEmail = docData.userEmail || docData.userInfo?.email || '';
                    flattened.affiliation = docData.userOrg || docData.organization || docData.affiliation || docData.userInfo?.affiliation || docData.userInfo?.organization || '';

                    if (docData.userInfo) {
                        flattened.userName = docData.userInfo.name || flattened.userName;
                        flattened.userEmail = docData.userInfo.email || flattened.userEmail;
                        flattened.affiliation = docData.userInfo.affiliation || docData.userInfo.organization || flattened.affiliation;
                    }
                    return flattened;
                });
            updateCombined();
        });

        const unsubscribeExt = onSnapshot(qExt, (snap) => {
            exts = snap.docs
                .filter(d => {
                    const data = d.data();
                    return data.badgeIssued === true && !!data.badgeQr;
                })
                .map(d => {
                    const docData = d.data();
                    return {
                        id: d.id,
                        userName: docData.name || 'Unknown',
                        userEmail: docData.email || '',
                        attendanceStatus: docData.attendanceStatus || 'OUTSIDE',
                        currentZone: docData.currentZone || null,
                        lastCheckIn: docData.lastCheckIn,
                        totalMinutes: docData.totalMinutes || 0,
                        dailyMinutes: docData.dailyMinutes || {},
                        zoneMinutes: docData.zoneMinutes || {},
                        zoneCompleted: docData.zoneCompleted || {},
                        isCompleted: !!docData.isCompleted,
                        slug: docData.slug || '',
                        affiliation: docData.userOrg || docData.organization || docData.affiliation || '',
                        isExternal: true
                    } as Registration;
                });
            updateCombined();
        });

        return () => {
            unsubscribeRules();
            unsubscribeReg();
            unsubscribeExt();
        };
    }, [cid, selectedDate]);

    return {
        registrations,
        loading,
        rules,
        zones,
        availableDates,
        selectedDate,
        setSelectedDate,
        currentTime
    };
}
