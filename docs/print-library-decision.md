# Library Decision Report for eRegi Print System
## Technical Stack Analysis & Selection

---

## 1. QR Code Generation

### **Recommended: qrcode.react**
- **Package:** `qrcode.react`
- **Version:** ^3.1.0
- **Size:** ~43KB minified
- **Render Method:** SVG & Canvas

**Selection Reasons:**
1. **SVG Support:** Native SVG rendering for perfect print quality
2. **React Native:** Seamless React component integration
3. **Lightweight:** Minimal bundle impact
4. **Battle-tested:** Used by major applications
5. **Error Correction:** L, M, Q, H levels supported
6. **Customization:** Color, size, margin customization

**Alternatives Considered:**
- `qr-code-styling`: More features but larger bundle size
- `custom-qrcode-browser`: Lightweight but less mature

**Implementation:**
```typescript
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={verificationUrl}
  size={120}
  level="H"
  includeMargin={true}
  bgColor="#ffffff"
  fgColor="#000000"
/>
```

---

## 2. Print Management

### **Recommended: react-to-print + CSS Media Queries**
- **Primary:** `react-to-print` for DOM capture
- **Enhancement:** Native `window.print()` with `@media print` CSS
- **Fallback:** CSS-only approach

**Selection Reasons:**
1. **DOM Accuracy:** Captures actual rendered DOM state
2. **CSS Control:** Full CSS styling support including `@media print`
3. **Browser Native:** Uses browser's print dialog for reliability
4. **Mobile Compatible:** Works across all devices
5. **Performance:** No canvas rendering overhead

**Print CSS Strategy:**
```css
@media print {
  /* Force background colors/images */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Page layout */
  @page {
    size: 90mm 110mm;
    margin: 0;
  }
  
  body {
    margin: 0;
    padding: 0;
    background: white;
  }
  
  /* Hide unnecessary elements */
  .no-print {
    display: none !important;
  }
  
  /* Badge specific styles */
  .badge-container {
    page-break-after: always;
    width: 90mm;
    height: 110mm;
  }
}
```

**Implementation:**
```typescript
import { useReactToPrint } from 'react-to-print';

const { handlePrint } = useReactToPrint({
  content: () => printRef.current,
  pageStyle: printCSS,
  onBeforeGetContent: () => {
    // Prepare content for printing
  }
});
```

---

## 3. PDF Generation

### **Recommended: html2canvas + jsPDF**
- **HTML Capture:** `html2canvas` for DOM to image conversion
- **PDF Creation:** `jsPDF` for PDF assembly
- **Alternative:** `react-pdf` for complex layouts

**Selection Reasons:**
1. **WYSIWYG:** Exact visual representation
2. **Mobile Support:** Works consistently across devices
3. **Flexible:** Can handle complex layouts with images
4. **Offline:** Client-side generation, no server required
5. **Customizable:** Full control over PDF properties

**Performance Optimization:**
```typescript
const generatePDF = async () => {
  const canvas = await html2canvas(element, {
    scale: 2, // Higher DPI
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    width: element.offsetWidth,
    height: element.offsetHeight
  });
  
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [90, 110] // Badge dimensions
  });
  
  pdf.addImage(imgData, 'PNG', 0, 0, 90, 110);
  pdf.save('badge.pdf');
};
```

---

## 4. Package Installation

```bash
# QR Code Generation
npm install qrcode.react

# Print Management
npm install react-to-print

# PDF Generation
npm install html2canvas jspdf

# TypeScript Support
npm install --save-dev @types/html2canvas
```

---

## 5. Browser Compatibility Matrix

| Feature | Chrome | Safari | Firefox | Edge | Mobile |
|---------|--------|--------|---------|------|--------|
| QR Code (SVG) | ✅ | ✅ | ✅ | ✅ | ✅ |
| react-to-print | ✅ | ✅ | ✅ | ✅ | ✅ |
| CSS Print Media | ✅ | ✅ | ✅ | ✅ | ⚠️* |
| html2canvas | ✅ | ✅ | ✅ | ✅ | ✅ |
| jsPDF | ✅ | ✅ | ✅ | ✅ | ✅ |

*Mobile print varies by device and OS

---

## 6. Performance Considerations

### Bundle Size Impact:
- **qrcode.react:** +43KB
- **react-to-print:** +12KB  
- **html2canvas:** +65KB
- **jsPDF:** +89KB
- **Total:** ~209KB (gzipped: ~65KB)

### Loading Strategy:
```typescript
// Lazy load heavy dependencies
const loadPrintDependencies = async () => {
  const [html2canvas, jsPDF] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);
  return { html2canvas: html2canvas.default, jsPDF: jsPDF.default };
};
```

---

## 7. Security & Reliability

### Content Security Policy (CSP):
- `html2canvas` requires `canvas` and `image` sources
- QR code generation uses inline SVG (safe)
- Print CSS uses standard media queries

### Error Handling:
```typescript
const safePrint = async () => {
  try {
    await handlePrint();
  } catch (error) {
    // Fallback to window.print()
    window.print();
  }
};
```

---

## 8. Implementation Priority

1. **Phase 1:** QR code generation with `qrcode.react`
2. **Phase 2:** Print functionality with `react-to-print`
3. **Phase 3:** PDF generation with `html2canvas + jsPDF`
4. **Phase 4:** Performance optimization and mobile testing

---

## 9. Alternative Options (Backup)

### PDF Generation Alternative: react-pdf
- **Pros:** Better for complex layouts, React-based
- **Cons:** Steeper learning curve, less WYSIWYG

### Print Alternative: Pure CSS
- **Pros:** No dependencies, fastest
- **Cons:** Limited browser print dialog control

---

## 10. Recommended Integration Pattern

```typescript
// Print service abstraction
class PrintService {
  private qrCode: QRCodeGenerator;
  private printer: PrintManager;
  private pdfGenerator: PDFGenerator;
  
  async printBadge(data: BadgeData): Promise<void> {
    // Generate QR code
    const qrElement = this.qrCode.generate(data.verificationUrl);
    
    // Print directly
    await this.printer.print(data, qrElement);
    
    // Generate PDF backup
    await this.pdfGenerator.generate(data, qrElement);
  }
}
```

---

**Final Recommendation:** Proceed with qrcode.react + react-to-print + html2canvas/jsPDF stack for optimal balance of features, compatibility, and performance.