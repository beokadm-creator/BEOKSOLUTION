import React from 'react';
import { useParams } from 'react-router-dom';
import ConferenceWideTemplatePreview from '../../templates/ConferenceWideTemplatePreview';

const ConferencePreviewLoader = () => {
  // 1. URL에서 slug 파라미터 추출 (예: 2026spring)
  const { slug } = useParams<{ slug: string }>();

  // 2. 안전장치: slug가 없으면 에러 표시
  if (!slug) {
    return <div className="p-10 text-center text-red-500">잘못된 접근입니다. (Conference ID Missing)</div>;
  }

  // 3. 데이터 로딩은 Template 내부에서 수행하므로, 여기서는 slug만 전달!
  return <ConferenceWideTemplatePreview slug={slug} />;
};

export default ConferencePreviewLoader;
