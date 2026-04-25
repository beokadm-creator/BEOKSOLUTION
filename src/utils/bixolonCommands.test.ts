import {
    mmToDots,
    asciiToHex,
    estimateTextWidthDots,
    buildPrintData,
    PrintLayout,
    PrintUserData
} from './bixolonCommands';
import { BadgeElement } from '../types/schema';

function createBadgeElement(
    type: 'NAME' | 'ORG' | 'QR' | 'CUSTOM' | 'CATEGORY' | 'LICENSE' | 'PRICE' | 'AFFILIATION' | 'POSITION' | 'IMAGE',
    isVisible: boolean,
    x: number,
    y: number,
    fontSize: number
): BadgeElement {
    return { type, isVisible, x, y, fontSize } as unknown as BadgeElement;
}

describe('bixolonCommands', () => {
    describe('mmToDots', () => {
        it('converts mm to dots based on dpmm', () => {
            expect(mmToDots(10, 8)).toBe(80);
            expect(mmToDots(10, 12)).toBe(120);
        });
    });

    describe('asciiToHex', () => {
        it('converts ascii to hex', () => {
            expect(asciiToHex('CUT1\r')).toBe('435554310D');
        });
    });

    describe('estimateTextWidthDots', () => {
        it('estimates width differently for different characters', () => {
            const fontDots = 100;
            // English/Numbers: 0.65
            expect(estimateTextWidthDots('A', fontDots)).toBe(65);
            // Korean: 1.15
            expect(estimateTextWidthDots('가', fontDots)).toBe(115);
        });
    });

    describe('buildPrintData', () => {
        const mockLayout: PrintLayout = {
            width: 100,
            height: 150,
            elements: [],
            printerDpmm: 8,
            enableCutting: true
        };

        const mockUserData: PrintUserData = {
            name: 'John Doe',
            org: 'Acme Corp',
            qrData: 'QR123'
        };

        it('generates base functions with cutting enabled', () => {
            const data = buildPrintData(mockLayout, mockUserData);
            expect(data.functions).toHaveProperty('func01'); // clearBuffer
            expect(data.functions).toHaveProperty('func02'); // CUT
            expect(data.functions.func02.directDrawHex).toEqual([asciiToHex('CUT1\r')]);
        });

        it('handles QR code element', () => {
            const layoutWithQR: PrintLayout = {
                ...mockLayout,
                elements: [
                    createBadgeElement('QR', true, 10, 10, 25)
                ]
            };

            const data = buildPrintData(layoutWithQR, mockUserData);
            const qrFunc = Object.values(data.functions).find((f: any) => f.drawQRCode);
            expect(qrFunc).toBeDefined();
            // QR data should match
            expect(qrFunc.drawQRCode[0]).toBe('QR123');
        });

        it('handles POSITION element', () => {
            const layoutWithPosition: PrintLayout = {
                ...mockLayout,
                elements: [
                    createBadgeElement('POSITION', true, 10, 20, 10)
                ]
            };
            const userDataWithPosition: PrintUserData = {
                ...mockUserData,
                position: 'Manager'
            };

            const data = buildPrintData(layoutWithPosition, userDataWithPosition);
            const textFunc = Object.values(data.functions).find((f: any) => f.drawTrueTypeFont);
            expect(textFunc).toBeDefined();
            // Text should match position
            expect(textFunc.drawTrueTypeFont[0]).toBe('Manager');
        });

        it('handles hidden elements', () => {
            const layoutWithHidden: PrintLayout = {
                ...mockLayout,
                elements: [
                    createBadgeElement('NAME', false, 10, 10, 10)
                ]
            };

            const data = buildPrintData(layoutWithHidden, mockUserData);
            const textFunc = Object.values(data.functions).find((f: any) => f.drawTrueTypeFont);
            expect(textFunc).toBeUndefined(); // Should not generate print command
        });
    });
});
