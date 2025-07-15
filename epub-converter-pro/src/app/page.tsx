'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; downloadUrl?: string } | null>(null);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setFile(file);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('epub', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Set iframe src to load the Thorium viewer with the book parameter
          const viewerUrl = `/thorium-viewer.html?book=${result.bookName}`;
          setEpubUrl(viewerUrl);
        } else {
          console.error('Upload failed:', result.message);
        }
      } else {
        console.error('Upload request failed:', response.status);
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/epub+zip': ['.epub']
    },
    multiple: false
  });

  const handleConvert = async () => {
    if (!file) return;
    setIsConverting(true);
    setResult(null);
    const formData = new FormData();
    formData.append('epub', file);
    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setResult({
          success: true,
          message: 'Conversion completed successfully!',
          downloadUrl: url
        });
      } else {
        const data = await response.json();
        setResult({
          success: false,
          message: data.error || 'Conversion failed'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error occurred'
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-row">
      {/* Sidebar */}
      <div className="w-80 min-w-[18rem] max-w-xs bg-white/90 shadow-xl flex flex-col items-center p-8 gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">EPUB to PDF</h1>
          <p className="text-sm text-gray-600">Upload, preview, and convert your EPUB.</p>
        </div>
        {/* Upload EPUB Button */}
        <button
          type="button"
          onClick={handleUploadClick}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-xl text-base mb-2 transition-colors"
        >
          Upload EPUB
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        {/* Drag-and-drop area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 w-full text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <div className="text-4xl text-gray-400">📚</div>
            {file ? (
              <div>
                <p className="text-base font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-base font-medium text-gray-900">{isDragActive ? 'Drop EPUB here' : 'Drag & drop EPUB here'}</p>
                <p className="text-xs text-gray-500">or click to browse</p>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleConvert}
          disabled={!file || isConverting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl text-base transition-colors disabled:cursor-not-allowed"
        >
          {isConverting ? 'Converting...' : 'Convert to PDF'}
        </button>
        {isConverting && (
          <div className="w-full bg-white rounded-xl shadow p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-base font-medium text-gray-900">Converting EPUB to PDF...</p>
            <p className="text-xs text-gray-500">This may take a few moments</p>
          </div>
        )}
        {result && (
          <div className={`w-full rounded-xl shadow p-4 text-center mt-2 ${
            result.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
          }`}>
            <div className={`text-2xl mb-2 ${result.success ? 'text-green-500' : 'text-red-500'}`}>{result.success ? '✅' : '❌'}</div>
            <p className={`text-base font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>{result.message}</p>
            {result.success && result.downloadUrl && (
              <a
                href={result.downloadUrl}
                download={file?.name.replace(/\.epub$/i, '.pdf') || 'output.pdf'}
                className="inline-block mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Download PDF
              </a>
            )}
          </div>
        )}
      </div>
      {/* Main Preview Area */}
      <div className="flex-1 overflow-hidden">
        {epubUrl ? (
          <iframe
            src={epubUrl}
            title="EPUB Preview"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-7xl mb-4">📖</div>
            <div className="text-xl">Upload an EPUB to preview it here</div>
          </div>
        )}
      </div>
    </div>
  );
}
