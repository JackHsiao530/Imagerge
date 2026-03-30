export interface Area {
  x: number; // 0 to 1
  y: number; // 0 to 1
  width: number; // 0 to 1
  height: number; // 0 to 1
}

export type FitMode = 'contain' | 'cover' | 'fill';

export const generateThumbnail = (file: File, maxSize: number = 300): Promise<string> => {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(src);
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('Failed to create thumbnail blob'));
        }
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error('Failed to load image for thumbnail'));
    };
    img.src = src;
  });
};

export const generateComposite = (
  bgImageSrc: string,
  fgImageSrc: string,
  areaPct: Area,
  fitMode: FitMode = 'contain',
  borderRadius: number = 0
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';
    bgImg.onload = () => {
      const MAX_DIMENSION = 4096;
      let scale = 1;
      if (bgImg.naturalWidth > MAX_DIMENSION || bgImg.naturalHeight > MAX_DIMENSION) {
        scale = Math.min(MAX_DIMENSION / bgImg.naturalWidth, MAX_DIMENSION / bgImg.naturalHeight);
      }

      canvas.width = Math.round(bgImg.naturalWidth * scale);
      canvas.height = Math.round(bgImg.naturalHeight * scale);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      const fgImg = new Image();
      fgImg.crossOrigin = 'anonymous';
      fgImg.onload = () => {
        const targetX = areaPct.x * canvas.width;
        const targetY = areaPct.y * canvas.height;
        const targetWidth = areaPct.width * canvas.width;
        const targetHeight = areaPct.height * canvas.height;

        let drawWidth = targetWidth;
        let drawHeight = targetHeight;
        let drawX = targetX;
        let drawY = targetY;

        if (fitMode === 'contain' || fitMode === 'cover') {
          const targetRatio = targetWidth / targetHeight;
          const fgRatio = fgImg.naturalWidth / fgImg.naturalHeight;

          if (fitMode === 'contain') {
            if (fgRatio > targetRatio) {
              drawWidth = targetWidth;
              drawHeight = targetWidth / fgRatio;
            } else {
              drawHeight = targetHeight;
              drawWidth = targetHeight * fgRatio;
            }
          } else if (fitMode === 'cover') {
            if (fgRatio > targetRatio) {
              drawHeight = targetHeight;
              drawWidth = targetHeight * fgRatio;
            } else {
              drawWidth = targetWidth;
              drawHeight = targetWidth / fgRatio;
            }
          }

          drawX = targetX + (targetWidth - drawWidth) / 2;
          drawY = targetY + (targetHeight - drawHeight) / 2;
        }

        if (fitMode === 'cover' || borderRadius > 0) {
          ctx.save();
          ctx.beginPath();
          
          if (borderRadius > 0) {
            const maxRadius = Math.min(targetWidth / 2, targetHeight / 2);
            const r = Math.min(borderRadius * scale, maxRadius);
            if (ctx.roundRect) {
              ctx.roundRect(targetX, targetY, targetWidth, targetHeight, r);
            } else {
              ctx.moveTo(targetX + r, targetY);
              ctx.lineTo(targetX + targetWidth - r, targetY);
              ctx.quadraticCurveTo(targetX + targetWidth, targetY, targetX + targetWidth, targetY + r);
              ctx.lineTo(targetX + targetWidth, targetY + targetHeight - r);
              ctx.quadraticCurveTo(targetX + targetWidth, targetY + targetHeight, targetX + targetWidth - r, targetY + targetHeight);
              ctx.lineTo(targetX + r, targetY + targetHeight);
              ctx.quadraticCurveTo(targetX, targetY + targetHeight, targetX, targetY + targetHeight - r);
              ctx.lineTo(targetX, targetY + r);
              ctx.quadraticCurveTo(targetX, targetY, targetX + r, targetY);
            }
          } else {
            ctx.rect(targetX, targetY, targetWidth, targetHeight);
          }
          
          ctx.clip();
          ctx.drawImage(fgImg, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();
        } else {
          ctx.drawImage(fgImg, drawX, drawY, drawWidth, drawHeight);
        }

        canvas.toBlob((blob) => {
          // Explicitly free canvas memory
          canvas.width = 0;
          canvas.height = 0;
          
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/png');
      };
      fgImg.onerror = () => reject(new Error('Failed to load foreground image'));
      fgImg.src = fgImageSrc;
    };
    bgImg.onerror = () => reject(new Error('Failed to load background image'));
    bgImg.src = bgImageSrc;
  });
};
