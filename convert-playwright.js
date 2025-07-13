const { chromium } = require('playwright');
const path = require('path');

// === DEBUGGING FUNCTION ===
async function inspectThoriumStructure(page) {
  const structure = await page.evaluate(() => {
    const result = {
      iframes: [],
      viewports: [],
      images: {
        inMainDocument: 0,
        inIframes: 0,
        visible: 0,
        hidden: 0
      }
    };
    
    // Check for iframes
    document.querySelectorAll('iframe').forEach(iframe => {
      result.iframes.push({
        id: iframe.id,
        name: iframe.name,
        src: iframe.src,
        className: iframe.className
      });
    });
    
    // Check for viewport-like containers
    const viewportKeywords = ['viewer', 'viewport', 'reader', 'epub', 'thorium'];
    document.querySelectorAll('div').forEach(div => {
      const hasViewportId = viewportKeywords.some(kw => div.id.toLowerCase().includes(kw));
      const hasViewportClass = viewportKeywords.some(kw => div.className.toLowerCase().includes(kw));
      
      if (hasViewportId || hasViewportClass) {
        result.viewports.push({
          id: div.id,
          className: div.className,
          dimensions: `${div.offsetWidth}x${div.offsetHeight}`
        });
      }
    });
    
    // Count images
    result.images.inMainDocument = document.querySelectorAll('img').length;
    document.querySelectorAll('img').forEach(img => {
      if (img.offsetWidth > 0 && img.offsetHeight > 0) {
        result.images.visible++;
      } else {
        result.images.hidden++;
      }
    });
    
    return result;
  });
  
  console.log('Thorium Structure:', JSON.stringify(structure, null, 2));
  return structure;
}

// === OPUS COMPREHENSIVE DEBUGGING AND FIX FUNCTIONS ===

// DEBUG: Find what's special about missing images
async function analyzeImagePatterns(page) {
  const analysis = await page.evaluate(() => {
    const viewer = document.querySelector('#viewer');
    const allImages = Array.from(viewer.querySelectorAll('img'));
    
    // Group images by various characteristics
    const imageGroups = {
      bySource: {},
      byClass: {},
      byParentClass: {},
      byDimensions: {},
      byFormat: {},
      byAttributes: []
    };
    
    allImages.forEach((img, index) => {
      const rect = img.getBoundingClientRect();
      const parent = img.parentElement;
      
      // Categorize by source pattern
      const sourceType = img.src.includes('data:') ? 'base64' : 
                        img.src.includes('blob:') ? 'blob' :
                        img.src.includes('.svg') ? 'svg' :
                        img.src.includes('.png') ? 'png' :
                        img.src.includes('.jpg') || img.src.includes('.jpeg') ? 'jpg' : 'other';
      
      imageGroups.byFormat[sourceType] = (imageGroups.byFormat[sourceType] || 0) + 1;
      
      // Check for special attributes
      const attributes = {
        index,
        src: img.src.substring(0, 100),
        alt: img.alt,
        className: img.className,
        parentClassName: parent.className,
        parentTag: parent.tagName,
        naturalDimensions: `${img.naturalWidth}x${img.naturalHeight}`,
        displayDimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        hasWidth: img.hasAttribute('width'),
        hasHeight: img.hasAttribute('height'),
        hasSrcset: img.hasAttribute('srcset'),
        loading: img.getAttribute('loading'),
        decode: img.getAttribute('decoding'),
        isVisible: rect.width > 0 && rect.height > 0,
        isInViewport: rect.top < window.innerHeight && rect.bottom > 0,
        style: {
          position: getComputedStyle(img).position,
          float: getComputedStyle(img).float,
          objectFit: getComputedStyle(img).objectFit
        }
      };
      
      imageGroups.byAttributes.push(attributes);
    });
    
    // Find patterns in missing images
    const missingPattern = imageGroups.byAttributes.filter(img => !img.isVisible);
    const visiblePattern = imageGroups.byAttributes.filter(img => img.isVisible);
    
    return {
      totalImages: allImages.length,
      visibleCount: visiblePattern.length,
      missingCount: missingPattern.length,
      formats: imageGroups.byFormat,
      missingImages: missingPattern.slice(0, 10), // First 10 missing
      visibleImages: visiblePattern.slice(0, 10), // First 10 visible
      // Look for common patterns
      missingCharacteristics: {
        avgNaturalWidth: missingPattern.reduce((sum, img) => sum + parseInt(img.naturalDimensions.split('x')[0]), 0) / missingPattern.length,
        commonClasses: [...new Set(missingPattern.map(img => img.className).filter(Boolean))],
        commonParentClasses: [...new Set(missingPattern.map(img => img.parentClassName).filter(Boolean))],
        commonParentTags: [...new Set(missingPattern.map(img => img.parentTag))]
      }
    };
  });
  
  console.log('Image Pattern Analysis:', JSON.stringify(analysis, null, 2));
  return analysis;
}

// TARGETED FIX: Handle specific image types that might be missing
async function fixSpecificImageTypes(page) {
  await page.evaluate(() => {
    const viewer = document.querySelector('#viewer');
    
    // 1. Fix floating images (common in textbooks)
    viewer.querySelectorAll('img[style*="float"]').forEach(img => {
      img.style.float = 'none';
      img.style.display = 'block';
      img.style.margin = '10px auto';
    });
    
    // 2. Fix images in specific containers (like character illustrations)
    viewer.querySelectorAll('.character-image, .illustration, figure img').forEach(img => {
      img.style.position = 'relative';
      img.style.display = 'block';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    });
    
    // 3. Fix images with object-fit issues
    viewer.querySelectorAll('img[style*="object-fit"]').forEach(img => {
      img.style.objectFit = 'contain';
    });
    
    // 4. Handle images that might be lazy-loaded
    viewer.querySelectorAll('img[loading="lazy"]').forEach(img => {
      img.removeAttribute('loading');
      // Force load
      const src = img.src;
      img.src = '';
      img.src = src;
    });
    
    // 5. Fix images in absolutely positioned containers
    viewer.querySelectorAll('img').forEach(img => {
      let parent = img.parentElement;
      while (parent && parent !== viewer) {
        const position = getComputedStyle(parent).position;
        if (position === 'absolute' || position === 'fixed') {
          parent.style.position = 'relative';
        }
        parent = parent.parentElement;
      }
    });
  });
}

// NUCLEAR OPTION: Force render all images as base64
async function forceAllImagesToBase64(page) {
  console.log('Converting all images to base64...');
  
  const results = await page.evaluate(async () => {
    const viewer = document.querySelector('#viewer');
    const images = viewer.querySelectorAll('img');
    let converted = 0;
    let failed = 0;
    
    for (const img of images) {
      try {
        // Skip if already base64
        if (img.src.startsWith('data:')) {
          continue;
        }
        
        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Wait for image to be loaded
        if (!img.complete) {
          await new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }
        
        canvas.width = img.naturalWidth || img.width || 100;
        canvas.height = img.naturalHeight || img.height || 100;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        
        img.src = dataUrl;
        converted++;
      } catch (e) {
        console.error('Failed to convert image:', img.src, e);
        failed++;
      }
    }
    
    return { total: images.length, converted, failed };
  });
  
  console.log('Base64 conversion results:', results);
}

// Wait for all stylesheets and fonts to load
async function waitForStylesAndFonts(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    // Wait for all stylesheets to finish loading
    const sheets = Array.from(document.styleSheets);
    await Promise.all(sheets.map(sheet => {
      if (sheet.href) {
        return fetch(sheet.href).catch(() => {});
      }
    }));
  });
}

// Diagnostic function for styles and fonts
async function diagnoseStylesAndFonts(page) {
  console.log('[Playwright] Running style diagnostics...');
  const diagnostics = await page.evaluate(() => {
    const results = {
      stylesheets: [],
      fonts: [],
      cssVariables: {},
      sampleElements: [],
      fontFaces: []
    };
    Array.from(document.styleSheets).forEach((sheet, index) => {
      try {
        results.stylesheets.push({
          index,
          href: sheet.href || 'inline',
          rules: sheet.cssRules ? sheet.cssRules.length : 0,
          media: sheet.media ? sheet.media.mediaText : 'all'
        });
        if (sheet.cssRules) {
          Array.from(sheet.cssRules).forEach(rule => {
            if (rule instanceof CSSFontFaceRule) {
              results.fontFaces.push({
                family: rule.style.fontFamily,
                src: rule.style.src,
                weight: rule.style.fontWeight,
                style: rule.style.fontStyle
              });
            }
          });
        }
      } catch (e) {
        results.stylesheets.push({
          index,
          href: sheet.href || 'inline',
          error: 'Cannot access (cross-origin)'
        });
      }
    });
    if (document.fonts) {
      document.fonts.forEach(font => {
        results.fonts.push({
          family: font.family,
          weight: font.weight,
          style: font.style,
          status: font.status,
          unicodeRange: font.unicodeRange
        });
      });
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const importantVars = [
      '--body-margin-top',
      '--body-margin-right',
      '--body-margin-bottom',
      '--body-margin-left',
      '--body-font-family',
      '--heading-font-family'
    ];
    importantVars.forEach(varName => {
      results.cssVariables[varName] = rootStyle.getPropertyValue(varName) || 'not set';
    });
    const viewer = document.querySelector('#viewer');
    if (viewer) {
      const firstP = viewer.querySelector('p');
      if (firstP) {
        const pStyle = getComputedStyle(firstP);
        results.sampleElements.push({
          selector: 'first <p>',
          fontFamily: pStyle.fontFamily,
          fontSize: pStyle.fontSize,
          color: pStyle.color,
          backgroundColor: pStyle.backgroundColor,
          margin: pStyle.margin
        });
      }
      const firstHeading = viewer.querySelector('h1, h2, h3');
      if (firstHeading) {
        const hStyle = getComputedStyle(firstHeading);
        results.sampleElements.push({
          selector: `first <${firstHeading.tagName.toLowerCase()}>`,
          fontFamily: hStyle.fontFamily,
          fontSize: hStyle.fontSize,
          fontWeight: hStyle.fontWeight,
          color: hStyle.color
        });
      }
      const bgSection = viewer.querySelector('[style*="background"], .has-background');
      if (bgSection) {
        const bgStyle = getComputedStyle(bgSection);
        results.sampleElements.push({
          selector: 'section with background',
          backgroundColor: bgStyle.backgroundColor,
          className: bgSection.className
        });
      }
    }
    return results;
  });
  console.log('[Playwright] Style Diagnostics:');
  console.log('Stylesheets:', JSON.stringify(diagnostics.stylesheets, null, 2));
  console.log('Fonts:', JSON.stringify(diagnostics.fonts, null, 2));
  console.log('Font-face rules found:', JSON.stringify(diagnostics.fontFaces, null, 2));
  console.log('CSS Variables:', JSON.stringify(diagnostics.cssVariables, null, 2));
  console.log('Sample Elements:', JSON.stringify(diagnostics.sampleElements, null, 2));
  return diagnostics;
}

// MAIN SOLUTION: Comprehensive fix
async function comprehensivePDFFix(page, outputPath) {
  // 1. First analyze what's wrong
  const analysis = await analyzeImagePatterns(page);
  console.log(`Found ${analysis.missingCount} missing images out of ${analysis.totalImages}`);
  
  // 1a. Check if EPUB content is actually loaded
  const epubLoaded = await page.evaluate(() => {
    const viewer = document.querySelector('#viewer');
    return viewer && viewer.innerHTML.trim().length > 0;
  });
  
  if (!epubLoaded) {
    console.log('[Playwright] EPUB content not loaded, waiting longer...');
    await page.waitForTimeout(5000);
  }
  
  // 2. Apply targeted fixes
  await fixSpecificImageTypes(page);
  
  // 3. Force all content visible
  await page.evaluate(() => {
    const viewer = document.querySelector('#viewer');
    viewer.style.overflow = 'visible';
    viewer.style.height = 'auto';
    
    // Ensure all sections are visible
    viewer.querySelectorAll('*').forEach(el => {
      if (getComputedStyle(el).display === 'none') {
        el.style.display = 'block';
      }
    });
  });
  
  // 4. Convert problematic images to base64
  await forceAllImagesToBase64(page);
  
  // 5. Wait for everything to stabilize
  await page.waitForTimeout(2000);

  // 6. Replace body with #viewer content only for PDF export
  await page.evaluate(() => {
    const viewer = document.querySelector('#viewer');
    if (!viewer) return;
    
    // DIAGNOSTIC: Analyze font sizes before PDF generation
    console.log('=== FONT SIZE ANALYSIS BEFORE PDF GENERATION ===');
    
    // Check root font size
    const rootFontSize = window.getComputedStyle(document.documentElement).fontSize;
    console.log('Root font-size:', rootFontSize);
    
    // Check CSS variables
    const rootStyle = window.getComputedStyle(document.documentElement);
    console.log('CSS Variables:');
    console.log('  --fs-h1:', rootStyle.getPropertyValue('--fs-h1'));
    console.log('  --fs-h2:', rootStyle.getPropertyValue('--fs-h2'));
    console.log('  --fs-h3:', rootStyle.getPropertyValue('--fs-h3'));
    console.log('  --fs-p:', rootStyle.getPropertyValue('--fs-p'));
    
    // Check specific heading elements
    const headings = viewer.querySelectorAll('h1, h2, h3, div[style*="font-size"]');
    console.log('Heading elements found:', headings.length);
    headings.forEach((heading, index) => {
      const computed = window.getComputedStyle(heading);
      console.log(`Heading ${index + 1} (${heading.tagName}):`, {
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        textContent: heading.textContent.substring(0, 50) + '...'
      });
    });
    
    // Remove navigation artifacts before cloning
    const artifactsToRemove = viewer.querySelectorAll('[class*="navigation"], [class*="page"], [class*="toc"], [id*="navigation"], [id*="page"], [id*="toc"]');
    artifactsToRemove.forEach(el => el.remove());
    
    // Clone the viewer node (now without artifacts)
    const clone = viewer.cloneNode(true);
    
    // Replace body content directly without container wrapping
    document.body.innerHTML = '';
    document.body.appendChild(clone);
    document.body.style.cssText = 'margin: 0; padding: 0; background: white;';
    // Remove scrollbars
    document.documentElement.style.overflow = 'hidden';
    
    // Ensure figcaptions with hide-figcaption class are hidden in PDF
    // Also add comprehensive font-size overrides for PDF generation
    const pdfStyle = document.createElement('style');
    pdfStyle.textContent = `
      figcaption.hide-figcaption { display: none !important; }
      
      /* Comprehensive font-size overrides for PDF generation */
      /* These must match the scaling applied in thorium-viewer.html */
      /* Handle both spaced and non-spaced CSS syntax */
      div[style*="font-size: 40px"], div[style*="font-size:40px"] {
        font-size: 40px !important;
      }
      
      div[style*="font-size: 30px"], div[style*="font-size:30px"] {
        font-size: 30px !important;
      }
      
      div[style*="font-size: 28px"], div[style*="font-size:28px"] {
        font-size: 28px !important;
      }
      
      div[style*="font-size: 26px"], div[style*="font-size:26px"] {
        font-size: 26px !important;
      }
      
      div[style*="font-size: 24px"], div[style*="font-size:24px"] {
        font-size: 24px !important;
      }
      
      div[style*="font-size: 15px"], div[style*="font-size:15px"] {
        font-size: 15px !important;
      }
      
      /* Preserve text alignment from inline styles */
      div[style*="text-align: center"] {
        text-align: center !important;
      }
      
      div[style*="text-align: left"] {
        text-align: left !important;
      }
      
      /* Preserve inline padding styles that create section gaps */
      [style*="padding-bottom: 370px"] {
        padding-bottom: 370px !important;
      }
      
      div[style*="text-align: right"] {
        text-align: right !important;
      }
      
      /* Ensure proper display for headings */
      div[style*="font-size"] {
        display: block !important;
        width: 100% !important;
      }
    `;
    document.head.appendChild(pdfStyle);
    
    // AGGRESSIVE: Force font-size overrides via JavaScript DOM manipulation for PDF
    console.log('[Playwright] Applying aggressive font-size overrides via DOM manipulation for PDF...');
    
    const fontSizeMap = {
      '40px': '40px',  // PRESERVE original 40px
      '30px': '30px',  // PRESERVE original 30px
      '28px': '28px',  // PRESERVE original 28px
      '26px': '26px',  // PRESERVE original 26px
      '24px': '24px',  // PRESERVE original 24px
      '15px': '15px'   // PRESERVE original 15px
    };
    
    // Find all elements with inline font-size styles
    const elementsWithFontSize = document.querySelectorAll('*[style*="font-size"]');
    console.log(`[Playwright] Found ${elementsWithFontSize.length} elements with inline font-size`);
    
    elementsWithFontSize.forEach((element, index) => {
      const currentStyle = element.getAttribute('style') || '';
      console.log(`[Playwright] Element ${index + 1} original style: ${currentStyle}`);
      
      // Check each font size in our map
      Object.keys(fontSizeMap).forEach(originalSize => {
        const newSize = fontSizeMap[originalSize];
        
        // Check for both spaced and non-spaced versions
        if (currentStyle.includes(`font-size: ${originalSize}`) || 
            currentStyle.includes(`font-size:${originalSize}`)) {
          
          console.log(`[Playwright] Overriding ${originalSize} → ${newSize} for element:`, element.textContent.substring(0, 50) + '...');
          
          // Force the new font-size using setProperty with important
          element.style.setProperty('font-size', newSize, 'important');
          
          // Verify the change
          const computedSize = window.getComputedStyle(element).fontSize;
          console.log(`[Playwright] Computed font-size after override: ${computedSize}`);
        }
      });
    });
    
    // DIAGNOSTIC: Analyze font sizes after DOM manipulation
    console.log('=== FONT SIZE ANALYSIS AFTER DOM MANIPULATION ===');
    const newHeadings = document.querySelectorAll('h1, h2, h3, div[style*="font-size"]');
    console.log('Heading elements after DOM change:', newHeadings.length);
    newHeadings.forEach((heading, index) => {
      const computed = window.getComputedStyle(heading);
      console.log(`New Heading ${index + 1} (${heading.tagName}):`, {
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        textContent: heading.textContent.substring(0, 50) + '...'
      });
    });
  });

  // 7. Wait for layout to stabilize after DOM change
  await page.waitForTimeout(1000);

  // 8. Generate PDF
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false
  });

  return pdf;
}

async function convertToPdf() {
  const viewerUrl = process.argv[2];
  const pdfPath = process.argv[3];

  if (!viewerUrl || !pdfPath) {
    console.error('Usage: node convert-playwright.js <viewer_url> <output_pdf_path>');
    process.exit(1);
  }

  let browser;
  try {
    console.log('[Playwright] Starting PDF conversion...');
    console.log(`[Playwright] URL: ${viewerUrl}`);
    console.log(`[Playwright] Output: ${pdfPath}`);

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    });

    const page = await browser.newPage();
    
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    console.log('[Playwright] Page loaded.');

    // Wait for EPUB content to be loaded and ready
    console.log('[Playwright] Waiting for EPUB content to load...');
    await page.waitForFunction(() => {
      const viewer = document.querySelector('#viewer');
      if (!viewer) return false;
      
      const images = viewer.querySelectorAll('img');
      const hasContent = viewer.innerHTML.length > 1000;
      
      return hasContent && images.length > 0;
    }, { timeout: 60000 });
    
    console.log('[Playwright] EPUB content detected, waiting for layout to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // === OPUS FIX: Wait for styles and fonts, then diagnose ===
    await waitForStylesAndFonts(page);
    await diagnoseStylesAndFonts(page);

    console.log(`[Playwright] Generating PDF at: ${pdfPath}`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(pdfPath);
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Delete existing file if it exists to avoid EBUSY error
    let finalPdfPath = pdfPath;
    if (fs.existsSync(finalPdfPath)) {
      try {
        fs.unlinkSync(finalPdfPath);
        console.log(`[Playwright] Removed existing PDF file: ${finalPdfPath}`);
      } catch (unlinkError) {
        console.warn(`[Playwright] Could not remove existing file: ${unlinkError.message}`);
        // Try with a different filename if removal fails
        const timestamp = Date.now();
        const ext = path.extname(finalPdfPath);
        const baseName = path.basename(finalPdfPath, ext);
        finalPdfPath = path.join(outputDir, `${baseName}_${timestamp}${ext}`);
        console.log(`[Playwright] Using alternative filename: ${finalPdfPath}`);
      }
    }

    // Use Opus's comprehensive PDF fix approach
    console.log('[Playwright] Using Opus comprehensive PDF fix...');
    const pdfBuffer = await comprehensivePDFFix(page, finalPdfPath);
    
    // Write the PDF buffer to file
    fs.writeFileSync(finalPdfPath, pdfBuffer);

    console.log('[Playwright] PDF generated successfully.');

  } catch (error) {
    console.error('[Playwright] An error occurred during PDF conversion:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('[Playwright] Conversion process finished.');
  }
}

convertToPdf(); 