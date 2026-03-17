import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useVendor, VendorProfile } from '../../hooks/useVendor';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Settings, Building2, Link as LinkIcon, Image as ImageIcon, Save, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorSettingsPage() {
    const { vendorId: paramVendorId } = useParams<{ vendorId: string }>();
    const { activeVendorId } = useOutletContext<{ activeVendorId?: string | null }>();
    const resolvedVendorId = activeVendorId || paramVendorId;
    const vendorLogic = useVendor(resolvedVendorId);

    const { vendor, loading, updateVendorProfile, error } = vendorLogic;

    const [formData, setFormData] = useState<Partial<VendorProfile>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Sync form data when vendor data loads or changes
    useEffect(() => {
        if (vendor) {
            setFormData({
                name: vendor.name || '',
                description: vendor.description || '',
                logoUrl: vendor.logoUrl || '',
                homeUrl: vendor.homeUrl || '',
                productUrl: vendor.productUrl || ''
            });
        }
    }, [vendor]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendor) return;

        setIsSaving(true);
        // Call the update logic
        await updateVendorProfile({
            name: formData.name,
            description: formData.description,
            logoUrl: formData.logoUrl,
            homeUrl: formData.homeUrl,
            productUrl: formData.productUrl
        });
        setIsSaving(false);
    };

    if (loading && !vendor) {
        return <div className="p-8 text-center text-gray-500 flex justify-center"><LoadingSpinner /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Partner Profile</h1>
                    <p className="text-sm text-gray-500">Manage your organization's public information and settings.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <strong className="block font-bold">Error</strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                </div>
            )}

            <Card className="shadow-lg border-t-4 border-t-indigo-600">
                <CardHeader className="bg-gray-50 border-b border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-600" />
                        Profile Settings
                    </CardTitle>
                    <CardDescription>
                        This information will be displayed to attendees and conferences you participate in.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSave}>
                    <CardContent className="p-6 space-y-6">
                        {/* Basic Info Group */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                                <Building2 className="w-4 h-4" /> Organization Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="vendor-name">Organization Name</Label>
                                    <Input
                                        id="vendor-name"
                                        placeholder="Enter organization name"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="bg-white"
                                        required
                                    />
                                    <p className="text-xs text-gray-500">This name will be publicly visible to attendees.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="logo-url">Logo URL</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <Input
                                                id="logo-url"
                                                placeholder="https://example.com/logo.png"
                                                value={formData.logoUrl || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                                                className="bg-white pl-9"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">Provide a direct link to your logo image.</p>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label htmlFor="description">About the Organization</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Brief introduction or description of your products and services..."
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="bg-white min-h-[120px]"
                                />
                            </div>
                        </div>

                        {/* External Links Group */}
                        <div className="space-y-4 pt-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                                <LinkIcon className="w-4 h-4" /> External Links
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="home-url">Website URL</Label>
                                    <Input
                                        id="home-url"
                                        type="url"
                                        placeholder="https://your-website.com"
                                        value={formData.homeUrl || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, homeUrl: e.target.value }))}
                                        className="bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="product-url">Product / Catalog URL</Label>
                                    <Input
                                        id="product-url"
                                        type="url"
                                        placeholder="https://your-website.com/products"
                                        value={formData.productUrl || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, productUrl: e.target.value }))}
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-gray-50 p-6 flex justify-end gap-3 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                // Reset to current vendor state
                                if (vendor) {
                                    setFormData({
                                        name: vendor.name,
                                        description: vendor.description,
                                        logoUrl: vendor.logoUrl,
                                        homeUrl: vendor.homeUrl,
                                        productUrl: vendor.productUrl
                                    });
                                }
                            }}
                            disabled={isSaving}
                        >
                            Cancel Changes
                        </Button>
                        <Button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px]"
                            disabled={isSaving}
                        >
                            {isSaving ? <LoadingSpinner text="Saving..." /> : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
