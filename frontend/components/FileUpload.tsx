"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileType, Loader2, X, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  isUploading?: boolean;
}

export function FileUpload({ onUpload, isUploading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(file => file.type === "application/pdf");
    
    if (validFiles.length === 0 && newFiles.length > 0) {
      setError("Please select only PDF files.");
      return;
    }

    setSelectedFiles(prev => {
      const combined = [...prev, ...validFiles];
      if (combined.length > 5) {
        setError("Maximum 5 files allowed.");
        return combined.slice(0, 5);
      }
      setError(null);
      return combined;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length > 0) {
      await onUpload(selectedFiles);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100",
          selectedFiles.length > 0 && "border-blue-400"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
        />
        
        <div className="flex flex-col items-center">
          <div className="p-4 bg-blue-100 rounded-full mb-4">
            <UploadCloud className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedFiles.length > 0 ? "Add more PDFs" : "Click or drag PDFs here"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">Up to 5 files, maximum 50MB each</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center text-red-600 text-sm animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Selected Files ({selectedFiles.length}/5)</span>
            <button 
              onClick={() => setSelectedFiles([])}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto px-1">
            {selectedFiles.map((file, index) => (
              <div 
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm group"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-2 bg-green-50 rounded-md">
                    <FileType className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSubmit();
              }}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none flex items-center justify-center transition-all shadow-md shadow-blue-200"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Processing {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}...
                </>
              ) : (
                `Process ${selectedFiles.length} ${selectedFiles.length === 1 ? 'Document' : 'Documents'}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
