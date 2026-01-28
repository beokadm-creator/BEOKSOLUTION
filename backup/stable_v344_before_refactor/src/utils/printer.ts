import { BadgeElement } from '../types/schema';

export const printBadge = async (layout: { width: number; height: number; elements: BadgeElement[] }, userData: any) => {
    console.log("---------------------------------------------------");
    console.log(`[PRINTER] Printing Badge for ${userData.name}`);
    console.log(`[PRINTER] Size: ${layout.width}x${layout.height}`);
    
    layout.elements.forEach(el => {
        if (!el.isVisible) return;
        let content = el.content;
        
        // Dynamic content replacement
        if (el.type === 'NAME') content = userData.name;
        if (el.type === 'ORG') content = userData.organization || 'No Org'; // Assuming user has org
        if (el.type === 'QR') content = userData.badgeQr;

        console.log(`[PRINTER] Element [${el.type}] at (${el.x}, ${el.y}): ${content}`);
    });
    console.log("---------------------------------------------------");
    
    // Simulate SDK delay
    return new Promise(resolve => setTimeout(resolve, 2000));
};
