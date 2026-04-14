import React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Props = {
  externalAttendeeCount: number;
  individual: React.ReactNode;
  bulk: React.ReactNode;
  list: React.ReactNode;
};

export const ExternalAttendeeTabs: React.FC<Props> = ({
  externalAttendeeCount,
  individual,
  bulk,
  list,
}) => (
  <Tabs defaultValue="individual" className="space-y-6">
    <TabsList className="grid w-full grid-cols-3">
      <TabsTrigger value="individual">개별등록</TabsTrigger>
      <TabsTrigger value="bulk">대량등록</TabsTrigger>
      <TabsTrigger value="list">등록현황 ({externalAttendeeCount})</TabsTrigger>
    </TabsList>

    <TabsContent value="individual">{individual}</TabsContent>
    <TabsContent value="bulk">{bulk}</TabsContent>
    <TabsContent value="list">{list}</TabsContent>
  </Tabs>
);

