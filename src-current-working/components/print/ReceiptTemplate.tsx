import React from 'react';
import { ReceiptConfig, PaymentData } from '../../types/print';

interface ReceiptTemplateProps {
  data: PaymentData;
  config: ReceiptConfig;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ data, config }) => {
  const { issuerInfo, stampUrl } = config;

  return (
    <div className="receipt-container print-force-background" id="receipt-section">
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>RECEIPT</h1>
        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
          No. {data.receiptNumber} | Date: {data.paymentDate}
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>
          Payer Information
        </h3>
        <p style={{ margin: '5px 0' }}><strong>Name:</strong> {data.payerName}</p>
      </div>

      <table className="receipt-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Item</th>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right', width: '150px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.name}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                {item.amount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
            <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>Total</td>
            <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
              {data.totalAmount.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '16px', borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px' }}>
            Issuer Information
          </h3>
          <p style={{ margin: '3px 0', fontSize: '14px' }}><strong>Name:</strong> {issuerInfo.name}</p>
          <p style={{ margin: '3px 0', fontSize: '14px' }}><strong>Reg. No:</strong> {issuerInfo.registrationNumber}</p>
          <p style={{ margin: '3px 0', fontSize: '14px' }}><strong>Address:</strong> {issuerInfo.address}</p>
          <p style={{ margin: '3px 0', fontSize: '14px' }}><strong>CEO:</strong> {issuerInfo.ceo}</p>
        </div>
        
        {stampUrl && (
          <div style={{ marginLeft: '20px' }}>
            <img 
              src={stampUrl} 
              alt="Official Stamp" 
              style={{ width: '80px', height: '80px', objectFit: 'contain' }} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptTemplate;
