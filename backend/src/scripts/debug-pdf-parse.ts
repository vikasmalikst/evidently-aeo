
const fs = require('fs');

console.log('--- Debugging pdf-parse import ---');

try {
    const pdf = require('pdf-parse');
    console.log('typeof pdf:', typeof pdf);
    console.log('Is pdf a function?', typeof pdf === 'function');
    console.log('Keys of pdf:', Object.keys(pdf));

    if (typeof pdf === 'object') {
        console.log('pdf.default:', pdf.default);
        console.log('typeof pdf.default:', typeof pdf.default);
    }

} catch (error) {
    console.error('Error requiring pdf-parse:', error);
}

console.log('--- End Debug ---');
