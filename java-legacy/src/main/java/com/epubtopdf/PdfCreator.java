package com.epubtopdf;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Map;

/**
 * Handles PDF creation from EPUB content using OpenHTML to PDF
 */
public class PdfCreator {
    private static final Logger logger = LoggerFactory.getLogger(PdfCreator.class);
    
    /**
     * Creates a PDF from an EPUB book
     */
    public void createPdf(EpubReader.EpubBook epubBook, String outputPath) throws IOException {
        logger.info("Creating PDF from EPUB book");
        
        // Build the HTML document
        String htmlContent = buildHtmlDocument(epubBook);
        
        // Save debug HTML for inspection
        saveDebugHtml(htmlContent, outputPath);
        
        // Create PDF using openhtmltopdf
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(htmlContent, null);
            builder.toStream(os);
            
            // Add font from system resources
            try (InputStream fontStream = getClass().getResourceAsStream("/fonts/DejaVuSans.ttf")) {
                if (fontStream != null) {
                    builder.useFont(() -> fontStream, "DejaVu Sans");
                }
            } catch (Exception e) {
                logger.warn("Could not load font", e);
            }
            
            builder.run();
            
            // Write the PDF to file
            Path outputFile = Paths.get(outputPath);
            Files.write(outputFile, os.toByteArray());
            
            logger.info("PDF created successfully: {}", outputPath);
            
        } catch (Exception e) {
            logger.error("Error creating PDF", e);
            throw new IOException("Failed to create PDF", e);
        }
    }
    
    private void saveDebugHtml(String htmlContent, String outputPath) {
        try {
            // Create debug directory
            Path debugDir = Paths.get("debug");
            if (!Files.exists(debugDir)) {
                Files.createDirectories(debugDir);
            }
            
            // Save the generated HTML
            String filename = Paths.get(outputPath).getFileName().toString().replace(".pdf", "_generated.html");
            Path htmlFile = debugDir.resolve(filename);
            
            Files.write(htmlFile, htmlContent.getBytes());
            logger.info("Debug: Saved generated HTML to: {}", htmlFile.toAbsolutePath());
            
        } catch (IOException e) {
            logger.error("Error saving debug HTML", e);
        }
    }
    
    /**
     * Builds a complete HTML document from EPUB chapters
     */
    private String buildHtmlDocument(EpubReader.EpubBook epubBook) {
        StringBuilder html = new StringBuilder();
        
        // Start HTML document with XHTML compliance
        html.append("<!DOCTYPE html>\n");
        html.append("<html>\n");
        html.append("<head>\n");
        html.append("<meta charset=\"UTF-8\"/>\n");
        html.append("<title>").append(escapeHtml(epubBook.getMetadata().getTitle())).append("</title>\n");
        
        // Add original CSS files from EPUB
        html.append("<style>\n");
        html.append(getBaseCSS()); // Base CSS for PDF compatibility
        html.append("</style>\n");
        
        // Add original EPUB CSS files
        Map<String, String> cssFiles = epubBook.getCssFiles();
        logger.info("Adding {} CSS files to HTML", cssFiles.size());
        for (Map.Entry<String, String> cssEntry : cssFiles.entrySet()) {
            html.append("<style>\n");
            html.append("/* CSS from: ").append(cssEntry.getKey()).append(" */\n");
            html.append(cssEntry.getValue()).append("\n");
            html.append("</style>\n");
            logger.info("Added CSS file: {} (size: {} chars)", cssEntry.getKey(), cssEntry.getValue().length());
        }
        
        html.append("</head>\n");
        html.append("<body>\n");
        
        // Add title page
        html.append(buildTitlePage(epubBook));
        
        // Add chapters
        html.append(buildChapters(epubBook));
        
        html.append("</body>\n");
        html.append("</html>\n");
        
        return html.toString();
    }
    
    /**
     * Builds the title page HTML
     */
    private String buildTitlePage(EpubReader.EpubBook epubBook) {
        StringBuilder titlePage = new StringBuilder();
        
        titlePage.append("<div class=\"title-page\">\n");
        titlePage.append("<h1 class=\"book-title\">").append(escapeHtml(epubBook.getMetadata().getTitle())).append("</h1>\n");
        titlePage.append("<h2 class=\"book-author\">").append(escapeHtml(epubBook.getMetadata().getAuthor())).append("</h2>\n");
        
        // Add other metadata if available
        if (epubBook.getMetadata().getPublisher() != null && !epubBook.getMetadata().getPublisher().trim().isEmpty()) {
            titlePage.append("<p class=\"book-publisher\">").append(escapeHtml(epubBook.getMetadata().getPublisher())).append("</p>\n");
        }
        
        titlePage.append("</div>\n");
        titlePage.append("<div class=\"page-break\"></div>\n"); // Force page break after title
        
        return titlePage.toString();
    }
    
    /**
     * Builds the chapters HTML
     */
    private String buildChapters(EpubReader.EpubBook epubBook) {
        StringBuilder chapters = new StringBuilder();
        
        for (EpubReader.Chapter chapter : epubBook.getChapters()) {
            chapters.append("<div class=\"chapter\">\n");
            
            // Add chapter title
            chapters.append("<h2 class=\"chapter-title\">").append(escapeHtml(chapter.getTitle())).append("</h2>\n");
            
            // Add chapter content - use HTML content instead of raw text
            String chapterHtml = chapter.getHtmlContent();
            if (chapterHtml != null && !chapterHtml.trim().isEmpty()) {
                // Extract body content and embed images
                String bodyContent = extractBodyContent(chapterHtml, epubBook.getImages());
                chapters.append(bodyContent);
            } else {
                // Fallback to text content if HTML is not available
                chapters.append("<p>").append(escapeHtml(chapter.getContent())).append("</p>\n");
            }
            
            chapters.append("</div>\n");
        }
        
        return chapters.toString();
    }
    
    /**
     * Extracts content from HTML body, handling various EPUB HTML structures and embedding images
     */
    private String extractBodyContent(String htmlContent, Map<String, byte[]> images) {
        if (htmlContent == null || htmlContent.trim().isEmpty()) {
            return "";
        }
        
        // Use JSoup to parse and extract body content
        try {
            org.jsoup.nodes.Document doc = org.jsoup.Jsoup.parse(htmlContent);
            doc.outputSettings().syntax(org.jsoup.nodes.Document.OutputSettings.Syntax.xml);
            doc.outputSettings().escapeMode(org.jsoup.nodes.Entities.EscapeMode.xhtml);
            org.jsoup.nodes.Element body = doc.body();
            
            String result;
            if (body != null) {
                // Process images and convert to data URIs
                embedImages(body, images);
                result = body.html();
            } else {
                // If no body tag, parse the entire content and process images
                embedImages(doc, images);
                result = doc.html();
            }
            
            // Ensure XHTML compliance
            return ensureXhtmlCompliance(result);
        } catch (Exception e) {
            logger.warn("Error parsing HTML content, using raw content", e);
            return ensureXhtmlCompliance(htmlContent);
        }
    }
    
    /**
     * Ensures XHTML compliance by fixing self-closing tags and other issues
     */
    private String ensureXhtmlCompliance(String htmlContent) {
        if (htmlContent == null || htmlContent.trim().isEmpty()) {
            return htmlContent;
        }
        
        // Fix self-closing tags to be XHTML compliant
        String result = htmlContent;
        
        // Fix common self-closing tags - handle both empty tags and tags with attributes
        // Use simpler approach: just add / before > if it's not already there
        result = result.replaceAll("<(meta[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(img[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(br[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(hr[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(input[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(area[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(base[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(col[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(embed[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(link[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(param[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(source[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(track[^>]*[^/])>", "<$1/>");
        result = result.replaceAll("<(wbr[^>]*[^/])>", "<$1/>");
        
        // Handle special case of tags with no attributes
        result = result.replaceAll("<(meta|img|br|hr|input|area|base|col|embed|link|param|source|track|wbr)>", "<$1/>");
        
        // Fix any malformed table structures by ensuring proper closing
        result = fixMalformedTables(result);
        
        // Remove any standalone closing tags that shouldn't exist
        result = result.replaceAll("</meta>", "");
        result = result.replaceAll("</img>", "");
        result = result.replaceAll("</br>", "");
        result = result.replaceAll("</hr>", "");
        result = result.replaceAll("</input>", "");
        result = result.replaceAll("</area>", "");
        result = result.replaceAll("</base>", "");
        result = result.replaceAll("</col>", "");
        result = result.replaceAll("</embed>", "");
        result = result.replaceAll("</link>", "");
        result = result.replaceAll("</param>", "");
        result = result.replaceAll("</source>", "");
        result = result.replaceAll("</track>", "");
        result = result.replaceAll("</wbr>", "");
        
        // Fix HTML entities to be XHTML compliant (convert to numeric entities)
        result = result.replaceAll("&nbsp;", "&#160;");
        result = result.replaceAll("&amp;", "&#38;");
        result = result.replaceAll("&lt;", "&#60;");
        result = result.replaceAll("&gt;", "&#62;");
        result = result.replaceAll("&quot;", "&#34;");
        result = result.replaceAll("&apos;", "&#39;");
        result = result.replaceAll("&copy;", "&#169;");
        result = result.replaceAll("&reg;", "&#174;");
        result = result.replaceAll("&trade;", "&#8482;");
        result = result.replaceAll("&mdash;", "&#8212;");
        result = result.replaceAll("&ndash;", "&#8211;");
        result = result.replaceAll("&ldquo;", "&#8220;");
        result = result.replaceAll("&rdquo;", "&#8221;");
        result = result.replaceAll("&lsquo;", "&#8216;");
        result = result.replaceAll("&rsquo;", "&#8217;");
        result = result.replaceAll("&hellip;", "&#8230;");
        
        return result;
    }
    
    /**
     * Fixes malformed table structures that might cause XHTML parsing issues
     */
    private String fixMalformedTables(String htmlContent) {
        if (htmlContent == null || htmlContent.trim().isEmpty()) {
            return htmlContent;
        }
        
        // Use JSoup to parse and fix table structure
        try {
            org.jsoup.nodes.Document tempDoc = org.jsoup.Jsoup.parse(htmlContent);
            tempDoc.outputSettings().syntax(org.jsoup.nodes.Document.OutputSettings.Syntax.xml);
            tempDoc.outputSettings().escapeMode(org.jsoup.nodes.Entities.EscapeMode.xhtml);
            
            // JSoup will automatically fix malformed HTML structure
            return tempDoc.html();
        } catch (Exception e) {
            logger.warn("Failed to fix malformed tables, using original content", e);
            return htmlContent;
        }
    }
    
    /**
     * Embeds images as data URIs in the HTML content and applies size constraints
     */
    private void embedImages(org.jsoup.nodes.Element element, Map<String, byte[]> images) {
        org.jsoup.select.Elements imgElements = element.select("img");
        
        for (org.jsoup.nodes.Element img : imgElements) {
            String src = img.attr("src");
            if (src != null && !src.isEmpty()) {
                // Handle relative paths
                String imagePath = src;
                if (imagePath.startsWith("../")) {
                    imagePath = imagePath.substring(3); // Remove ../
                }
                
                // Look for the image in our extracted images
                byte[] imageData = images.get(imagePath);
                if (imageData != null) {
                    // Convert to data URI
                    String mimeType = getMimeType(imagePath);
                    String base64Data = Base64.getEncoder().encodeToString(imageData);
                    String dataUri = "data:" + mimeType + ";base64," + base64Data;
                    
                    img.attr("src", dataUri);
                    logger.info("Embedded image: {}", imagePath);
                } else {
                    logger.warn("Image not found in extracted images: {}", imagePath);
                }
            }
            
            // Apply size constraints based on CSS classes to fix PDF rendering issues
            applyImageSizeConstraints(img);
        }
    }
    
    /**
     * Applies size constraints to images based on their CSS classes and context
     * This ensures proper image sizing in PDF output that matches EPUB reader rendering
     */
    private void applyImageSizeConstraints(org.jsoup.nodes.Element img) {
        String cssClass = img.attr("class");
        String existingStyle = img.attr("style");
        
        // Check if the image itself has the twoheader-icon-para-img class
        if (cssClass != null && cssClass.contains("twoheader-icon-para-img")) {
            // Apply max-width constraint for advisor images
            String newStyle = "max-width: 100px; height: auto;";
            if (existingStyle != null && !existingStyle.trim().isEmpty()) {
                newStyle = existingStyle + "; " + newStyle;
            }
            img.attr("style", newStyle);
            logger.info("Applied size constraint to image with class: {}", cssClass);
        }
        
        // Check if the image is near a twoheader-icon-para-img element (sibling or child context)
        org.jsoup.nodes.Element parent = img.parent();
        if (parent != null) {
            // Check if parent has the class
            if (parent.hasClass("twoheader-icon-para-img")) {
                applyImageSizeConstraint(img, existingStyle, "parent element");
            } else {
                // Check if there's a sibling with the class
                org.jsoup.select.Elements siblings = parent.siblingElements();
                for (org.jsoup.nodes.Element sibling : siblings) {
                    if (sibling.hasClass("twoheader-icon-para-img")) {
                        applyImageSizeConstraint(img, existingStyle, "sibling element");
                        break;
                    }
                }
            }
        }
        
        // Add more size constraints here as needed for other image types
        // Example: if (cssClass != null && cssClass.contains("cover-image")) {
        //     // Apply constraints for cover images
        // }
    }
    
    /**
     * Helper method to apply the size constraint to an image
     */
    private void applyImageSizeConstraint(org.jsoup.nodes.Element img, String existingStyle, String context) {
        String newStyle = "max-width: 100px; height: auto;";
        if (existingStyle != null && !existingStyle.trim().isEmpty()) {
            newStyle = existingStyle + "; " + newStyle;
        }
        img.attr("style", newStyle);
        logger.info("Applied size constraint to image based on {}: max-width: 100px", context);
    }
    
    /**
     * Determines MIME type based on file extension
     */
    private String getMimeType(String filename) {
        String extension = filename.toLowerCase();
        if (extension.endsWith(".jpg") || extension.endsWith(".jpeg")) {
            return "image/jpeg";
        } else if (extension.endsWith(".png")) {
            return "image/png";
        } else if (extension.endsWith(".gif")) {
            return "image/gif";
        } else if (extension.endsWith(".svg")) {
            return "image/svg+xml";
        } else if (extension.endsWith(".bmp")) {
            return "image/bmp";
        } else {
            return "image/jpeg"; // Default fallback
        }
    }
    
    /**
     * Escapes HTML special characters
     */
    private String escapeHtml(String text) {
        if (text == null) {
            return "";
        }
        
        return text.replace("&", "&amp;")
                  .replace("<", "&lt;")
                  .replace(">", "&gt;")
                  .replace("\"", "&quot;")
                  .replace("'", "&#39;");
    }
    
    /**
     * Returns minimal base CSS for PDF compatibility
     */
    private String getBaseCSS() {
        return "@page {\n" +
            "    size: A4;\n" +
            "    margin: 2cm;\n" +
            "}\n" +
            "\n" +
            "body {\n" +
            "    margin: 0;\n" +
            "    padding: 0;\n" +
            "}\n" +
            "\n" +
            ".title-page {\n" +
            "    text-align: center;\n" +
            "    padding-top: 25%;\n" +
            "}\n" +
            "\n" +
            ".book-title {\n" +
            "    font-size: 24pt;\n" +
            "    font-weight: bold;\n" +
            "    margin-bottom: 1em;\n" +
            "}\n" +
            "\n" +
            ".book-author {\n" +
            "    font-size: 18pt;\n" +
            "    font-weight: normal;\n" +
            "    margin-bottom: 2em;\n" +
            "}\n" +
            "\n" +
            ".book-publisher {\n" +
            "    font-size: 14pt;\n" +
            "}\n" +
            "\n" +
            ".page-break {\n" +
            "    page-break-after: always;\n" +
            "}\n" +
            "\n" +
            ".chapter {\n" +
            "    margin-bottom: 2em;\n" +
            "}\n" +
            "\n" +
            ".chapter-title {\n" +
            "    font-size: 18pt;\n" +
            "    font-weight: bold;\n" +
            "    margin-top: 2em;\n" +
            "    margin-bottom: 1em;\n" +
            "    page-break-after: avoid;\n" +
            "}\n" +
            "\n" +
            "img {\n" +
            "    max-width: 100%;\n" +
            "    height: auto;\n" +
            "}\n" +
            "\n" +
            "/* Ensure page breaks work properly */\n" +
            "h1, h2, h3, h4, h5, h6 {\n" +
            "    page-break-after: avoid;\n" +
            "}\n";
    }
} 