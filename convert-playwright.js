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
    const viewer = document.querySelector('#viewer') || document.body;
    if (!viewer) {
      console.log('[DEBUG] No viewer element found, using document.body');
      return { error: 'No viewer element found' };
    }
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
  try {
    // 1. First analyze what's wrong
    const analysis = await analyzeImagePatterns(page);
    if (analysis.error) {
      console.log(`[WARNING] Image analysis failed: ${analysis.error}`);
      // Continue without image analysis
    } else {
      console.log(`Found ${analysis.missingCount} missing images out of ${analysis.totalImages}`);
    }
  
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
      
      /* Fix centering for figures with text-center class */
      figure.text-center {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        flex-direction: column !important;
        text-align: center !important;
        width: 100% !important;
      }
      
      figure.text-center img {
        display: block !important;
        margin: 0 auto !important;
      }
      
      /* Preserve inline padding styles that create section gaps */
      [style*="padding-bottom: 370px"] {
        padding-bottom: 370px !important;
      }
      
      /* Preserve original TOC styling - restore EPUB hyperlink appearance */
      /* Target all possible TOC link variations with maximum specificity */
      nav[epub\\:type="toc"] a,
      nav[role="doc-toc"] a,
      #toc a,
      nav[epub\\:type="toc"] ol a,
      nav[role="doc-toc"] ol a,
      #toc ol a,
      nav[epub\\:type="toc"] li a,
      nav[role="doc-toc"] li a,
      #toc li a,
      nav ol li a,
      nav ol a,
      nav li a,
      body nav[epub\\:type="toc"] a,
      body nav[role="doc-toc"] a,
      body #toc a,
      body nav ol li a,
      html body nav a,
      html body nav li a {
        color: #2A2CEA !important;
        text-decoration: underline !important;
        cursor: pointer !important;
        pointer-events: auto !important;
      }
      
      /* Extra specificity override for any inherited color rules */
      nav a[href*="xhtml/"],
      nav a[href*="Frontmatter"],
      nav a[href*="Lesson"] {
        color: #2A2CEA !important;
        text-decoration: underline !important;
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

  // 7. COMPREHENSIVE ELEMENT ANALYSIS - Analyze all potential section headers
  await page.evaluate(() => {
    console.log('[Playwright] === COMPREHENSIVE ELEMENT ANALYSIS ===');
    
    // Analyze all elements that could be section headers
    const potentialHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, span');
    const headerAnalysis = [];
    
    potentialHeaders.forEach((element, index) => {
      const computed = window.getComputedStyle(element);
      const fontSize = parseFloat(computed.fontSize);
      const fontWeight = computed.fontWeight;
      const textAlign = computed.textAlign;
      const textContent = element.textContent.trim();
      
      // Only analyze elements with meaningful text content and reasonable size
      if (textContent.length > 0 && textContent.length < 200 && fontSize >= 16) {
        headerAnalysis.push({
          index: index,
          tagName: element.tagName,
          fontSize: fontSize,
          fontSizeString: computed.fontSize,
          fontWeight: fontWeight,
          textAlign: textAlign,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          display: computed.display,
          position: computed.position,
          marginTop: computed.marginTop,
          marginBottom: computed.marginBottom,
          paddingTop: computed.paddingTop,
          paddingBottom: computed.paddingBottom,
          textContent: textContent.substring(0, 60),
          inlineStyle: element.getAttribute('style') || 'none',
          className: element.className || 'none',
          id: element.id || 'none'
        });
      }
    });
    
    // Sort by font size (largest first) to identify hierarchy
    headerAnalysis.sort((a, b) => b.fontSize - a.fontSize);
    
    console.log('=== POTENTIAL SECTION HEADERS (sorted by font size) ===');
    headerAnalysis.forEach((header, index) => {
      console.log(`${index + 1}. ${header.tagName} (${header.fontSize}px): "${header.textContent}"`);
      console.log(`   - Font Weight: ${header.fontWeight}`);
      console.log(`   - Text Align: ${header.textAlign}`);
      console.log(`   - Color: ${header.color}`);
      console.log(`   - Inline Style: ${header.inlineStyle}`);
      console.log(`   - Class: ${header.className}`);
      console.log(`   - ID: ${header.id}`);
      console.log('   ---');
    });
    
    // Group by font size to understand document structure
    const fontSizeGroups = {};
    headerAnalysis.forEach(header => {
      const size = header.fontSize;
      if (!fontSizeGroups[size]) {
        fontSizeGroups[size] = [];
      }
      fontSizeGroups[size].push(header);
    });
    
    console.log('=== FONT SIZE GROUPS ===');
    Object.keys(fontSizeGroups).sort((a, b) => b - a).forEach(size => {
      console.log(`${size}px (${fontSizeGroups[size].length} elements):`);
      fontSizeGroups[size].forEach(header => {
        console.log(`  - ${header.tagName}: "${header.textContent}"`);
      });
    });
    
    // Store analysis for page break logic
    window.headerAnalysis = headerAnalysis;
    window.fontSizeGroups = fontSizeGroups;
  });

  // 8. Add page breaks before major sections (PDF only)
  await page.evaluate(() => {
    console.log('[Playwright] Adding page breaks before major sections...');
    
    let pageBreaksAdded = 0;
    
    // Smart approach: Find the 2 largest font sizes in the entire EPUB and apply page breaks only to those
    console.log('[Playwright] Analyzing font sizes to find top 2 largest in entire EPUB...');
    
    // Step 1: Collect all elements and their font sizes
    const allElements = document.querySelectorAll('div');
    const fontSizeMap = new Map();
    
    allElements.forEach((element) => {
      const computed = window.getComputedStyle(element);
      const fontSize = parseFloat(computed.fontSize);
      const textContent = element.textContent.trim();
      
      // Only consider div elements with meaningful text content
      if (textContent.length > 0 && textContent.length < 200 && fontSize >= 16) {
        if (!fontSizeMap.has(fontSize)) {
          fontSizeMap.set(fontSize, []);
        }
        fontSizeMap.get(fontSize).push({element, text: textContent});
      }
    });
    
    // Step 2: Find the 2 largest font sizes in the entire EPUB
    const sortedFontSizes = Array.from(fontSizeMap.keys()).sort((a, b) => b - a);
    const top2FontSizes = sortedFontSizes.slice(0, 2);
    
    console.log(`[Playwright] All font sizes found: ${sortedFontSizes.join(', ')}px`);
    console.log(`[Playwright] Top 2 largest font sizes: ${top2FontSizes.join(', ')}px`);
    
    // Step 3: Apply page breaks before elements with top 2 font sizes
    if (top2FontSizes.length > 0) {
      top2FontSizes.forEach(fontSize => {
        const elements = fontSizeMap.get(fontSize) || [];
        
        elements.forEach(({element, text}) => {
          // Skip cover page elements (keep cover page as one)
          if (text.includes('Teacher') && text.includes('Edition')) {
            console.log(`[Playwright] Skipping cover page: ${text.substring(0, 30)}...`);
            return;
          }
          if (text.includes('Grade K') && text.includes('Unit')) {
            console.log(`[Playwright] Skipping cover page: ${text.substring(0, 30)}...`);
            return;
          }
          
          element.style.pageBreakBefore = 'always';
          element.style.breakBefore = 'page';
          pageBreaksAdded++;
          console.log(`[Playwright] Added page break before ${fontSize}px div: ${text.substring(0, 40)}...`);
        });
      });
    }
    
    // Note: Only adding page breaks before major DIV sections, not H1/H2 elements
    
    console.log(`[Playwright] Total page breaks added: ${pageBreaksAdded}`);
  });

  // 8. Wait for layout to stabilize after DOM change
  await page.waitForTimeout(1000);

  // 9. Generate PDF
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false
  });

  return pdf;
  } catch (error) {
    console.error('[Playwright] Error in comprehensivePDFFix:', error);
    
    // Fallback: Generate PDF without advanced fixes
    console.log('[Playwright] Attempting fallback PDF generation...');
    const fallbackPdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: false
    });
    
    return fallbackPdf;
  }
}

async function generateElementAnalysisPDF(page, outputPath) {
  console.log('[Playwright] Generating element analysis PDF...');
  
  // Create comprehensive element analysis
  const analysisData = await page.evaluate(() => {
    const potentialHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, span');
    const headerAnalysis = [];
    
    potentialHeaders.forEach((element, index) => {
      const computed = window.getComputedStyle(element);
      const fontSize = parseFloat(computed.fontSize);
      const fontWeight = computed.fontWeight;
      const textAlign = computed.textAlign;
      const textContent = element.textContent.trim();
      
      // Only analyze elements with meaningful text content and reasonable font size
      if (textContent.length > 0 && textContent.length < 200 && fontSize >= 16) {
        headerAnalysis.push({
          index,
          tag: element.tagName.toLowerCase(),
          text: textContent.substring(0, 100),
          fontSize: fontSize,
          fontWeight: fontWeight,
          textAlign: textAlign,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          display: computed.display,
          position: computed.position,
          marginTop: computed.marginTop,
          marginBottom: computed.marginBottom,
          paddingTop: computed.paddingTop,
          paddingBottom: computed.paddingBottom,
          inlineStyle: element.getAttribute('style') || '',
          className: element.className || '',
          id: element.id || ''
        });
      }
    });
    
    // Sort by font size (largest first)
    headerAnalysis.sort((a, b) => b.fontSize - a.fontSize);
    
    return headerAnalysis;
  });
  
  // Create HTML content for the analysis
  const analysisHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Element Analysis Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 10px; margin-bottom: 20px; }
        .element { border: 1px solid #ddd; margin: 10px 0; padding: 10px; }
        .element-header { font-weight: bold; color: #333; }
        .element-details { margin-top: 5px; font-size: 12px; }
        .element-text { background: #f9f9f9; padding: 5px; margin: 5px 0; font-style: italic; }
        .font-size-group { background: #e8f4f8; padding: 10px; margin: 15px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>EPUB Element Analysis Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Total Elements Analyzed: ${analysisData.length}</p>
      </div>
      
      <h2>All Elements (Sorted by Font Size)</h2>
      <table>
        <tr>
          <th>Index</th>
          <th>Tag</th>
          <th>Font Size</th>
          <th>Font Weight</th>
          <th>Text Align</th>
          <th>Text Content</th>
          <th>ID</th>
          <th>Class</th>
          <th>Inline Style</th>
        </tr>
        ${analysisData.map(element => `
          <tr>
            <td>${element.index}</td>
            <td>${element.tag.toUpperCase()}</td>
            <td>${element.fontSize}px</td>
            <td>${element.fontWeight}</td>
            <td>${element.textAlign}</td>
            <td title="${element.text}">${element.text.substring(0, 50)}${element.text.length > 50 ? '...' : ''}</td>
            <td>${element.id}</td>
            <td>${element.className}</td>
            <td title="${element.inlineStyle}">${element.inlineStyle.substring(0, 30)}${element.inlineStyle.length > 30 ? '...' : ''}</td>
          </tr>
        `).join('')}
      </table>
      
      <h2>Font Size Groups</h2>
      ${(() => {
        const fontSizeGroups = {};
        analysisData.forEach(element => {
          const size = element.fontSize;
          if (!fontSizeGroups[size]) {
            fontSizeGroups[size] = [];
          }
          fontSizeGroups[size].push(element);
        });
        
        return Object.keys(fontSizeGroups)
          .sort((a, b) => parseFloat(b) - parseFloat(a))
          .map(size => `
            <div class="font-size-group">
              <h3>Font Size: ${size}px (${fontSizeGroups[size].length} elements)</h3>
              ${fontSizeGroups[size].map(element => `
                <div class="element">
                  <div class="element-header">${element.tag.toUpperCase()}: ${element.text.substring(0, 60)}${element.text.length > 60 ? '...' : ''}</div>
                  <div class="element-details">
                    Weight: ${element.fontWeight} | Align: ${element.textAlign} | 
                    Color: ${element.color} | Display: ${element.display}
                    ${element.id ? ` | ID: ${element.id}` : ''}
                    ${element.className ? ` | Class: ${element.className}` : ''}
                  </div>
                  ${element.inlineStyle ? `<div class="element-details">Inline Style: ${element.inlineStyle}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `).join('');
      })()}
      
      <h2>Potential Page Break Candidates</h2>
      <p>Elements that might be good candidates for page breaks:</p>
      ${analysisData
        .filter(element => 
          element.fontSize >= 24 && 
          (element.fontWeight === 'bold' || element.fontWeight === '700' || element.fontWeight > 400 || element.textAlign === 'center')
        )
        .map(element => `
          <div class="element">
            <div class="element-header">CANDIDATE: ${element.tag.toUpperCase()} - ${element.text.substring(0, 80)}</div>
            <div class="element-details">
              Font: ${element.fontSize}px, Weight: ${element.fontWeight}, Align: ${element.textAlign}
              ${element.id ? ` | ID: ${element.id}` : ''}
              ${element.inlineStyle ? ` | Style: ${element.inlineStyle.substring(0, 100)}` : ''}
            </div>
          </div>
        `).join('')}
    </body>
    </html>
  `;
  
  // Set the HTML content
  await page.setContent(analysisHTML);
  
  // Generate the analysis PDF
  const analysisPdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  
  // Write the analysis PDF
  const fs = require('fs');
  const analysisPath = outputPath.replace('.pdf', '_ANALYSIS.pdf');
  fs.writeFileSync(analysisPath, analysisPdf);
  
  console.log(`[Playwright] Element analysis PDF saved to: ${analysisPath}`);
  return analysisPath;
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

    // Generate element analysis PDF first (disabled)
    // await generateElementAnalysisPDF(page, finalPdfPath);

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