package com.epubtopdf;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Handles reading and parsing of EPUB files using Java's built-in ZIP handling
 */
public class EpubReader {
    private static final Logger logger = LoggerFactory.getLogger(EpubReader.class);
    
    /**
     * Represents a chapter or section in the EPUB
     */
    public static class Chapter {
        private String title;
        private String content;
        private String htmlContent;
        
        public Chapter(String title, String content, String htmlContent) {
            this.title = title;
            this.content = content;
            this.htmlContent = htmlContent;
        }
        
        public String getTitle() {
            return title;
        }
        
        public String getContent() {
            return content;
        }
        
        public String getHtmlContent() {
            return htmlContent;
        }
    }
    
    /**
     * Represents the metadata of an EPUB file
     */
    public static class EpubMetadata {
        private String title;
        private String author;
        private String language;
        private String publisher;
        private String description;
        
        public EpubMetadata(String title, String author, String language, String publisher, String description) {
            this.title = title;
            this.author = author;
            this.language = language;
            this.publisher = publisher;
            this.description = description;
        }
        
        // Getters
        public String getTitle() { return title; }
        public String getAuthor() { return author; }
        public String getLanguage() { return language; }
        public String getPublisher() { return publisher; }
        public String getDescription() { return description; }
    }
    
    /**
     * Represents the complete EPUB book
     */
    public static class EpubBook {
        private EpubMetadata metadata;
        private List<Chapter> chapters;
        private Map<String, String> cssFiles;
        private Map<String, byte[]> images;
        
        public EpubBook(EpubMetadata metadata, List<Chapter> chapters, Map<String, String> cssFiles, Map<String, byte[]> images) {
            this.metadata = metadata;
            this.chapters = chapters;
            this.cssFiles = cssFiles;
            this.images = images;
        }
        
        public EpubMetadata getMetadata() { return metadata; }
        public List<Chapter> getChapters() { return chapters; }
        public Map<String, String> getCssFiles() { return cssFiles; }
        public Map<String, byte[]> getImages() { return images; }
    }
    
    /**
     * Reads an EPUB file and returns its content
     */
    public EpubBook readEpub(String epubPath) throws IOException {
        System.out.println("DEBUG: readEpub called with path: " + epubPath);
        logger.info("Starting readEpub for path: {}", epubPath);
        
        try (ZipFile zipFile = new ZipFile(epubPath)) {
            System.out.println("DEBUG: ZipFile created successfully");
            logger.info("ZipFile created successfully");
            
            // Find the OPF file (contains metadata and manifest)
            String opfPath = findOpfFile(zipFile);
            System.out.println("DEBUG: Found OPF path: " + opfPath);
            logger.info("Found OPF path: {}", opfPath);
            
            if (opfPath == null) {
                throw new IOException("Could not find OPF file in EPUB");
            }
            
            // Parse the OPF file
            System.out.println("DEBUG: Getting OPF entry from zip...");
            logger.info("Getting OPF entry from zip...");
            ZipEntry opfEntry = zipFile.getEntry(opfPath);
            System.out.println("DEBUG: OPF entry found: " + (opfEntry != null));
            logger.info("OPF entry found: {}", opfEntry != null);
            
            System.out.println("DEBUG: Parsing OPF document...");
            logger.info("Parsing OPF document...");
            Document opfDoc = parseXmlFromZip(zipFile, opfEntry);
            System.out.println("DEBUG: OPF document parsed successfully");
            logger.info("OPF document parsed successfully");
            
            // Extract metadata
            System.out.println("DEBUG: Extracting metadata...");
            logger.info("Extracting metadata...");
            EpubMetadata metadata = extractMetadata(opfDoc);
            System.out.println("DEBUG: Metadata extracted - title: " + metadata.getTitle());
            logger.info("Metadata extracted - title: {}", metadata.getTitle());
            
            // Extract chapters
            System.out.println("DEBUG: Extracting chapters...");
            logger.info("Extracting chapters...");
            List<Chapter> chapters = extractChapters(zipFile, opfDoc, opfPath);
            System.out.println("DEBUG: Chapters extracted: " + chapters.size());
            logger.info("Chapters extracted: {}", chapters.size());
            
            // Extract CSS files
            System.out.println("DEBUG: Extracting CSS files...");
            logger.info("Extracting CSS files...");
            Map<String, String> cssFiles = extractCssFiles(zipFile, opfDoc, opfPath);
            System.out.println("DEBUG: CSS files extracted: " + cssFiles.size());
            logger.info("CSS files extracted: {}", cssFiles.size());
            
            // Extract images
            System.out.println("DEBUG: Extracting images...");
            logger.info("Extracting images...");
            Map<String, byte[]> images = extractImages(zipFile, opfDoc, opfPath);
            System.out.println("DEBUG: Images extracted: " + images.size());
            logger.info("Images extracted: {}", images.size());
            
            System.out.println("DEBUG: Creating EpubBook - metadata: " + metadata.getTitle() + ", chapters: " + chapters.size() + ", cssFiles: " + cssFiles.size() + ", images: " + images.size());
            logger.info("Creating EpubBook - metadata: {}, chapters: {}, cssFiles: {}, images: {}", 
                       metadata.getTitle(), chapters.size(), cssFiles.size(), images.size());
            
            return new EpubBook(metadata, chapters, cssFiles, images);
        }
    }
    
    /**
     * Finds the OPF file in the EPUB
     */
    private String findOpfFile(ZipFile zipFile) throws IOException {
        System.out.println("DEBUG: findOpfFile called");
        
        // First, try to find the container.xml file
        ZipEntry containerEntry = zipFile.getEntry("META-INF/container.xml");
        if (containerEntry != null) {
            System.out.println("DEBUG: Found container.xml");
            try {
                Document doc = parseXmlFromZip(zipFile, containerEntry);
                NodeList rootFileNodes = doc.getElementsByTagName("rootfile");
                
                System.out.println("DEBUG: Found " + rootFileNodes.getLength() + " rootfile elements");
                
                for (int i = 0; i < rootFileNodes.getLength(); i++) {
                    Element rootFileElement = (Element) rootFileNodes.item(i);
                    String mediaType = rootFileElement.getAttribute("media-type");
                    System.out.println("DEBUG: Rootfile " + i + " media-type: " + mediaType);
                    
                    if ("application/oebps-package+xml".equals(mediaType)) {
                        String fullPath = rootFileElement.getAttribute("full-path");
                        System.out.println("DEBUG: Found OPF file path: " + fullPath);
                        return fullPath;
                    }
                }
            } catch (Exception e) {
                System.out.println("DEBUG: Error parsing container.xml: " + e.getMessage());
                logger.error("Error parsing container.xml", e);
            }
        } else {
            System.out.println("DEBUG: container.xml not found");
        }
        
        // If not found, try common locations
        String[] commonLocations = {
            "OEBPS/content.opf",
            "OPS/content.opf",
            "content.opf"
        };
        
        System.out.println("DEBUG: Trying common locations...");
        for (String location : commonLocations) {
            System.out.println("DEBUG: Checking location: " + location);
            if (zipFile.getEntry(location) != null) {
                System.out.println("DEBUG: Found OPF at: " + location);
                return location;
            }
        }
        
        System.out.println("DEBUG: No OPF file found");
        return null;
    }
    
    /**
     * Parses XML from a ZIP entry
     */
    private Document parseXmlFromZip(ZipFile zipFile, ZipEntry entry) throws IOException {
        try (InputStream inputStream = zipFile.getInputStream(entry)) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(inputStream);
        } catch (Exception e) {
            throw new IOException("Error parsing XML from ZIP entry: " + entry.getName(), e);
        }
    }
    
    /**
     * Extracts metadata from the OPF document
     */
    private EpubMetadata extractMetadata(Document opfDoc) {
        Element rootElement = opfDoc.getDocumentElement();
        NodeList metadataNodes = rootElement.getElementsByTagName("metadata");
        
        String title = "";
        String author = "";
        String language = "";
        String publisher = "";
        String description = "";
        
        if (metadataNodes.getLength() > 0) {
            Element metadata = (Element) metadataNodes.item(0);
            
            NodeList titleElements = metadata.getElementsByTagName("title");
            if (titleElements.getLength() > 0) {
                title = titleElements.item(0).getTextContent();
            }
            
            NodeList creatorElements = metadata.getElementsByTagName("creator");
            if (creatorElements.getLength() > 0) {
                author = creatorElements.item(0).getTextContent();
            }
            
            NodeList languageElements = metadata.getElementsByTagName("language");
            if (languageElements.getLength() > 0) {
                language = languageElements.item(0).getTextContent();
            }
            
            NodeList publisherElements = metadata.getElementsByTagName("publisher");
            if (publisherElements.getLength() > 0) {
                publisher = publisherElements.item(0).getTextContent();
            }
            
            NodeList descriptionElements = metadata.getElementsByTagName("description");
            if (descriptionElements.getLength() > 0) {
                description = descriptionElements.item(0).getTextContent();
            }
        }
        
        return new EpubMetadata(title, author, language, publisher, description);
    }
    
    /**
     * Extracts chapters from the EPUB
     */
    private List<Chapter> extractChapters(ZipFile zipFile, Document opfDoc, String opfPath) throws IOException {
        List<Chapter> chapters = new ArrayList<>();
        
        // Get the base path for relative references
        String basePath = "";
        int lastSlash = opfPath.lastIndexOf('/');
        if (lastSlash != -1) {
            basePath = opfPath.substring(0, lastSlash + 1);
        }
        
        Element rootElement = opfDoc.getDocumentElement();
        NodeList spineNodes = rootElement.getElementsByTagName("spine");
        NodeList manifestNodes = rootElement.getElementsByTagName("manifest");
        
        if (spineNodes.getLength() > 0 && manifestNodes.getLength() > 0) {
            Element spine = (Element) spineNodes.item(0);
            Element manifest = (Element) manifestNodes.item(0);
            
            NodeList itemrefs = spine.getElementsByTagName("itemref");
            
            for (int i = 0; i < itemrefs.getLength(); i++) {
                Element itemref = (Element) itemrefs.item(i);
                String idref = itemref.getAttribute("idref");
                
                // Find the corresponding item in manifest
                NodeList items = manifest.getElementsByTagName("item");
                for (int j = 0; j < items.getLength(); j++) {
                    Element item = (Element) items.item(j);
                    if (idref.equals(item.getAttribute("id"))) {
                        String href = item.getAttribute("href");
                        String mediaType = item.getAttribute("media-type");
                        
                        // Only process XHTML files
                        if (mediaType != null && mediaType.contains("xhtml")) {
                            String fullPath = basePath + href;
                            ZipEntry entry = zipFile.getEntry(fullPath);
                            
                            if (entry != null) {
                                String htmlContent = readTextFromZipEntry(zipFile, entry);
                                Chapter chapter = parseChapter(htmlContent, href);
                                if (chapter != null) {
                                    chapters.add(chapter);
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        return chapters;
    }
    
    /**
     * Extracts CSS files from the EPUB
     */
    private Map<String, String> extractCssFiles(ZipFile zipFile, Document opfDoc, String opfPath) {
        System.out.println("DEBUG: extractCssFiles called");
        Map<String, String> cssFiles = new HashMap<>();
        
        try {
            // Get the base directory of the OPF file
            String baseDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
            System.out.println("DEBUG: Base directory: " + baseDir);
            
            // Get all manifest items
            NodeList manifestItems = opfDoc.getElementsByTagName("item");
            System.out.println("DEBUG: Found " + manifestItems.getLength() + " manifest items");
            
            for (int i = 0; i < manifestItems.getLength(); i++) {
                Element item = (Element) manifestItems.item(i);
                String mediaType = item.getAttribute("media-type");
                System.out.println("DEBUG: Processing item " + i + " with media-type: " + mediaType);
                
                if ("text/css".equals(mediaType)) {
                    String href = item.getAttribute("href");
                    System.out.println("DEBUG: Found CSS file: " + href);
                    
                    // Build the full path
                    String fullPath = baseDir + href;
                    System.out.println("DEBUG: Full path: " + fullPath);
                    
                    // Get the entry from the zip
                    ZipEntry entry = zipFile.getEntry(fullPath);
                    if (entry != null) {
                        System.out.println("DEBUG: CSS entry found in zip");
                        try (InputStream is = zipFile.getInputStream(entry)) {
                            String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                            cssFiles.put(href, content);
                            System.out.println("DEBUG: CSS file extracted: " + href + " (" + content.length() + " bytes)");
                        }
                    } else {
                        System.out.println("DEBUG: CSS entry not found in zip: " + fullPath);
                    }
                }
            }
            
            System.out.println("DEBUG: Total CSS files extracted: " + cssFiles.size());
            logger.info("Extracted {} CSS files", cssFiles.size());
        } catch (Exception e) {
            System.out.println("DEBUG: Error extracting CSS files: " + e.getMessage());
            logger.error("Error extracting CSS files", e);
        }
        
        return cssFiles;
    }
    
    /**
     * Extracts images from the EPUB
     */
    private Map<String, byte[]> extractImages(ZipFile zipFile, Document opfDoc, String opfPath) {
        System.out.println("DEBUG: extractImages called");
        Map<String, byte[]> images = new HashMap<>();
        
        try {
            // Get the base directory of the OPF file
            String baseDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
            System.out.println("DEBUG: Base directory for images: " + baseDir);
            
            // Get all manifest items
            NodeList manifestItems = opfDoc.getElementsByTagName("item");
            System.out.println("DEBUG: Found " + manifestItems.getLength() + " manifest items for images");
            
            for (int i = 0; i < manifestItems.getLength(); i++) {
                Element item = (Element) manifestItems.item(i);
                String mediaType = item.getAttribute("media-type");
                System.out.println("DEBUG: Processing item " + i + " with media-type: " + mediaType);
                
                if (mediaType.startsWith("image/")) {
                    String href = item.getAttribute("href");
                    System.out.println("DEBUG: Found image file: " + href);
                    
                    // Build the full path
                    String fullPath = baseDir + href;
                    System.out.println("DEBUG: Full path for image: " + fullPath);
                    
                    // Get the entry from the zip
                    ZipEntry entry = zipFile.getEntry(fullPath);
                    if (entry != null) {
                        System.out.println("DEBUG: Image entry found in zip");
                        try (InputStream is = zipFile.getInputStream(entry)) {
                            byte[] content = is.readAllBytes();
                            images.put(href, content);
                            System.out.println("DEBUG: Image file extracted: " + href + " (" + content.length + " bytes)");
                        }
                    } else {
                        System.out.println("DEBUG: Image entry not found in zip: " + fullPath);
                    }
                }
            }
            
            System.out.println("DEBUG: Total images extracted: " + images.size());
            logger.info("Extracted {} images", images.size());
        } catch (Exception e) {
            System.out.println("DEBUG: Error extracting images: " + e.getMessage());
            logger.error("Error extracting images", e);
        }
        
        return images;
    }
    
    /**
     * Reads binary content from a ZIP entry
     */
    private byte[] readBinaryFromZipEntry(ZipFile zipFile, ZipEntry entry) throws IOException {
        try (InputStream inputStream = zipFile.getInputStream(entry)) {
            return inputStream.readAllBytes();
        }
    }
    
    /**
     * Reads text content from a ZIP entry
     */
    private String readTextFromZipEntry(ZipFile zipFile, ZipEntry entry) throws IOException {
        try (InputStream inputStream = zipFile.getInputStream(entry)) {
            byte[] buffer = new byte[1024];
            StringBuilder content = new StringBuilder();
            int bytesRead;
            
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                content.append(new String(buffer, 0, bytesRead, "UTF-8"));
            }
            
            return content.toString();
        }
    }
    
    /**
     * Parses a chapter from HTML content
     */
    private Chapter parseChapter(String htmlContent, String filename) {
        try {
            org.jsoup.nodes.Document doc = org.jsoup.Jsoup.parse(htmlContent);
            
            // Extract title from h1, h2, or title tag
            String title = filename; // Default to filename
            
            org.jsoup.nodes.Element titleElement = doc.selectFirst("h1, h2, h3, title");
            if (titleElement != null) {
                title = titleElement.text();
            }
            
            // Extract text content
            String textContent = doc.body() != null ? doc.body().text() : doc.text();
            
            return new Chapter(title, textContent, htmlContent);
        } catch (Exception e) {
            logger.error("Error parsing chapter from HTML", e);
            return null;
        }
    }
} 