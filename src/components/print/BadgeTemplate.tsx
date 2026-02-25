import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BadgeConfig, RegistrationData } from '../../types/print';

interface BadgeTemplateProps {
  data: RegistrationData;
  config: BadgeConfig;
}

const BadgeTemplate: React.FC<BadgeTemplateProps> = ({ data, config }) => {
  const { dimensions, backgroundUrl, layout, qr } = config;

  return (
    <div
      className="badge-container print-force-background"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Image */}
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt="Badge Background"
          className="badge-bg"
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        />
      )}

      {/* Name Field */}
      {layout.name && (
        <div
          style={{
            position: 'absolute',
            top: layout.name.y,
            fontSize: layout.name.fontSize,
            color: layout.name.color || '#000',
            textAlign: layout.name.align || 'left',
            fontWeight: layout.name.fontWeight || 'bold',
            width: '100%', // Assuming full width for alignment, adjust if width is provided
            zIndex: 1,
            transform: layout.name.align === 'center' ? 'translateX(-50%)' : 'none',
            left: layout.name.align === 'center' ? '50%' : layout.name.x,
          }}
        >
          {data.name}
        </div>
      )}

      {/* Organization Field */}
      {layout.org && (
        <div
          style={{
            position: 'absolute',
            left: layout.org.align === 'center' ? '50%' : layout.org.x,
            top: layout.org.y,
            fontSize: layout.org.fontSize,
            color: layout.org.color || '#000',
            textAlign: layout.org.align || 'left',
            fontWeight: layout.org.fontWeight || 'normal',
            zIndex: 1,
            transform: layout.org.align === 'center' ? 'translateX(-50%)' : 'none',
          }}
        >
          {data.org}
        </div>
      )}

      {/* Category Field */}
      {layout.category && (
        <div
          style={{
            position: 'absolute',
            left: layout.category.align === 'center' ? '50%' : layout.category.x,
            top: layout.category.y,
            fontSize: layout.category.fontSize,
            color: layout.category.color || '#000',
            textAlign: layout.category.align || 'left',
            fontWeight: layout.category.fontWeight || 'bold',
            zIndex: 1,
            transform: layout.category.align === 'center' ? 'translateX(-50%)' : 'none',
          }}
        >
          {data.category}
        </div>
      )}

      {/* License Number Field */}
      {layout.LICENSE && (
        <div
          style={{
            position: 'absolute',
            left: layout.LICENSE.align === 'center' ? '50%' : layout.LICENSE.x,
            top: layout.LICENSE.y,
            fontSize: layout.LICENSE.fontSize,
            color: layout.LICENSE.color || '#000',
            textAlign: layout.LICENSE.align || 'left',
            fontWeight: layout.LICENSE.fontWeight || 'normal',
            zIndex: 1,
            transform: layout.LICENSE.align === 'center' ? 'translateX(-50%)' : 'none',
          }}
        >
          {data.licenseNumber || data.LICENSE}
        </div>
      )}

      {/* Price Field */}
      {layout.PRICE && (
        <div
          style={{
            position: 'absolute',
            left: layout.PRICE.align === 'center' ? '50%' : layout.PRICE.x,
            top: layout.PRICE.y,
            fontSize: layout.PRICE.fontSize,
            color: layout.PRICE.color || '#000',
            textAlign: layout.PRICE.align || 'left',
            fontWeight: layout.PRICE.fontWeight || 'normal',
            zIndex: 1,
            transform: layout.PRICE.align === 'center' ? 'translateX(-50%)' : 'none',
          }}
        >
          {data.price || data.PRICE}
        </div>
      )}

      {/* QR Code */}
      {qr && (
        <div
          style={{
            position: 'absolute',
            left: qr.x,
            top: qr.y,
            zIndex: 1,
          }}
        >
          <QRCodeSVG
            value={data.registrationId}
            size={qr.size}
            level={'M'}
            includeMargin={false}
          />
        </div>
      )}
    </div>
  );
};

export default BadgeTemplate;
