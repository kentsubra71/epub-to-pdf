import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Read the static JavaScript file
    const filePath = path.join(process.cwd(), 'static', 'thorium-viewer.js');
    const fileContent = await readFile(filePath, 'utf-8');
    
    // Return as static JavaScript
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store', // Prevent caching during development
      },
    });
  } catch (error) {
    console.error('Error serving thorium-viewer.js:', error);
    return new NextResponse('File not found', { status: 404 });
  }
} 