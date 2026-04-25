import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BadgeConfig, RegistrationData } from '../../types/print';
import { BadgeElement } from '../../types/schema';

interface BadgeTemplateProps {
  data: RegistrationData;
  config: BadgeConfig;
  rawElements?: BadgeElement[]; // Phase 3: Added raw elements array for unified rendering
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

const BadgeTemplate: React.FC<BadgeTemplateProps> = ({ data, config, rawElements }) => {
  const { dimensions, backgroundUrl, layout, qr } = config;

  const renderElement = (el: BadgeElement) => {
    if (!el.isVisible) return null;

    // Convert mm to px for preview (assuming 96 DPI -> 3.779527 px/mm)
    // Fallback if the coordinates are already large (legacy px mode)
    const isLegacyPx = el.x > 250;
    const pxPerMm = 3.779527;

    const xPx = isLegacyPx ? el.x : Math.round(el.x * pxPerMm);
    const yPx = isLegacyPx ? el.y : Math.round(el.y * pxPerMm);
    const sizePx = isLegacyPx ? el.fontSize : Math.round(el.fontSize * pxPerMm);

    if (el.type === 'QR') {
      const qrValue = stringValue(data.badgeQr) || stringValue(data.registrationId) || 'NO_DATA';

      return (
        <div
          key={el.type}
          style={{
            position: 'absolute',
            left: `${xPx}px`,
            top: `${yPx}px`,
            zIndex: 1,
          }}
        >
          <QRCodeSVG
            value={qrValue}
            size={sizePx}
            level={'M'}
            includeMargin={false}
          />
        </div>
      );
    }

    let content: string | undefined = '';

    if (el.type === 'CUSTOM') {
      content = el.content;
    } else if (el.type === 'IMAGE') {
      return null;
    } else {
      const elementType: string = el.type;
      if (elementType === 'NAME') {
        content = data.name;
      } else if (elementType === 'ORG') {
        content = data.org;
      } else if (elementType === 'CATEGORY') {
        content = data.category;
      } else if (elementType === 'LICENSE') {
        content = stringValue(data.licenseNumber) || stringValue(data.LICENSE);
      } else if (elementType === 'PRICE') {
        content = stringValue(data.price) || stringValue(data.PRICE);
      } else if (elementType === 'POSITION') {
        content = data.position || stringValue(data.POSITION);
      } else if (elementType === 'AFFILIATION') {
        content = stringValue(data.affiliation) || stringValue(data.AFFILIATION);
      } else {
        const key = elementType.toLowerCase();
        content = stringValue(data[key]) || stringValue(data[elementType]);
      }
    }

    if (!content) return null;

    return (
      <div
        key={`${el.type}-${xPx}-${yPx}`}
        style={{
          position: 'absolute',
          left: el.textAlign === 'center' ? '50%' : `${xPx}px`,
          top: `${yPx}px`,
          fontSize: `${sizePx}px`,
          color: '#000',
          textAlign: el.textAlign || 'left',
          fontWeight: 'bold',
          width: el.textAlign === 'center' ? '100%' : undefined,
          zIndex: 1,
          transform: el.textAlign === 'center' ? 'translateX(-50%)' : 'none',
        }}
      >
        {content}
      </div>
    );
  };

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

      {/* Render Elements Unified (if provided) */}
      {rawElements && rawElements.length > 0 ? (
        rawElements.map(renderElement)
       ) : (
        /* Fallback to legacy layout mapping if rawElements not provided */
        <>
          {Object.entries(layout).map(([key, style]) => {
            if (!style) return null;

            let content = '';
            if (key === 'name') content = data.name;
            else if (key === 'org') content = data.org;
            else if (key === 'category') content = data.category;
            else if (key === 'LICENSE') content = stringValue(data.licenseNumber) || stringValue(data.LICENSE);
            else if (key === 'POSITION') content = data.position || stringValue(data.POSITION);
            else if (key === 'PRICE') content = stringValue(data.price) || stringValue(data.PRICE);
            else content = stringValue(data[key]) || stringValue(data[key.toUpperCase()]);

            if (!content) return null;

            return (
              <div
                key={key}
                style={{
                  position: 'absolute',
                  left: style.align === 'center' ? '50%' : style.x,
                  top: style.y,
                  fontSize: style.fontSize,
                  color: style.color || '#000',
                  textAlign: style.align || 'left',
                  fontWeight: style.fontWeight || 'normal',
                  width: style.align === 'center' ? '100%' : undefined,
                  zIndex: 1,
                  transform: style.align === 'center' ? 'translateX(-50%)' : 'none',
                }}
              >
                {content}
              </div>
            );
          })}

          {/* QR Code Fallback */}
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
        </>
      )}
    </div>
  );
};

export default BadgeTemplate;
