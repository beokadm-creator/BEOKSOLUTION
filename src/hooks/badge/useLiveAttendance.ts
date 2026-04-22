import { useState, useEffect } from 'react';
import { getKstToday } from '../../utils/dateUtils';

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
};

type ZoneBreak = {
  start: string;
  end: string;
};

export type AttendanceZone = {
  id: string;
  start?: string;
  end?: string;
  breaks?: ZoneBreak[];
  ruleDate?: string;
};

interface UseLiveAttendanceProps {
  status: string; // 'INSIDE' or 'OUTSIDE'
  zone: string;
  lastCheckIn?: TimestampLike | null;
  baseMinutes: number;
  zones: AttendanceZone[];
}

export function useLiveAttendance({ status, zone, lastCheckIn, baseMinutes, zones }: UseLiveAttendanceProps) {
  const [liveMinutes, setLiveMinutes] = useState<number>(0);
  const [liveSessionMinutes, setLiveSessionMinutes] = useState<number>(0);

  useEffect(() => {
    const updateLiveMinutes = () => {
      if (status !== "INSIDE" || !lastCheckIn) {
        setLiveMinutes(baseMinutes || 0);
        setLiveSessionMinutes(0);
        return;
      }

      const now = new Date();
      let start: Date;
      
      if (lastCheckIn.toDate && typeof lastCheckIn.toDate === 'function') {
        start = lastCheckIn.toDate();
      } else if (lastCheckIn.seconds) {
        start = new Date(lastCheckIn.seconds * 1000);
      } else {
        start = new Date();
      }

      let durationMinutes = 0;
      const todayStr = getKstToday();
      const zoneRule = zones.find(z => z.id === zone && z.ruleDate === todayStr) || zones.find((z) => z.id === zone);
      let deduction = 0;

      let boundedStart = start;
      let boundedEnd = now;

      if (zoneRule && zoneRule.start && zoneRule.end) {
        const localDateStr = zoneRule.ruleDate || getKstToday(start);
        const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00+09:00`);
        const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00+09:00`);

        if (start < sessionStart) boundedStart = sessionStart;
        if (now > sessionEnd) boundedEnd = sessionEnd;

        if (boundedEnd > boundedStart) {
          if (zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
            zoneRule.breaks.forEach((b) => {
              const breakStart = new Date(`${localDateStr}T${b.start}:00+09:00`);
              const breakEnd = new Date(`${localDateStr}T${b.end}:00+09:00`);
              const overlapStart = boundedStart > breakStart ? boundedStart : breakStart;
              const overlapEnd = boundedEnd < breakEnd ? boundedEnd : breakEnd;
              if (overlapEnd > overlapStart) {
                deduction += Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
              }
            });
          }
          durationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);
          durationMinutes = Math.max(0, durationMinutes - deduction);
        } else {
          durationMinutes = 0;
        }
      } else {
        durationMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);
      }

      setLiveSessionMinutes(durationMinutes);
      setLiveMinutes((baseMinutes || 0) + durationMinutes);
    };

    updateLiveMinutes();
    const interval = setInterval(updateLiveMinutes, 30000);
    return () => clearInterval(interval);
  }, [status, zone, lastCheckIn, baseMinutes, zones]);

  return { liveMinutes, liveSessionMinutes };
}