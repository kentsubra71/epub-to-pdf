const debug = document.getElementById('debug');
const statusDiv = document.getElementById('status-message');
let currentBookName = null;
let currentContentPath = null;
let readiumNavigator = null;
let currentSectionIndex = 0;
let totalSections = 0;
let sectionElements = [];

// Diagnostic: Print all CSS variables on :root and body after CSS is loaded
function printCssVariableDiagnostics() {
  function getAllCssVars(element) {
    const styles = getComputedStyle(element);
    const vars = {};
    for (let i = 0; i < styles.length; i++) {
      const name = styles[i];
      if (name.startsWith('--')) {
        vars[name] = styles.getPropertyValue(name).trim();
      }
    }
    return vars;
  }
  const rootVars = getAllCssVars(document.documentElement);
  const bodyVars = getAllCssVars(document.body);
  
  
  // Print specific variables of interest
  
  
  
  
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.style.color = type === 'error' ? '#ff6b6b' : type === 'warn' ? '#ffd93d' : '#6bcf7f';
  logEntry.textContent = `[${timestamp}] ${message}`;
  debug.appendChild(logEntry);
  debug.scrollTop = debug.scrollHeight;
  
}

function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}

log('Thorium-style viewer loaded with Readium Navigator');

// Add global error handlers to prevent JavaScript errors from blocking content
window.addEventListener('error', function(event) {
  event.preventDefault();
  return true;
});

window.addEventListener('unhandledrejection', function(event) {
  event.preventDefault();
});

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', async function() {
  
  
  const urlParams = new URLSearchParams(window.location.search);
  const bookName = urlParams.get('book');
  const isPdfMode = urlParams.get('pdf') === 'true';
  

  
  if (bookName) {
    
    try {
      // Load complete EPUB CSS context FIRST (like Thorium Desktop)
      
      await loadCompleteEpubCSS(bookName);
      
      // Then load the EPUB content
      await loadEpub(bookName, isPdfMode);
      
    } catch (error) {
      // Error during startup
    }
  } else {
    // No bookName found in URL params
    
  }
});

// Load book using Readium Navigator (like Thorium)
async function loadBookFromExtracted(bookName) {
  try {
    log(`Loading book with Readium Navigator: ${bookName}`);
    showStatus('Initializing Readium Navigator...', 'info');
    
    // CRITICAL: Load complete EPUB CSS context FIRST (like Thorium Desktop)
    
    await loadCompleteEpubCSS(bookName);
    
    
    // Create a basic publication manifest for the extracted EPUB
    const cleanBookName = bookName.replace('.epub', '');
    const manifestUrl = `/temp/${cleanBookName}/OEBPS/content.opf`;
    
    // Load the OPF file to create a publication
    const opfResponse = await fetch(manifestUrl);
    if (!opfResponse.ok) {
      throw new Error(`Failed to load OPF: ${opfResponse.status}`);
    }
    
    const opfText = await opfResponse.text();
    log(`OPF loaded, length: ${opfText.length}`);
    
    // Parse OPF to create publication manifest
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfText, 'application/xml');
    
    // Extract metadata
    const title = opfDoc.querySelector('title')?.textContent || 'Unknown Title';
    const creator = opfDoc.querySelector('creator')?.textContent || 'Unknown Author';
    
    // Extract spine items
    const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref')).map(item => {
      const idref = item.getAttribute('idref');
      const manifestItem = opfDoc.querySelector(`manifest item[id="${idref}"]`);
      return {
        href: manifestItem?.getAttribute('href'),
        mediaType: manifestItem?.getAttribute('media-type') || 'application/xhtml+xml'
      };
    }).filter(item => item.href);
    
    log(`Found ${spineItems.length} spine items`);
    
    // Create a simplified publication object
    const publication = {
      metadata: {
        title: title,
        author: creator,
        identifier: cleanBookName
      },
      readingOrder: spineItems.map(item => ({
        href: `/temp/${cleanBookName}/OEBPS/${item.href}`,
        type: item.mediaType
      })),
      resources: [] // We'll let the navigator handle resources
    };
    
    // Clear viewer and initialize Readium Navigator
    const viewer = document.getElementById('viewer');
    viewer.innerHTML = '';
    
    // Create a simple navigator-like interface
    await renderWithReadiumStyle(publication, viewer);
    
    currentBookName = cleanBookName;
    currentContentPath = `/temp/${cleanBookName}`;
    
    // Signal ready for PDF
    window.readyForPdf = true;
    
    showStatus('EPUB loaded with Readium-style rendering!', 'success');
    log('Book loaded successfully with Readium-style rendering');
    
    // After book is fully loaded and rendered, print diagnostics
    afterBookLoaded();
    
    // Apply CSS variable overrides to ensure correct styling
    applyCssVariableOverrides();
    
  } catch (error) {
    log(`Error loading book: ${error.message}`, 'error');
    showStatus(`Failed to load EPUB: ${error.message}`, 'error');
    throw error;
  }
}

// Render content using Readium-style approach
async function renderWithReadiumStyle(publication, container) {
  log('Rendering with Readium-style approach...');
  
  // Create main content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'readium-navigator-content';
  contentContainer.style.cssText = `
    width: 100%;
    height: 100%;
    overflow: visible;
    background: white;
    line-height: 1.6;
    color: #333;
    padding: ${document.body.classList.contains('pdf-mode') ? '0' : '0.75in'};
    box-sizing: border-box;
  `;
  
  // Load and apply Readium CSS if available
  try {
    const readiumCssResponse = await fetch('/node_modules/@readium/css/dist/index.css');
    if (readiumCssResponse.ok) {
      const cssText = await readiumCssResponse.text();
      const style = document.createElement('style');
      style.textContent = cssText;
      document.head.appendChild(style);
      log('Readium CSS loaded');
    }
  } catch (e) {
    log('Could not load Readium CSS, using fallback styles', 'warn');
  }
  
  // Render each reading order item
  for (let i = 0; i < publication.readingOrder.length; i++) {
    const item = publication.readingOrder[i];
    log(`Rendering item ${i + 1}/${publication.readingOrder.length}: ${item.href}`);
    
    try {
      const response = await fetch(item.href);
      if (!response.ok) {
        log(`Failed to load ${item.href}: ${response.status}`, 'warn');
        continue;
      }
      
      const htmlContent = await response.text();
      
      // Create section container
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'readium-section';
      sectionDiv.style.cssText = `
        page-break-after: always;
        margin: 0;
        padding: 0;
        background: white;
        min-height: 9.5in;
        width: auto;
        box-sizing: border-box;
        overflow-y: visible;
      `;
      
      // Parse and inject content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Remove external JavaScript dependencies that may cause loading issues
      if (doc.head) {
        const externalScripts = doc.head.querySelectorAll('script[src*="http"]');
        externalScripts.forEach(script => {
          
          script.remove();
        });
      }
      
      // Load section-specific CSS
      if (doc.head) {
        const styleLinks = doc.head.querySelectorAll('link[rel="stylesheet"]');
        for (const link of styleLinks) {
          const href = link.getAttribute('href');
          if (href && !href.startsWith('http')) {
            const bookName = currentBookName || publication.metadata.identifier;
            const cleanBookName = bookName.replace('.epub', '');
            const cssUrl = `/temp/${cleanBookName}/OEBPS/${href}`;
            
            // CSS is already loaded upfront, so we don't need to load it again
            // Just ensure the link is properly resolved
            
          }
        }
      }
      
      // Extract and process body content
      let bodyContent;
      if (doc.body) {
        // Remove any script tags from body content to prevent JavaScript errors
        const bodyScripts = doc.body.querySelectorAll('script');
        bodyScripts.forEach(script => {
          if (script.src && script.src.includes('http')) {
            
            script.remove();
          }
        });
        bodyContent = doc.body.innerHTML;
      } else {
        bodyContent = htmlContent;
      }
      sectionDiv.innerHTML = bodyContent;
      
      // Fix image paths
      const images = sectionDiv.querySelectorAll('img');
      images.forEach((img, imgIndex) => {
        const originalSrc = img.getAttribute('src');
        if (originalSrc && !originalSrc.startsWith('http')) {
          const bookName = currentBookName || publication.metadata.identifier;
          let newSrc;
          
          // Handle different image path patterns
          // Remove .epub extension if present in bookName
          const cleanBookName = bookName.replace('.epub', '');
          
          if (originalSrc.startsWith('../images/')) {
            // Extract filename by replacing '../images/' with empty string
            const filename = originalSrc.replace('../images/', '');
            newSrc = `/temp/${cleanBookName}/OEBPS/images/${filename}`;
          } else if (originalSrc.startsWith('../')) {
            // Extract path by replacing '../' with empty string
            const relativePath = originalSrc.replace('../', '');
            newSrc = `/temp/${cleanBookName}/OEBPS/${relativePath}`;
          } else if (originalSrc.startsWith('images/')) {
            // Extract filename by replacing 'images/' with empty string
            const filename = originalSrc.replace('images/', '');
            newSrc = `/temp/${cleanBookName}/OEBPS/images/${filename}`;
          } else if (originalSrc.includes('/')) {
            newSrc = `/temp/${cleanBookName}/OEBPS/${originalSrc}`;
          } else {
            newSrc = `/temp/${cleanBookName}/OEBPS/images/${originalSrc}`;
          }
          
          img.src = newSrc;
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          
          // Add error handling for missing images
          img.onerror = function() {
            log(`Image not found: ${newSrc}`, 'warn');
            // Try alternative paths
            const alternatives = [
              `/temp/${cleanBookName}/OEBPS/images/${originalSrc}`,
              `/temp/${cleanBookName}/OEBPS/xhtml/${originalSrc}`,
              `/temp/${cleanBookName}/OEBPS/${originalSrc}`
            ];
            
            let altIndex = 0;
            const tryNext = () => {
              if (altIndex < alternatives.length) {
                img.src = alternatives[altIndex];
                altIndex++;
              }
            };
            
            img.onerror = tryNext;
            tryNext();
          };
          
          log(`Fixed image ${imgIndex + 1}: ${originalSrc} → ${newSrc}`);
        }
      });
      
      sectionElements.push(sectionDiv);
      contentContainer.appendChild(sectionDiv);
      
    } catch (error) {
      log(`Error rendering section ${item.href}: ${error.message}`, 'error');
    }
  }
  
  totalSections = sectionElements.length;
  container.appendChild(contentContainer);
  
  // Initialize navigation
  setupNavigation();
  showSection(0);
  
  log('Readium-style rendering complete');
  
  // Apply CSS variable overrides after content is rendered
  applyCssVariableOverrides();
  
  // REMOVED: This was overriding ALL font-sizes to 13px, destroying the original 40px headings
  // Instead, let the original inline font-sizes be preserved
}

// Navigation functions
function setupNavigation() {
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');
  
  prevBtn.addEventListener('click', () => {
    if (currentSectionIndex > 0) {
      showSection(currentSectionIndex - 1);
    }
  });
  
  nextBtn.addEventListener('click', () => {
    if (currentSectionIndex < totalSections - 1) {
      showSection(currentSectionIndex + 1);
    }
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentSectionIndex > 0) {
        showSection(currentSectionIndex - 1);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentSectionIndex < totalSections - 1) {
        showSection(currentSectionIndex + 1);
      }
    }
  });
  
  updateNavigationButtons();
}

function showSection(index) {
  if (index < 0 || index >= totalSections) return;
  
  // Hide all sections
  sectionElements.forEach(section => {
    section.style.display = 'none';
  });
  
  // Show current section
  if (sectionElements[index]) {
    sectionElements[index].style.display = 'block';
    currentSectionIndex = index;
    updateNavigationButtons();
    
    // Scroll to top of viewer
    const viewer = document.getElementById('viewer');
    viewer.scrollTop = 0;
    
    log(`Showing section ${index + 1}/${totalSections}`);
    showStatus(`Page ${index + 1} of ${totalSections}`, 'info');
  }
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');
  
  if (prevBtn && nextBtn) {
    prevBtn.style.opacity = currentSectionIndex > 0 ? '1' : '0.3';
    nextBtn.style.opacity = currentSectionIndex < totalSections - 1 ? '1' : '0.3';
    
    prevBtn.disabled = currentSectionIndex === 0;
    nextBtn.disabled = currentSectionIndex === totalSections - 1;
  }
}

function showAllSectionsForPdf() {
  // Show all sections for PDF export
  sectionElements.forEach(section => {
    section.style.display = 'block';
  });
  
  // Signal ready for PDF
  window.readyForPdf = true;
  log('All sections visible for PDF export');
}

// Reload functionality
const reloadBtn = document.getElementById('reload-btn');
if (reloadBtn) {
  reloadBtn.addEventListener('click', () => {
    if (currentBookName) {
      currentSectionIndex = 0;
      sectionElements = [];
      totalSections = 0;
      loadBookFromExtracted(currentBookName);
    }
  });
}

// Helper to rewrite url(...) in CSS to correct /temp/{bookName}/OEBPS/ path
function rewriteCSSUrls(cssText, bookName) {
  // Rewrite relative URLs and absolute /fonts/ or /images/ URLs
  const urlRegex = /url\((['"]?)(?!https?:|data:)([^'"\)]+)\1\)/g;
  let rewriteCount = 0;
  const rewritten = cssText.replace(urlRegex, (match, quote, relPath) => {
    let fixedPath = relPath.trim();
    // If already absolute and starts with /fonts/ or /images/, remove leading /
    if (fixedPath.startsWith('/fonts/') || fixedPath.startsWith('/images/')) {
      fixedPath = fixedPath.substring(1);
    }
    // If the path starts with ../, remove it
    if (fixedPath.startsWith('../')) {
      fixedPath = fixedPath.substring(3);
    }
    // If the path starts with ./, remove it
    if (fixedPath.startsWith('./')) {
      fixedPath = fixedPath.substring(2);
    }
    // Compose the new URL
    const newUrl = `/temp/${bookName}/OEBPS/${fixedPath}`;
    rewriteCount++;
    
    return `url(${quote}${newUrl}${quote})`;
  });
  if (rewriteCount > 0) {
    
  }
  return rewritten;
}

// Load ALL CSS files from OPF manifest to ensure complete context (like Thorium Desktop)
async function loadCompleteEpubCSS(bookName) {
  
  
  try {
    // Parse the OPF manifest to get all CSS files
    const opfUrl = `/temp/${bookName}/OEBPS/content.opf`;
    
    
    const opfResponse = await fetch(opfUrl);
    if (!opfResponse.ok) {
      throw new Error(`Failed to fetch OPF: ${opfResponse.status} ${opfResponse.statusText}`);
    }
    
    const opfText = await opfResponse.text();
    
    
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfText, 'text/xml');
    
    // Check for parsing errors
    const parseError = opfDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Failed to parse OPF XML: ' + parseError.textContent);
    }
    
    // Extract all CSS files from manifest
    const cssItems = opfDoc.querySelectorAll('item[media-type="text/css"]');
    
    
    const cssFiles = Array.from(cssItems).map(item => {
      const href = item.getAttribute('href');
      const id = item.getAttribute('id');
      
      return href;
    }).filter(href => href); // Remove any null/undefined hrefs
    
    
    
    if (cssFiles.length === 0) {
      // No CSS files found in OPF manifest
      // Let's also check for any items to see what's in the manifest
      const allItems = opfDoc.querySelectorAll('item');
    }
    
    // Load all CSS files in order (variables first, then core, then components)
    const variableFiles = cssFiles.filter(href => href.includes('variable_'));
    const coreFiles = cssFiles.filter(href => href.includes('core_'));
    const componentFiles = cssFiles.filter(href => href.includes('component_'));
    

    
    // Load in order: variables first (they define CSS variables), then core, then components
    const orderedFiles = [...variableFiles, ...coreFiles, ...componentFiles];
    
    
    
    for (const cssFile of orderedFiles) {
      const cssUrl = `/temp/${bookName}/OEBPS/${cssFile}`;
      
      try {
        const cssResponse = await fetch(cssUrl);
        
        
        if (cssResponse.ok) {
          let cssText = await cssResponse.text();
          
          
          cssText = rewriteCSSUrls(cssText, bookName);
          // Remove all @import lines to prevent browser 404s
          cssText = cssText.replace(/@import[^;]+;/g, '');
          
          const styleTag = document.createElement('style');
          styleTag.textContent = cssText;
          document.head.appendChild(styleTag);
          
        } else {
          // Failed to fetch CSS
        }
      } catch (error) {
        // Error loading CSS
      }
    }
    
    
    
    // Set root font-size to match Thorium Desktop - but preserve centering
    const rootFontSizeStyle = document.createElement('style');
    rootFontSizeStyle.textContent = `
      html { font-size: 10px !important; }
      
          /* Preserve centering for title page elements */
div[style*="text-align: center"] {
  text-align: center !important;
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
      
      /* PRESERVE original inline font-size declarations - don't override them */
      /* The problem is they're being overridden to 13px somewhere else */
      
      /* Ensure centered headings maintain their alignment */
      div[style*="font-size"][style*="text-align: center"] {
        text-align: center !important;
        display: block !important;
        width: 100% !important;
      }
    `;
    document.head.prepend(rootFontSizeStyle);
    
    
    // AGGRESSIVE: Force font-size overrides via JavaScript DOM manipulation
    setTimeout(() => {
      
      
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
      
      
      elementsWithFontSize.forEach((element, index) => {
        const currentStyle = element.getAttribute('style') || '';
        
        
        // Check each font size in our map
        Object.keys(fontSizeMap).forEach(originalSize => {
          const newSize = fontSizeMap[originalSize];
          
          // Check for both spaced and non-spaced versions
          if (currentStyle.includes(`font-size: ${originalSize}`) || 
              currentStyle.includes(`font-size:${originalSize}`)) {
            
            
            
            // Force the new font-size using setProperty with important
            element.style.setProperty('font-size', newSize, 'important');
            
            // Verify the change
            const computedSize = window.getComputedStyle(element).fontSize;
            
          }
        });
      });
      
    }, 500); // Run after CSS is loaded
    
  } catch (error) {
    // Failed to load complete EPUB CSS context
  }
  
  // After loading all CSS, print diagnostics
  
  printCssVariableDiagnostics();
}

// Apply CSS variable overrides after content is rendered
function applyCssVariableOverrides() {
  
  
  
  // Debug: Check what CSS variables are available
  const rootStyle = getComputedStyle(document.documentElement);
  
  
  
  
  
  // Debug: Check current computed styles
  const bodyStyle = getComputedStyle(document.body);
  
  
  
  
  
  // Remove any existing override styles
  const existingOverrides = document.querySelectorAll('style[data-css-override]');
  existingOverrides.forEach(style => style.remove());
  
  // Add simplified override rules that work with our font-size fixes
  const overrideStyle = document.createElement('style');
  overrideStyle.setAttribute('data-css-override', 'true');
  overrideStyle.textContent = `
    /* Force CSS variables to be applied */
    html {
      --defaultFont: "proximanova-regular" !important;
      --fs-p: 1.625rem !important;
    }
    
    /* Apply font-family consistently but don't override font-size */
    body, body * {
      font-family: var(--defaultFont), "proximanova-regular", sans-serif !important;
    }
    
    /* Target specific EPUB content areas */
    .readium-navigator-content,
    .readium-navigator-content *,
    .readium-section,
    .readium-section * {
      font-family: var(--defaultFont), "proximanova-regular", sans-serif !important;
    }
    
    /* Override inline font-family but preserve font-size overrides */
    [style*="font-family"] {
      font-family: var(--defaultFont), "proximanova-regular", sans-serif !important;
    }
    
    /* Apply consistent font-family to all elements */
    p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, article, section {
      font-family: var(--defaultFont), "proximanova-regular", sans-serif !important;
    }
    
    /* Only override body text size, not heading sizes */
    body {
      font-size: var(--fs-p) !important;
    }
    
    /* Override small text elements */
    figcaption, .caption, .small-text {
      font-size: 10.4px !important;
    }
  `;
  document.head.appendChild(overrideStyle);
  
  
  // Force a reflow to ensure styles are applied
  document.body.offsetHeight;
  
  // Log the computed styles to verify
  setTimeout(() => {
    const bodyElement = document.body;
    const computedStyle = window.getComputedStyle(bodyElement);
    
    
    
    // Check a few specific elements
    const viewer = document.getElementById('viewer');
    if (viewer) {
      const viewerStyle = window.getComputedStyle(viewer);
      
      
    }
    
    // Check if there are any elements with inline styles
    const elementsWithInlineStyles = document.querySelectorAll('[style*="font-family"], [style*="font-size"]');
    
    elementsWithInlineStyles.forEach((el, index) => {
      if (index < 5) { // Only log first 5
        
      }
    });
  }, 100);
}

// After book is fully loaded and rendered, print diagnostics
function afterBookLoaded() {
  printCssVariableDiagnostics();
}

async function loadEpub(bookName, isPdfMode) {
  try {
    if (isPdfMode) {
      document.body.classList.add('pdf-mode');
      log('PDF export mode enabled');
      
      // For PDF mode, show all sections
      setTimeout(() => {
        showAllSectionsForPdf();
      }, 1000);
    }
    
    log(`Loading book from extracted files: ${bookName}`);
    await loadBookFromExtracted(bookName);
  } catch (error) {
    // Failed to load EPUB
  }
} 