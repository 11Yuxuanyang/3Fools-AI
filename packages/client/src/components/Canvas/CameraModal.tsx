/**
 * CameraModal - 摄像头拍照弹窗
 */

import { useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  facingMode: 'user' | 'environment';
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export function CameraModal({ isOpen, facingMode, onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
    }
  }, [facingMode]);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // 拍照
  const takePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 如果是前置摄像头，镜像翻转
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.9);

    onCapture(imageData);
    onClose();
  }, [facingMode, onCapture, onClose]);

  // 打开/关闭时启动/停止摄像头
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-32 z-[100]">
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-gray-800"
        style={{ width: '560px' }}
      >
        {/* 视频预览 */}
        <div className="relative aspect-[4/3]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-700/80 text-white hover:bg-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
          {/* 拍照按钮 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              onClick={takePhoto}
              className="w-14 h-14 rounded-full bg-white/90 hover:bg-white transition-colors shadow-lg flex items-center justify-center"
            >
              <div className="w-11 h-11 rounded-full bg-gray-200" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
