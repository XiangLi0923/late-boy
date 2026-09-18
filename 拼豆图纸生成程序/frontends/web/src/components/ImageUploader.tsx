import React, { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { trackEvent } from '../engine/analyticsService';

const ImageUploader: React.FC = () => {
  const { imageLoaded, setImage, clearImage, imageWidth, imageHeight } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    trackEvent('image_uploaded', { type: file.type, size: file.size });

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8Data = new Uint8Array(arrayBuffer);

      // Create an image to get dimensions and for display
      const img = new Image();
      img.onload = () => {
        setImage(img, uint8Data, file);
      };
      img.src = URL.createObjectURL(new Blob([arrayBuffer]));
    };
    reader.readAsArrayBuffer(file);
  }, [setImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        processFile(items[i].getAsFile()!);
        break;
      }
    }
  }, [processFile]);

  if (imageLoaded) {
    return (
      <div className="image-uploader loaded" tabIndex={0} onPaste={handlePaste}>
        <div className="image-info">
          <span>📷 {imageWidth} × {imageHeight}</span>
          <button className="btn btn-small" onClick={clearImage}>
            清除
          </button>
          <button
            className="btn btn-small"
            onClick={() => fileInputRef.current?.click()}
          >
            更换图片
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <div
      className={`image-uploader drop-zone ${isDragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      tabIndex={0}
      onPaste={handlePaste}
    >
      <div className="drop-content">
        <span className="drop-icon">🖼️</span>
        <p>拖入图片或点击选择</p>
        <p className="hint">也支持 Ctrl+V 粘贴</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ImageUploader;
