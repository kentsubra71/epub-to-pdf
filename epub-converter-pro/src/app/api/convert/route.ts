import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, rmSync, mkdirSync } from 'fs';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('epub') as File;
    const settings = formData.get('settings') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Parse settings
    const paginationSettings = settings ? JSON.parse(settings) : {
      enablePagination: true,
      pageBreakThreshold: 0.8,
      minContentHeight: 100
    };

    // Create temp directory
    const tempDir = join(process.cwd(), 'temp');
    await mkdir(tempDir, { recursive: true });

    // Save uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const inputPath = join(tempDir, fileName);
    await writeFile(inputPath, buffer);

    // Extract the book name for the viewer URL
    const bookName = fileName.replace('.epub', '');
    
    // Extract EPUB for the viewer
    const extractDir = join(tempDir, bookName);
    if (existsSync(extractDir)) {
      rmSync(extractDir, { recursive: true });
    }
    mkdirSync(extractDir, { recursive: true });
    
    try {
      console.log('Extracting EPUB for conversion...');
      const zip = new AdmZip(inputPath);
      zip.extractAllTo(extractDir, true);
      console.log('EPUB extraction successful');
    } catch (error) {
      console.error('EPUB extraction failed:', error);
      return NextResponse.json({ error: 'Failed to extract EPUB for conversion' }, { status: 500 });
    }

    // Generate output filename
    const outputName = fileName.replace('.epub', '.pdf');
    const outputPath = join(tempDir, outputName);
    
    // Build the viewer URL that will load the EPUB in the browser
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://your-production-domain.com' 
      : 'http://localhost:3000';
    const viewerUrl = `${baseUrl}/thorium-viewer.html?book=${bookName}&pdf=true`;
    
    // Run conversion using our existing script
    const convertScript = join(process.cwd(), '..', 'convert-playwright.js');
    
    const command = `node "${convertScript}" "${viewerUrl}" "${outputPath}" --pagination=${paginationSettings.enablePagination} --threshold=${paginationSettings.pageBreakThreshold} --minHeight=${paginationSettings.minContentHeight}`;
    
    console.log('Running conversion command:', command);
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('Conversion stderr:', stderr);
    }
    
    console.log('Conversion stdout:', stdout);

    // Check if output file exists
    if (!existsSync(outputPath)) {
      return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
    }

    // Read the generated PDF
    const { readFile } = await import('fs/promises');
    const pdfBuffer = await readFile(outputPath);

    // Clean up temp files
    try {
      const { unlink } = await import('fs/promises');
      await unlink(inputPath);
      await unlink(outputPath);
      // Clean up extracted directory
      if (existsSync(extractDir)) {
        rmSync(extractDir, { recursive: true });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    // Return the PDF as a downloadable file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outputName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: 'Conversion failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 