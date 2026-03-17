import React from 'react';
import { useParams } from 'react-router-dom';
import ConferenceWideTemplate from '../../templates/ConferenceWideTemplate';

const ConferenceLoader = () => {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return <div className="p-10 text-center text-red-500">잘못된 접근입니다. (Conference slug missing)</div>;
  }

  // Keep raw slug; tenant/domain resolution is handled in data hooks.
  return <ConferenceWideTemplate slug={slug} />;
};

export default ConferenceLoader;
