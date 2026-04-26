import { BadgeElement } from '../types/schema';

export const printBadge = async (layout: { width: number; height: number; elements: BadgeElement[] }, userData: { name: string; organization?: string; badgeQr: string; licenseNumber?: string; position?: string; price?: string }) => {
    
    layout.elements.forEach(el => {
        if (!el.isVisible) return;
        
        let _content = el.content;
        
        if (el.type === 'NAME') _content = userData.name;
        if (el.type === 'ORG') _content = userData.organization || 'No Org';
        if (el.type === 'QR') _content = userData.badgeQr;
        if (el.type === 'LICENSE') _content = userData.licenseNumber || '';
        if (el.type === 'POSITION') _content = userData.position || '';
        if (el.type === 'PRICE') _content = userData.price || '';
    });

    // Simulate SDK delay
    return new Promise(resolve => setTimeout(resolve, 2000));
};
