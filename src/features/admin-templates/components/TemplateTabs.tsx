import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { NotificationEventType, EVENT_TYPE_PRESETS } from '@/types/schema';

interface TemplateTabsProps {
    selectedEventType: NotificationEventType;
    setSelectedEventType: (v: NotificationEventType) => void;
    children: (eventType: NotificationEventType) => React.ReactNode;
}

export function TemplateTabs({ selectedEventType, setSelectedEventType, children }: TemplateTabsProps) {
    const eventPresets = EVENT_TYPE_PRESETS;

    return (
        <Tabs value={selectedEventType} onValueChange={(v) => setSelectedEventType(v as NotificationEventType)} className="space-y-8">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 w-full h-auto p-1.5 bg-slate-100/80 rounded-xl gap-1">
                {(Object.keys(eventPresets) as NotificationEventType[]).map(eventType => (
                    <TabsTrigger
                        key={eventType}
                        value={eventType}
                        className="text-xs md:text-sm py-2.5 rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all"
                    >
                        {eventPresets[eventType].label.ko}
                    </TabsTrigger>
                ))}
            </TabsList>

            {(Object.keys(eventPresets) as NotificationEventType[]).map(eventType => (
                <TabsContent key={eventType} value={eventType} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    {children(eventType)}
                </TabsContent>
            ))}
        </Tabs>
    );
}
