const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const Epub = require('epub');

async function epubToPdf(epubPath, pdfPath) {
  // 1. Extract HTML from EPUB
  const epub = new Epub(epubPath);
  epub.on('end', async function() {
    let html = '<html><head><meta charset="utf-8"></head><body>';
    for (const chapter of epub.flow) {
      html += await new Promise((resolve, reject) => {
        epub.getChapter(chapter.id, (err, text) => {
          if (err) reject(err);
          else resolve(text);
        });
      });
    }
    html += '</body></html>';
    const htmlPath = path.join(__dirname, 'temp.html');
    fs.writeFileSync(htmlPath, html);

    // 2. Render with Puppeteer
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
    await page.pdf({ path: pdfPath, format: 'A4' });
    await browser.close();
    console.log('PDF created:', pdfPath);
  });
  epub.parse();
}

// CLI usage: node index.js input/your.epub output/your.pdf
const [,, inputEpub, outputPdf] = process.argv;
if (!inputEpub || !outputPdf) {
  console.error('Usage: node index.js <input.epub> <output.pdf>');
  process.exit(1);
}

(async () => {
  await epubToPdf(inputEpub, outputPdf);
})(); 