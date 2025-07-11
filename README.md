# EPUB to PDF Converter

A modern web-based EPUB to PDF converter using Thorium/Readium rendering engine with multiple PDF generation options.

## Features
- **Thorium-style EPUB viewer** with Readium Navigator for maximum compatibility
- **Web interface** with drag-and-drop file upload
- **Multiple PDF converters**: Puppeteer (Chromium) and Playwright
- **Letter-size output** (8.5" × 11") with proper margins
- **Full image support** with automatic path resolution
- **Navigation controls** with section-by-section viewing
- **Real-time status updates** and progress tracking
- **Browser-accurate rendering** preserving all CSS, images, and fonts

## Quick Start

### Web Interface (Recommended)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

3. **Open your browser:**
   - Go to `http://localhost:3000`
   - Upload an EPUB file using the web interface
   - View the rendered content in the Thorium-style viewer
   - Click "Export to PDF" to generate PDF

### Command Line

1. **Place EPUB in input directory:**
   ```bash
   cp your-book.epub input/
   ```

2. **Convert to PDF:**
   ```bash
   npm run convert -- input/your-book.epub output/your-book.pdf
   ```

## System Architecture

### Core Components
- **`server.js`** - Express server handling uploads, extraction, and PDF conversion
- **`viewer/thorium-viewer.html`** - Thorium-style EPUB viewer with Readium components
- **Multiple PDF converters** - Puppeteer, Playwright for different output options

### Directory Structure
```
epub-to-pdf/
├── server.js                 # Main Express server
├── package.json              # Node.js dependencies
├── viewer/
│   ├── thorium-viewer.html   # Main Thorium-style viewer
│   └── index.html            # Legacy epub.js viewer
├── input/                    # Uploaded EPUB files
├── output/                   # Generated PDF files
├── temp/                     # Temporary extraction directory
│   ├── uploads/              # Temporary upload storage
│   └── [book-name]/          # Extracted EPUB content
│       ├── META-INF/         # EPUB container metadata
│       └── OEBPS/            # EPUB content
│           ├── xhtml/        # XHTML content files
│           ├── images/       # Image assets
│           ├── css/          # Stylesheets
│           ├── fonts/        # Font files
│           └── js/           # JavaScript files
└── java-legacy/              # Archived Java version (not used)
```

### System Flow
1. **Upload**: EPUB file → `temp/uploads/` → `input/`
2. **Extract**: EPUB archive → `temp/[book-name]/` (full structure)
3. **Serve**: Static files from extracted content for viewer access
4. **View**: Thorium-style viewer renders extracted content
5. **Convert**: PDF generation to `output/` directory

## Key Dependencies
- **@readium/navigator** - Thorium reading engine
- **@readium/css** - Readium CSS handling
- **@readium/shared** - Shared Readium components
- **puppeteer** - PDF generation via Chromium
- **playwright** - Alternative PDF generation
- **express** - Web server
- **multer** - File upload handling
- **admzip** - EPUB extraction
- **fs-extra** - Enhanced file system operations

## API Endpoints

### Upload EPUB
```
POST /upload-epub
Content-Type: multipart/form-data
Body: epub file
```

### Convert to PDF
```
POST /convert-to-pdf
Content-Type: application/json
Body: { "bookName": "book-name" }
```

### Download PDF
```
GET /download-pdf/:filename
```

## Troubleshooting

### Port Already in Use (Windows)
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID [PID] /F

# Start server
node server.js
```

### PowerShell Command Chaining
On Windows, use PowerShell syntax with semicolons:
```powershell
taskkill /PID [PID] /F; cd "D:\path\to\project"; node server.js
```

## Docker Support

1. **Build the image:**
   ```bash
   docker build -t epub-to-pdf .
   ```

2. **Run the container:**
   ```bash
   docker run --rm -v $(pwd)/input:/app/input -v $(pwd)/output:/app/output epub-to-pdf
   ```

## Notes
- **Letter-size output** (8.5" × 11") with 0.75" margins
- **Image loading fix** uses `replace()` instead of `substring()` for proper filename extraction
- **Thorium/Readium compatibility** ensures maximum EPUB support
- **Multiple PDF options** for different quality/size requirements
- **Real-time viewer** with navigation controls and section management 