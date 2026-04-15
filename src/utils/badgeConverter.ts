import { ConferenceInfo } from '../types/schema';
import { BadgeConfig, BadgeLayoutItem } from '../types/print';

const PX_PER_MM = 3.779527; // 96 DPI

const detectLayoutUnit = (layout: {
  width?: number;
  height?: number;
  unit?: 'px' | 'mm';
}): 'px' | 'mm' => {
  if (layout.unit === 'px' || layout.unit === 'mm') return layout.unit;

  const width = layout.width || 0;
  const height = layout.height || 0;

  if (width > 0 && width <= 250 && height > 0 && height <= 350) return 'mm';
  return 'px';
};

export const convertBadgeLayoutToConfig = (layout: ConferenceInfo['badgeLayout']): BadgeConfig => {
  const unit = detectLayoutUnit(layout);

  // 캔버스 크기 → px (화면 표시용)
  const widthPx = unit === 'px' ? layout.width : Math.round(layout.width * PX_PER_MM);
  const heightPx = unit === 'px' ? layout.height : Math.round(layout.height * PX_PER_MM);

  const config: BadgeConfig = {
    dimensions: {
      width: `${widthPx}px`,
      height: `${heightPx}px`,
    },
    backgroundUrl: layout.backgroundImageUrl || '',
    layout: {} as Record<string, BadgeLayoutItem>,
    qr: { x: '0px', y: '0px', size: 80 }, // Default
  };

  layout.elements.forEach((el) => {
    if (!el.isVisible) return;

    // 요소 좌표 → px 변환
    const xPx = unit === 'px' ? el.x : Math.round(el.x * PX_PER_MM);
    const yPx = unit === 'px' ? el.y : Math.round(el.y * PX_PER_MM);
    const sizePx = unit === 'px' ? el.fontSize : Math.round(el.fontSize * PX_PER_MM);

    const style: BadgeLayoutItem = {
      x: `${xPx}px`,
      y: `${yPx}px`,
      fontSize: `${sizePx}px`,
      color: '#000',
      align: 'left',
      fontWeight: 'bold',
    };

    if (el.type === 'QR') {
      config.qr = {
        x: `${xPx}px`,
        y: `${yPx}px`,
        size: sizePx,
      };
    } else {
      // 요소 타입 → 레이아웃 키 매핑
      let key = el.type as string;
      if (el.type === 'NAME') key = 'name';
      else if (el.type === 'ORG') key = 'org';
      else if (el.type === 'CATEGORY') key = 'category';
      // LICENSE, PRICE, AFFILIATION, CUSTOM, IMAGE 는 타입명 그대로

      config.layout[key] = style;
    }
  });

  return config;
};
