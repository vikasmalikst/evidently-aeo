const fs = require('fs');

(async () => {
    console.log('--- Debugging pdf-parse import ---');

    try {
        const pdf = require('pdf-parse');
        console.log('typeof pdf:', typeof pdf);
        console.log('Is pdf a function?', typeof pdf === 'function');
        console.log('Keys of pdf:', Object.keys(pdf));

        if (pdf.PDFParse) {
            console.log('typeof pdf.PDFParse:', typeof pdf.PDFParse);
            console.log('Is pdf.PDFParse a function?', typeof pdf.PDFParse === 'function');

            try {
                const dummyBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
                const pdfParser = new pdf.PDFParse({ data: dummyBuffer });
                const data = await pdfParser.getText();
                console.log('Successfully called getText()');
                console.log('Extracted text:', data.text);
            } catch (e) {
                console.error('Error calling PDFParse:', e);
            }
        }

    } catch (error) {
        console.error('Error requiring pdf-parse:', error);
    }

    console.log('--- End Debug ---');
})();
