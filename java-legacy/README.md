# EPUB to PDF Converter

A Java application that converts reflowable EPUB files to PDF using Apache PDFBox.

## Features

- ✅ Converts reflowable EPUB files to PDF format
- ✅ Preserves book structure with title page and chapters
- ✅ Handles text wrapping and page breaks automatically
- ✅ Dockerized for easy deployment
- ✅ Command-line interface
- ✅ Proper error handling and logging

## Requirements

### With Docker (Recommended)
- Docker
- Docker Compose

### Without Docker
- Java 11 or higher
- Maven 3.6 or higher

## Quick Start with Docker

1. **Build the Docker image:**
   ```bash
   docker build -t epub-to-pdf-converter .
   ```

2. **Place your EPUB file in the `input` directory:**
   ```bash
   # Create input directory if it doesn't exist
   mkdir -p input
   cp your-book.epub input/
   ```

3. **Convert EPUB to PDF:**
   ```bash
   docker run --rm \
     -v $(pwd)/input:/app/input \
     -v $(pwd)/output:/app/output \
     epub-to-pdf-converter input/your-book.epub output/your-book.pdf
   ```

### Using Docker Compose

1. **Convert with Docker Compose:**
   ```bash
   docker-compose run --rm epub-to-pdf-converter input/your-book.epub output/your-book.pdf
   ```

2. **For development:**
   ```bash
   docker-compose --profile dev up -d epub-to-pdf-dev
   ```

## Manual Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd epub-to-pdf
   ```

2. **Build the project:**
   ```bash
   mvn clean package
   ```

3. **Run the application:**
   ```bash
   java -jar target/epub-to-pdf-converter-1.0.0.jar input.epub output.pdf
   ```

## Usage

### Command Line
```bash
java -jar epub-to-pdf-converter.jar <input.epub> <output.pdf>
```

### Docker
```bash
docker run --rm \
  -v /path/to/input:/app/input \
  -v /path/to/output:/app/output \
  epub-to-pdf-converter input/book.epub output/book.pdf
```

### Arguments
- `<input.epub>`: Path to the input EPUB file
- `<output.pdf>`: Path where the PDF should be saved

### Options
- `--help`, `-h`: Show help message

## Examples

### Basic conversion
```bash
java -jar epub-to-pdf-converter.jar book.epub book.pdf
```

### With full paths
```bash
java -jar epub-to-pdf-converter.jar /path/to/book.epub /path/to/output.pdf
```

### Docker example
```bash
docker run --rm \
  -v $(pwd)/books:/app/input \
  -v $(pwd)/pdfs:/app/output \
  epub-to-pdf-converter input/novel.epub output/novel.pdf
```

## Project Structure

```
epub-to-pdf/
├── src/main/java/com/epubtopdf/
│   ├── EpubToPdfConverter.java    # Main application class
│   ├── EpubReader.java            # EPUB parsing logic
│   └── PdfCreator.java            # PDF generation logic
├── input/                         # Input EPUB files
├── output/                        # Output PDF files
├── Dockerfile                     # Docker configuration
├── docker-compose.yml             # Docker Compose configuration
├── pom.xml                        # Maven dependencies
└── README.md                      # This file
```

## Dependencies

- **Apache PDFBox 2.0.29**: PDF creation and manipulation
- **epublib-core 3.1**: EPUB file parsing
- **JSoup 1.15.3**: HTML parsing and text extraction
- **Apache Commons Lang 3.12.0**: Utility functions
- **SLF4J 1.7.36**: Logging framework

## Supported EPUB Features

- ✅ Basic text content
- ✅ Chapter structure
- ✅ Book metadata (title, author)
- ✅ HTML text extraction
- ✅ Paragraph breaks
- ⚠️ Limited formatting (basic text only)
- ❌ Images (not supported yet)
- ❌ Complex styling (CSS)
- ❌ Interactive elements

## Limitations

- Only supports reflowable EPUB files
- Images are not converted
- Complex CSS styling is not preserved
- Fixed-layout EPUBs are not supported
- Only basic text formatting is maintained

## Troubleshooting

### Common Issues

1. **"Input file does not exist"**
   - Check that the file path is correct
   - Ensure the file has `.epub` extension

2. **"No readable content found"**
   - The EPUB file might be corrupted
   - Try with a different EPUB file

3. **Docker permission issues**
   - Make sure the input/output directories are readable/writable
   - Check file permissions

### Logging

The application uses SLF4J for logging. To enable debug logging:

```bash
java -Dorg.slf4j.simpleLogger.defaultLogLevel=DEBUG \
  -jar epub-to-pdf-converter.jar input.epub output.pdf
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. 