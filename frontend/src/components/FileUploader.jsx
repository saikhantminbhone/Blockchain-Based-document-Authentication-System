// src/components/FileUploader.jsx

import React, { useState, useRef, useId } from 'react';
import { UploadCloud, Camera, FileText, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

export default function FileUploader({ onFileSelect, title, acceptedFileTypes = "image/*, application/pdf" }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const uniqueFileId = useId();
  const uniqueCameraId = useId();

  const resetSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    onFileSelect(null);
  };

  const handleFileChange = (file) => {
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => handleFileChange(e.target.files[0]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Drag and Drop Area */}
      <label
        htmlFor={uniqueFileId}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={clsx(
            'relative flex flex-col items-center justify-center w-full min-h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors p-6',
            dragActive ? 'border-info bg-info/10' : 'border-text-muted/50 hover:border-info'
        )}
      >
        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center text-center">
            <UploadCloud className="w-12 h-12 mb-4 text-text-muted" />
            <p className="mb-2 text-lg text-text-primary font-semibold">
              <span className="text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-text-secondary">{title || "PDF, JPG, PNG (Max 10MB)"}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-text-primary">
            <FileText className="w-8 h-8 text-success flex-shrink-0" />
            {/* --- THIS IS THE FIX --- */}
            <span className="text-sm md:text-sm font-medium truncate max-w-[calc(100%-60px)]">
              {selectedFile.name}
            </span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); resetSelection(); }}
              className="ml-auto text-error hover:text-error/80 transition-colors flex-shrink-0"
              aria-label="Remove selected file"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        )}
        <input
          id={uniqueFileId}
          type="file"
          className="hidden"
          onChange={handleChange}
          ref={fileInputRef}
          accept={acceptedFileTypes}
        />
      </label>

      {/* Separator */}
      <div className="flex items-center">
        <div className="flex-grow border-t border-text-muted/20"></div>
        <span className="flex-shrink mx-4 text-text-muted text-xs font-semibold">OR</span>
        <div className="flex-grow border-t border-text-muted/20"></div>
      </div>

      {/* Scan Document Button */}
      <div className="text-center">
        <label
          htmlFor={uniqueCameraId}
          className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-lg cursor-pointer hover:bg-hover-blue transition-colors duration-200 font-semibold shadow-md hover:shadow-lg"
        >
          <Camera className="w-5 h-5" />
          <span >Scan with Camera</span>
        </label>
        <input
          id={uniqueCameraId}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          className="hidden"
          ref={cameraInputRef}
        />
      </div>
    </div>
  );
}