import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Determine which file to serve based on the request
    let fileName: string;
    let contentType: string;
    
    if (pathname.includes('thorium-viewer.html')) {
      fileName = 'thorium-viewer.html';
      contentType = 'text/html; charset=utf-8';
    } else {
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Read the static file
    const filePath = path.join(process.cwd(), 'static', fileName);
    const fileContent = await readFile(filePath, 'utf-8');
    
    // Return as static content
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store', // Prevent caching during development
      },
    });
  } catch (error) {
    console.error('Error serving static file:', error);
    return new NextResponse('File not found', { status: 404 });
  }
} 