import React from 'react';
import { useSociety } from '../../../hooks/useSociety';
import { Skeleton } from '../../ui/skeleton';

interface WideFooterProps {
  data?: {
    organization?: string;
    address?: string;
    president?: string;
    businessNumber?: string;
    email?: string;
    phone?: string;
  };
}

export const WideFooter: React.FC<WideFooterProps> = ({ data: propData }) => {
  const { society, loading } = useSociety();

  const data = propData || (society ? {
    organization: society.name?.ko || society.name?.en || society.id,
    address: society.footerInfo?.address,
    president: society.footerInfo?.representativeName,
    businessNumber: society.footerInfo?.bizRegNumber,
    email: society.footerInfo?.contactEmail || society.adminEmails?.[0],
    phone: society.footerInfo?.contactPhone
  } : null);

  if (loading && !data) {
      return (
        <footer className="bg-slate-900 text-slate-400 py-12 px-4">
            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <Skeleton className="h-6 w-48 bg-slate-800" />
                    <Skeleton className="h-4 w-64 bg-slate-800" />
                </div>
            </div>
        </footer>
      );
  }

  if (!data && !society) return null;

  // Task 1: Force mapping using society data if available, falling back to propData
  const info = society?.footerInfo;

  return (
    <footer className="bg-slate-900 text-slate-400 py-12 px-4">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-white text-lg font-bold mb-4">
             {society?.name?.ko || society?.name?.en || data?.organization}
          </h3>
          <p className="text-sm">
             {info?.address || data?.address}
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            {(info?.representativeName || data?.president) && (
                <span>대표자: {info?.representativeName || data?.president}</span>
            )}
            {(info?.bizRegNumber || data?.businessNumber) && (
                <span>사업자번호: {info?.bizRegNumber || data?.businessNumber}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p>Email: {info?.contactEmail || data?.email}</p>
          <p>Tel: {info?.contactPhone || data?.phone}</p>
        </div>
      </div>
    </footer>
  );
};
