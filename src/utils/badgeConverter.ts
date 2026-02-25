import { ConferenceInfo } from '../types/schema';
import { BadgeConfig, BadgeLayoutItem } from '../types/print';

export const convertBadgeLayoutToConfig = (layout: ConferenceInfo['badgeLayout']): BadgeConfig => {
  const config: BadgeConfig = {
    dimensions: {
      width: `${layout.width}px`,
      height: `${layout.height}px`,
    },
    backgroundUrl: layout.backgroundImageUrl || '',
    layout: {} as Record<string, unknown>, // Initialize with type assertion to allow dynamic keys
    qr: { x: '0px', y: '0px', size: 100 }, // Default
  };

  layout.elements.forEach((el) => {
    if (!el.isVisible) return;

    const style: BadgeLayoutItem = {
      x: `${el.x}px`,
      y: `${el.y}px`,
      fontSize: `${el.fontSize}px`,
      color: '#000', // Default
      align: 'left',
      fontWeight: 'bold', // Default
    };

    if (el.type === 'QR') {
      config.qr = {
        x: `${el.x}px`,
        y: `${el.y}px`,
        size: el.fontSize,
      };
    } else {
      // Map element types to layout keys used in BadgeTemplate
      let key = el.type as string;
      
      if (el.type === 'NAME') key = 'name';
      else if (el.type === 'ORG') key = 'org';
      else if (el.type === 'CATEGORY') key = 'category';
      // LICENSE, PRICE, AFFILIATION use their type name directly as key
      
      config.layout[key] = style;
    }
  });

  return config;
};
