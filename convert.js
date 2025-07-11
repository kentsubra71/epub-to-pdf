const puppeteer = require('puppeteer');
const path = require('path');

async function convertToPdf() {
  const viewerUrl = process.argv[2];
  const pdfPath = process.argv[3];

  if (!viewerUrl || !pdfPath) {
    console.error('Usage: node convert.js <viewer_url> <output_pdf_path>');
    process.exit(1);
  }

  let browser;
  try {
    console.log('Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
    });

    const page = await browser.newPage();
    
    // Set viewport to ensure proper rendering
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
    });
    
    console.log(`Navigating to viewer: ${viewerUrl}`);
    
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle0', // Wait for network to be idle
      timeout: 60000,
    });
    console.log('Page loaded.');

    // Wait for a signal from the frontend that the book is fully rendered
    await page.waitForFunction(() => window.readyForPdf === true, {
      timeout: 90000, // 90-second timeout for rendering
    });
    console.log('Book is ready for PDF export.');

    // Brief wait for any final layout adjustments
    console.log('Waiting for layout to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
         // Simple working cloning approach (revert to original working version)
     const contentInfo = await page.evaluate(() => {
       // Get the viewer element
       const viewer = document.getElementById('viewer');
       if (!viewer) return { sections: 0, success: false };
       
       // Get all sections
       const sections = viewer.querySelectorAll('.readium-section');
       
       // Create a new container specifically for PDF
       const pdfContainer = document.createElement('div');
       pdfContainer.id = 'pdf-container';
       pdfContainer.style.cssText = `
         width: 8.5in;
         margin: 0 auto;
         padding: 0;
         background: white;
         position: relative;
         font-family: Arial, sans-serif;
       `;
       
       // Clone and process each section
       sections.forEach((section, index) => {
         const sectionClone = section.cloneNode(true);
         sectionClone.style.cssText = `
           width: 8.5in;
           min-height: 11in;
           padding: 0.75in;
           margin: 0;
           box-sizing: border-box;
           page-break-after: always;
           background: white;
         `;
         
         // Ensure images are properly sized
         const images = sectionClone.querySelectorAll('img');
         images.forEach(img => {
           img.style.maxWidth = '7in';
           img.style.height = 'auto';
           img.style.display = 'block';
           img.style.margin = '0 auto';
         });
         
         pdfContainer.appendChild(sectionClone);
       });
       
       // Remove the last page break
       const lastSection = pdfContainer.lastElementChild;
       if (lastSection) {
         lastSection.style.pageBreakAfter = 'avoid';
       }
       
       // Hide everything else and show only our container
       document.body.innerHTML = '';
       document.body.appendChild(pdfContainer);
       document.body.style.cssText = 'margin: 0; padding: 0; background: white;';
       
       return { sections: sections.length, success: true };
     });
    
    console.log(`[Puppeteer] Prepared ${contentInfo.sections} sections for PDF capture`);
    
    // Force a repaint to ensure all images are rendered
    await page.evaluate(() => {
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });

    console.log(`Generating PDF at: ${pdfPath}`);
    
    // Ensure output directory exists and handle file locking
    const fs = require('fs');
    const outputDir = path.dirname(pdfPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Delete existing file if it exists to avoid conflicts
    let finalPdfPath = pdfPath;
    if (fs.existsSync(finalPdfPath)) {
      try {
        fs.unlinkSync(finalPdfPath);
        console.log(`[Puppeteer] Removed existing PDF file: ${finalPdfPath}`);
      } catch (unlinkError) {
        console.warn(`[Puppeteer] Could not remove existing file: ${unlinkError.message}`);
        // Try with a different filename if removal fails
        const timestamp = Date.now();
        const ext = path.extname(finalPdfPath);
        const baseName = path.basename(finalPdfPath, ext);
        finalPdfPath = path.join(outputDir, `${baseName}_${timestamp}${ext}`);
        console.log(`[Puppeteer] Using alternative filename: ${finalPdfPath}`);
      }
    }
    
    // Set body style for proper PDF capture
    await page.evaluate(() => {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.background = 'white';
    });
    
    // Use print media type to trigger print styles
    await page.emulateMediaType('print');
    
    // Set viewport to accommodate content
    await page.setViewport({
      width: 816, // 8.5 inches at 96 DPI
      height: 1056, // 11 inches at 96 DPI
      deviceScaleFactor: 1,
    });
    
    // Wait for print styles to apply
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate PDF with proper page breaks
    await page.pdf({
      path: finalPdfPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true, // Use CSS page size for proper pagination
      displayHeaderFooter: false,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      timeout: 120000, // 2 minute timeout for PDF generation
    });

    console.log('PDF generated successfully.');

  } catch (error) {
    console.error('An error occurred during PDF conversion:', error);
    process.exit(1); // Exit with error code
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('Conversion process finished.');
  }
}

convertToPdf(); 