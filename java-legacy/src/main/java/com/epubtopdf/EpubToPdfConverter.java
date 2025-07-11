package com.epubtopdf;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Map;

/**
 * Main application class for converting EPUB files to PDF
 */
public class EpubToPdfConverter {
    private static final Logger logger = LoggerFactory.getLogger(EpubToPdfConverter.class);
    
    public static void main(String[] args) {
        if (args.length == 0 || args[0].equals("--help") || args[0].equals("-h")) {
            printUsage();
            return;
        }
        
        if (args.length < 2) {
            System.err.println("Error: Both input and output files are required.");
            printUsage();
            System.exit(1);
        }
        
        String inputPath = args[0];
        String outputPath = args[1];
        
        try {
            logger.info("Starting conversion: {} -> {}", inputPath, outputPath);
            
            // Read EPUB
            EpubReader epubReader = new EpubReader();
            logger.info("About to read EPUB file: {}", inputPath);
            EpubReader.EpubBook epubBook = epubReader.readEpub(inputPath);
            logger.info("EPUB read complete - Book: {}, Chapters: {}, CSS: {}, Images: {}", 
                epubBook.getMetadata().getTitle(), epubBook.getChapters().size(), 
                epubBook.getCssFiles().size(), epubBook.getImages().size());
            
            // Debug: Save extracted CSS files
            saveDebugCssFiles(epubBook);
            
            // Create PDF
            PdfCreator pdfCreator = new PdfCreator();
            pdfCreator.createPdf(epubBook, outputPath);
            
            logger.info("Conversion completed successfully");
            System.out.println("Conversion completed successfully!");
            System.out.println("Output file: " + outputPath);
            
        } catch (Exception e) {
            logger.error("Error during conversion", e);
            System.err.println("Error during conversion: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
    
    /**
     * Converts an EPUB file to PDF
     * @param inputPath Path to the input EPUB file
     * @param outputPath Path where the PDF should be saved
     * @throws IOException if there's an error during conversion
     */
    public static void convertEpubToPdf(String inputPath, String outputPath) throws IOException {
        // Validate input file
        File inputFile = new File(inputPath);
        if (!inputFile.exists()) {
            throw new IOException("Input file does not exist: " + inputPath);
        }
        
        if (!inputFile.isFile()) {
            throw new IOException("Input path is not a file: " + inputPath);
        }
        
        if (!inputPath.toLowerCase().endsWith(".epub")) {
            throw new IOException("Input file must be an EPUB file: " + inputPath);
        }
        
        // Validate output path
        File outputFile = new File(outputPath);
        File outputDir = outputFile.getParentFile();
        if (outputDir != null && !outputDir.exists()) {
            if (!outputDir.mkdirs()) {
                throw new IOException("Could not create output directory: " + outputDir.getPath());
            }
        }
        
        if (!outputPath.toLowerCase().endsWith(".pdf")) {
            throw new IOException("Output file must be a PDF file: " + outputPath);
        }
        
        logger.info("Starting conversion: {} -> {}", inputPath, outputPath);
        
        // Read the EPUB file
        EpubReader epubReader = new EpubReader();
        EpubReader.EpubBook epubBook = epubReader.readEpub(inputPath);
        
        // Validate that we have content
        if (epubBook.getChapters() == null || epubBook.getChapters().isEmpty()) {
            throw new IOException("No readable content found in EPUB file: " + inputPath);
        }
        
        // Create the PDF
        PdfCreator pdfCreator = new PdfCreator();
        pdfCreator.createPdf(epubBook, outputPath);
        
        logger.info("Conversion completed successfully");
    }
    
    private static void saveDebugCssFiles(EpubReader.EpubBook epubBook) {
        try {
            // Create debug directory
            File debugDir = new File("debug");
            if (!debugDir.exists()) {
                debugDir.mkdirs();
            }
            
            // Save CSS files
            Map<String, String> cssFiles = epubBook.getCssFiles();
            logger.info("Debug: Saving {} CSS files", cssFiles.size());
            
            for (Map.Entry<String, String> entry : cssFiles.entrySet()) {
                String filename = entry.getKey().replace("/", "_").replace("\\", "_");
                File cssFile = new File(debugDir, filename);
                
                try (FileWriter writer = new FileWriter(cssFile)) {
                    writer.write(entry.getValue());
                    logger.info("Debug: Saved CSS file: {}", cssFile.getPath());
                }
            }
            
            // Save image count info
            File imageInfoFile = new File(debugDir, "image_info.txt");
            try (FileWriter writer = new FileWriter(imageInfoFile)) {
                writer.write("Total images extracted: " + epubBook.getImages().size() + "\n\n");
                writer.write("Image files:\n");
                for (String imagePath : epubBook.getImages().keySet()) {
                    writer.write("- " + imagePath + "\n");
                }
            }
            
        } catch (IOException e) {
            logger.error("Error saving debug files", e);
        }
    }
    
    /**
     * Prints usage information
     */
    private static void printUsage() {
        System.out.println("EPUB to PDF Converter");
        System.out.println("====================");
        System.out.println();
        System.out.println("Usage: java -jar epub-to-pdf-converter.jar <input.epub> <output.pdf>");
        System.out.println();
        System.out.println("Arguments:");
        System.out.println("  <input.epub>   Path to the input EPUB file");
        System.out.println("  <output.pdf>   Path where the PDF should be saved");
        System.out.println();
        System.out.println("Options:");
        System.out.println("  --help, -h     Show this help message");
        System.out.println();
        System.out.println("Examples:");
        System.out.println("  java -jar epub-to-pdf-converter.jar book.epub book.pdf");
        System.out.println("  java -jar epub-to-pdf-converter.jar /path/to/book.epub /path/to/output.pdf");
        System.out.println();
        System.out.println("Docker usage:");
        System.out.println("  docker run -v $(pwd)/input:/app/input -v $(pwd)/output:/app/output \\");
        System.out.println("    epub-to-pdf-converter input/book.epub output/book.pdf");
        System.out.println();
        System.out.println("Docker Compose usage:");
        System.out.println("  docker-compose run --rm epub-to-pdf-converter input/book.epub output/book.pdf");
    }
} 