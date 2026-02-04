import React from 'react';
import { MapPin, Mail, Phone, Building2, FileText } from 'lucide-react';
import type { LocalizedText } from '@/types/schema';

interface FooterInfo {
  address?: LocalizedText;
  bizRegNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  representativeName?: LocalizedText;
  map?: string;
  operatingHours?: LocalizedText;
  emailNotice?: LocalizedText;
  privacyPolicy?: LocalizedText;
  termsOfService?: LocalizedText;
}

interface SocietyData {
  name?: LocalizedText | string;
  logoUrl?: string;
  footerInfo?: FooterInfo;
}

interface WideFooterPreviewProps {
  society?: SocietyData;
  language?: 'ko' | 'en';
}

const getText = (text: LocalizedText | string | undefined, lang: 'ko' | 'en'): string => {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.ko || '';
};

export const WideFooterPreview: React.FC<WideFooterPreviewProps> = ({ society, language = 'ko' }) => {
  const footerInfo = society?.footerInfo;

  // 학회 이름 처리
  const societyNameKo = getText(society?.name as LocalizedText | undefined, 'ko');
  const societyNameEn = getText(society?.name as LocalizedText | undefined, 'en');

  return (
    <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-300 mt-8 border-t border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">

          {/* Left: Brand & Description (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-4">
              {society?.logoUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={society.logoUrl}
                    alt={societyNameKo}
                    className="h-14 w-auto object-contain brightness-0 invert drop-shadow-lg"
                  />
                </div>
              )}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  {societyNameKo}
                </h3>
                {societyNameEn && (
                  <p className="text-sm sm:text-base text-slate-400 mt-1">
                    {societyNameEn}
                  </p>
                )}
              </div>
            </div>

            {/* Map Embed (if available) */}
            {footerInfo?.map && (
              <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-700/50">
                <div
                  className="w-full h-48 bg-slate-800"
                  dangerouslySetInnerHTML={{ __html: footerInfo.map }}
                />
              </div>
            )}
          </div>

          {/* Center: Business & Contact (4 cols) */}
          <div className="lg:col-span-4 space-y-8">
            {/* Business Info */}
            {(footerInfo?.representativeName || footerInfo?.bizRegNumber) && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-5">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <h4 className="text-base font-bold text-white">
                    {language === 'ko' ? '사업자 정보' : 'Business Information'}
                  </h4>
                </div>
                <div className="space-y-4">
                  {footerInfo?.representativeName && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium mb-1">
                          {language === 'ko' ? '대표자' : 'Representative'}
                        </p>
                        <p className="text-sm text-slate-200 font-medium">
                          {getText(footerInfo.representativeName, language)}
                        </p>
                      </div>
                    </div>
                  )}
                  {footerInfo?.bizRegNumber && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium mb-1">
                          {language === 'ko' ? '사업자등록번호' : 'Business Reg. No.'}
                        </p>
                        <p className="text-sm text-slate-200 font-mono tracking-wide">
                          {footerInfo.bizRegNumber}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact Info */}
            {(footerInfo?.contactEmail || footerInfo?.contactPhone) && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-5">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <h4 className="text-base font-bold text-white">
                    {language === 'ko' ? '연락처' : 'Contact'}
                  </h4>
                </div>
                <div className="space-y-4">
                  {footerInfo?.contactEmail && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium mb-1">
                          {language === 'ko' ? '이메일' : 'Email'}
                        </p>
                        <a
                          href={`mailto:${footerInfo.contactEmail}`}
                          className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          {footerInfo.contactEmail}
                        </a>
                      </div>
                    </div>
                  )}
                  {footerInfo?.contactPhone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium mb-1">
                          {language === 'ko' ? '전화' : 'Phone'}
                        </p>
                        <a
                          href={`tel:${footerInfo.contactPhone}`}
                          className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          {footerInfo.contactPhone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Address & Quick Info (4 cols) */}
          <div className="lg:col-span-4 space-y-8">
            {/* Address */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-5">
                <MapPin className="w-5 h-5 text-blue-400" />
                <h4 className="text-base font-bold text-white">
                  {language === 'ko' ? '주소' : 'Address'}
                </h4>
              </div>
              {footerInfo?.address ? (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0" />
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {getText(footerInfo.address, language)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  {language === 'ko' ? '주소 정보가 없습니다.' : 'No address information.'}
                </p>
              )}
            </div>

            {/* Operating Hours */}
            {footerInfo?.operatingHours && (
              <div className="bg-gradient-to-br from-blue-600/20 to-slate-700/20 rounded-2xl p-6 border border-blue-500/30">
                <h4 className="text-sm font-bold text-white mb-3">
                  {language === 'ko' ? '⏰ 운영 시간' : '⏰ Operating Hours'}
                </h4>
                <p
                  className="text-xs text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: getText(footerInfo.operatingHours, language) }}
                />
              </div>
            )}

            {/* Email Notice */}
            {footerInfo?.emailNotice && (
              <div className="pt-4 border-t border-slate-600/50">
                <p className="text-xs text-slate-400">
                  {getText(footerInfo.emailNotice, language)}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500 text-center md:text-left">
              &copy; {new Date().getFullYear()} {societyNameEn || societyNameKo}. {language === 'ko' ? 'All rights reserved.' : 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              {footerInfo?.privacyPolicy && (
                <a href={`/${language === 'ko' ? 'privacy' : 'en/privacy'}`} className="hover:text-slate-300 transition-colors">
                  {getText(footerInfo.privacyPolicy, language)}
                </a>
              )}
              {footerInfo?.termsOfService && (
                <a href={`/${language === 'ko' ? 'terms' : 'en/terms'}`} className="hover:text-slate-300 transition-colors">
                  {getText(footerInfo.termsOfService, language)}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
