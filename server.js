const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const multer = require('multer');
const { spawn } = require('child_process');
const fsExtra = require('fs-extra');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'temp/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('Only EPUB files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Add CORS support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Function to extract EPUB if needed
function extractEpubIfNeeded(epubPath, extractPath) {
  if (!fs.existsSync(extractPath)) {
    console.log(`Extracting EPUB: ${epubPath}`);
    const zip = new AdmZip(epubPath);
    zip.extractAllTo(extractPath, true);
    console.log(`EPUB extracted to: ${extractPath}`);
  }
}

// Serve the epub.js viewer
app.use('/viewer', express.static(path.join(__dirname, 'viewer')));

// Serve Readium modules for Thorium-style viewer
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Serve input directory for EPUB files
app.use('/input', express.static(path.join(__dirname, 'input'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.epub')) {
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

// Serve temp directory for extracted EPUB files
app.use('/temp', express.static(path.join(__dirname, 'temp'), {
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Endpoint to handle EPUB file uploads and extraction
app.post('/upload-epub', upload.single('epub'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const uploadedFilePath = req.file.path;
    let bookName = path.basename(uploadedFilePath, '.epub');
    let tempDir = path.join(__dirname, 'temp', bookName);
    const inputDir = path.join(__dirname, 'input');
    let finalEpubPath = path.join(inputDir, `${bookName}.epub`);

    // Clean up previous extraction
    await fs.emptyDir(tempDir);
    
    console.log(`Processing uploaded EPUB: ${uploadedFilePath}`);
    
    // Remove existing file if it exists
    if (await fs.pathExists(finalEpubPath)) {
      try {
        await fs.remove(finalEpubPath);
        console.log(`Removed existing EPUB file: ${finalEpubPath}`);
      } catch (removeError) {
        console.warn(`Could not remove existing file: ${finalEpubPath}`, removeError.message);
        // Try to use a different filename if removal fails
        const timestamp = Date.now();
        const bookNameWithTimestamp = `${bookName}_${timestamp}`;
        const altFinalEpubPath = path.join(inputDir, `${bookNameWithTimestamp}.epub`);
        console.log(`Using alternative filename: ${altFinalEpubPath}`);
        // Update variables to use the new filename
        finalEpubPath = altFinalEpubPath;
        bookName = bookNameWithTimestamp;
        tempDir = path.join(__dirname, 'temp', bookNameWithTimestamp);
        await fs.emptyDir(tempDir);
      }
    }
    
    // Copy the uploaded file to input directory with proper handling
    await fs.copy(uploadedFilePath, finalEpubPath);
    
    // Wait a moment and verify the copied file
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const stats = await fs.stat(finalEpubPath);
    if (stats.size === 0) {
      throw new Error('Copied EPUB file is empty');
    }
    
    console.log(`EPUB copied to: ${finalEpubPath} (${stats.size} bytes)`);
    console.log(`Extracting EPUB to: ${tempDir}`);
    
    // Use AdmZip for extraction from the copied file
    const zip = new AdmZip(finalEpubPath);
    zip.extractAllTo(tempDir, true);

    console.log(`EPUB extracted successfully`);

    // Find the .opf file to determine the root of the EPUB content
    const containerXmlPath = path.join(tempDir, 'META-INF', 'container.xml');
    const containerXml = await fs.readFile(containerXmlPath, 'utf-8');
    const parser = new xml2js.Parser();
    const containerData = await parser.parseStringPromise(containerXml);
    const opfPath = containerData.container.rootfiles[0].rootfile[0].$['full-path'];
    
    const contentPath = path.join(bookName, opfPath);

    // Clean up the temporary uploaded file
    try {
      await fs.remove(uploadedFilePath);
      console.log(`Cleaned up temporary file: ${uploadedFilePath}`);
    } catch (cleanupError) {
      console.warn(`Could not clean up temporary file: ${uploadedFilePath}`, cleanupError.message);
    }

    res.json({
      success: true,
      message: 'EPUB uploaded and extracted successfully.',
      contentPath: contentPath,
      bookName: bookName
    });

  } catch (error) {
    console.error('Error during EPUB upload and extraction:', error);
    res.status(500).json({ success: false, message: 'Failed to process EPUB.', error: error.message });
  }
});

// Endpoint to trigger the conversion process
app.post('/convert-to-pdf', (req, res) => {
  const { bookName } = req.body;
  if (!bookName) {
    return res.status(400).json({ success: false, message: 'No bookName provided.' });
  }
  
  const viewerUrl = `http://localhost:${PORT}/viewer/thorium-viewer.html?book=${bookName}&pdf=true`;
  
  // Define output path for Playwright only
  const outputPath = path.join(__dirname, 'output', `${bookName}_playwright.pdf`);

  console.log(`Starting Playwright PDF conversion for book: ${bookName}`);
  console.log(`Using viewer URL: ${viewerUrl}`);

  // Start Playwright conversion with Opus fixes
  const playwrightConversion = spawn('node', ['convert-playwright.js', viewerUrl, outputPath], {
    stdio: 'inherit'
  });

  playwrightConversion.on('close', (code) => {
    const success = code === 0;
    console.log(`[Playwright] Conversion finished with code ${code}`);
    if (success) {
      res.json({
        success: true,
        message: 'PDF generated successfully with Playwright.',
        pdf: `/output/${bookName}_playwright.pdf`
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Playwright PDF conversion failed.',
        exitCode: code
      });
    }
  });

  // Set a timeout in case conversion hangs
  setTimeout(() => {
    res.status(500).json({
      success: false,
      message: 'Playwright PDF conversion timed out.'
    });
  }, 180000); // 3 minute timeout
});

// PDF download endpoint
app.get('/download-pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  const pdfPath = path.join(__dirname, 'output', filename);

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ error: 'PDF file not found' });
  }

  res.download(pdfPath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Download failed' });
    }
  });
});

// Custom middleware to handle EPUB files
app.use('/epub', (req, res, next) => {
  const urlPath = req.path;
  
  // Check if this is a request for an EPUB file
  if (urlPath.endsWith('.epub')) {
    const epubName = path.basename(urlPath, '.epub');
    const epubPath = path.join(__dirname, 'input', `${epubName}.epub`);
    const extractPath = path.join(__dirname, 'temp', epubName);
    
    if (fs.existsSync(epubPath)) {
      extractEpubIfNeeded(epubPath, extractPath);
      
      // Serve the extracted EPUB directory
      express.static(extractPath)(req, res, next);
    } else {
      res.status(404).send('EPUB not found');
    }
  } else {
    // Handle requests for files within extracted EPUB
    const pathParts = urlPath.split('/');
    if (pathParts.length >= 2) {
      const epubName = pathParts[1];
      const filePath = pathParts.slice(2).join('/');
      const extractPath = path.join(__dirname, 'temp', epubName);
      
      if (fs.existsSync(extractPath)) {
        express.static(extractPath)(req, res, next);
      } else {
        res.status(404).send('EPUB not extracted');
      }
    } else {
      next();
    }
  }
});

// Fallback: serve EPUB files directly from input directory
app.use('/epub', express.static(path.join(__dirname, 'input')));

// Create necessary directories
const requiredDirs = ['temp', 'temp/uploads', 'input', 'output'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Redirect root to thorium viewer (default)
app.get('/', (req, res) => {
  res.redirect('/viewer/thorium-viewer.html');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 