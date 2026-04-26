import React from 'react';
import { useReactToPrint } from 'react-to-print';

interface PrintHandlerProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  triggerButton: React.ReactElement;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

const PrintHandler: React.FC<PrintHandlerProps> = ({ 
  contentRef, 
  triggerButton,
  onBeforePrint,
  onAfterPrint
}) => {
  const printOptions = {
    contentRef: contentRef,
    ...(onBeforePrint ? { onBeforeGetContent: onBeforePrint } : {}),
    onAfterPrint: onAfterPrint,
    pageStyle: `
      @page {
        margin: 0;
      }
      body {
        margin: 0;
      }
      .print-force-background {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    `
  } as Parameters<typeof useReactToPrint>[0];

  const handlePrint = useReactToPrint(printOptions);

  // Clone the trigger button to attach the onClick handler
  return React.cloneElement(triggerButton as React.ReactElement<Record<string, unknown>>, {
    onClick: handlePrint
  });
};

export default PrintHandler;
