import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called');
    
    const formData = await request.formData();
    console.log('FormData received');
    
    const epubFile = formData.get('epub') as File;
    
    if (!epubFile) {
      console.log('No EPUB file provided');
      return NextResponse.json({ error: 'No EPUB file provided' }, { status: 400 });
    }

    console.log('EPUB file received:', epubFile.name, epubFile.size);

    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp');
    console.log('Temp directory:', tempDir);
    
    if (!fs.existsSync(tempDir)) {
      console.log('Creating temp directory');
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save uploaded file
    const fileName = epubFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const epubPath = path.join(tempDir, fileName);
    console.log('Saving file to:', epubPath);
    
    const arrayBuffer = await epubFile.arrayBuffer();
    fs.writeFileSync(epubPath, Buffer.from(arrayBuffer));
    console.log('File saved successfully');

    // Extract EPUB using AdmZip
    const extractDir = path.join(tempDir, fileName.replace('.epub', ''));
    console.log('Extract directory:', extractDir);
    
    if (fs.existsSync(extractDir)) {
      console.log('Removing existing extract directory');
      fs.rmSync(extractDir, { recursive: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    console.log('Extract directory created');

    try {
      console.log('Attempting to extract with AdmZip');
      const zip = new AdmZip(epubPath);
      zip.extractAllTo(extractDir, true);
      console.log('Extraction with AdmZip successful');
    } catch (error) {
      console.error('AdmZip extraction failed:', error);
      return NextResponse.json({ error: 'Failed to extract EPUB' }, { status: 500 });
    }

    // Return success with book name
    const bookName = fileName.replace('.epub', '');
    console.log('Upload successful, book name:', bookName);
    
    return NextResponse.json({ 
      success: true, 
      bookName: bookName,
      message: 'EPUB uploaded and extracted successfully' 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed', details: error.message }, { status: 500 });
  }
} 