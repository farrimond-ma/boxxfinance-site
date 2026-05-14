import fs from 'fs';
import pdfParse from 'pdf-parse/index.js'; // Try direct path or default

const dataBuffer = fs.readFileSync('form.pdf');

pdfParse(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(err => {
    console.error('Error parsing PDF:', err);
    // Fallback if default export is nested
    if (typeof pdfParse !== 'function' && pdfParse.default) {
        pdfParse.default(dataBuffer).then(data => console.log(data.text));
    }
});
