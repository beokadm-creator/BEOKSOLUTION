import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useConference } from '@/hooks/useConference';

import { ExternalAttendeeTabs } from './components/ExternalAttendeeTabs';
import { IndividualRegisterForm } from './components/IndividualRegisterForm';
import { BulkRegisterPanel } from './components/BulkRegisterPanel';
import { ExternalAttendeeListTab } from './components/ExternalAttendeeListTab';
import { VoucherModal } from './components/VoucherModal';
import { useExternalAttendeesList } from './hooks/useExternalAttendeesList';
import { useExternalAttendeeRegistration } from './hooks/useExternalAttendeeRegistration';
import { useExternalAttendeeActions } from './hooks/useExternalAttendeeActions';
import type { ExternalAttendeeDoc } from './types';

const AdminExternalAttendeePage: React.FC = () => {
  const navigate = useNavigate();
  const { cid } = useParams<{ cid: string }>();
  const { id: confId, info, slug, societyId } = useConference(cid);
  const { auth } = useAuth();

  const confBaseUrl = useCallback(() => {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('.web.app') || hostname.includes('firebaseapp.com')) {
      return window.location.origin;
    }
    if (societyId) {
      const parts = hostname.split('.');
      const tldPartsLength = hostname.match(/\.(co\.kr|or\.kr|ac\.kr|go\.kr|ne\.kr)$/) ? 3 : 2;
      const domain = parts.slice(-tldPartsLength).join('.');
      return `https://${societyId}.${domain}`;
    }
    return window.location.origin;
  }, [societyId]);

  const confSlug = useCallback(() => {
    if (slug) return slug;
    if (confId && confId.includes('_')) return confId.split('_').slice(1).join('_');
    return confId || '';
  }, [slug, confId]);

  const { externalAttendees, setExternalAttendees, loading } = useExternalAttendeesList(confId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const registration = useExternalAttendeeRegistration({
    confId,
    externalAttendees,
    setExternalAttendees,
    operatorId: auth.user?.id,
    operatorEmail: auth.user?.email,
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
  });

  const actions = useExternalAttendeeActions({
    confId,
    slug,
    operatorEmail: auth.user?.email,
    setIsProcessing,
    setProgress,
  });

  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<ExternalAttendeeDoc | null>(null);

  const openVoucher = (attendee: ExternalAttendeeDoc) => {
    setSelectedAttendee(attendee);
    setShowVoucherModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            ← 뒤로가기
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">외부 참석자 관리</h1>
          <p className="text-gray-600 mt-2">{info?.title?.ko || '학술대회'}의 외부 참석자를 수동으로 등록하고 관리합니다.</p>
        </div>

        <ExternalAttendeeTabs
          externalAttendeeCount={externalAttendees.length}
          individual={<IndividualRegisterForm isProcessing={isProcessing} onRegister={registration.registerIndividual} />}
          bulk={<BulkRegisterPanel isProcessing={isProcessing} progress={progress} onRegisterBulk={registration.registerBulk} />}
          list={
            <ExternalAttendeeListTab
              confId={confId}
              externalAttendees={externalAttendees}
              isProcessing={isProcessing}
              actions={actions}
              onOpenVoucher={openVoucher}
            />
          }
        />
      </div>

      <VoucherModal
        open={showVoucherModal}
        onOpenChange={setShowVoucherModal}
        attendee={selectedAttendee}
        confId={confId}
        confBaseUrl={confBaseUrl()}
        confSlug={confSlug()}
        onResend={(attendee) => actions.resendBadgePrepToken(attendee)}
        isProcessing={isProcessing}
        receiptConfig={registration.receiptConfig}
        issuerFallbackName={info?.title?.ko || 'eRegi'}
      />
    </div>
  );
};

export default AdminExternalAttendeePage;

