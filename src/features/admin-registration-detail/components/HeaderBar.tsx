import React from "react";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  onBack: () => void;
  onPrint: () => void;
};

export const HeaderBar: React.FC<Props> = ({ onBack, onPrint }) => (
  <div className="flex items-center mb-6">
    <Button variant="ghost" onClick={onBack} className="mr-4">
      <ArrowLeft className="w-4 h-4 mr-2" /> Back
    </Button>
    <h1 className="text-2xl font-bold">등록 상세 (Registration Detail)</h1>
    <Button variant="outline" className="ml-auto" onClick={onPrint}>
      <Printer className="w-4 h-4 mr-2" /> Print
    </Button>
  </div>
);

