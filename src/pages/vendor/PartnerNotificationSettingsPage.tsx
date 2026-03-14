import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Bell, MessageSquare, Settings } from 'lucide-react';
import PartnerInfraSettings from './PartnerInfraSettings';
import PartnerTemplatesPage from './PartnerTemplatesPage';

export default function PartnerNotificationSettingsPage() {
    const { activeVendorId } = useOutletContext<{ activeVendorId: string }>();
    const [activeTab, setActiveTab] = useState('infrastructure');

    if (!activeVendorId) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <p className="text-slate-500">No partner selected</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                        <Bell className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Notification Settings</h1>
                        <p className="text-slate-500">Configure your AlimTalk notification system</p>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                    <TabsTrigger
                        value="infrastructure"
                        className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg px-6"
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Infrastructure
                    </TabsTrigger>
                    <TabsTrigger
                        value="templates"
                        className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg px-6"
                    >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Templates
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="infrastructure" className="mt-0">
                    <PartnerInfraSettings vendorId={activeVendorId} />
                </TabsContent>

                <TabsContent value="templates" className="mt-0">
                    <PartnerTemplatesPage vendorId={activeVendorId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
