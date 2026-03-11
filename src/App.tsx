import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Image as ImageIcon, Trash2, Settings, Plus, Layers, AlignCenterHorizontal, AlignCenterVertical, Unlock, ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Rnd } from 'react-rnd';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateComposite, Area, FitMode } from './utils/imageProcessor';

function App() {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [fgImages, setFgImages] = useState<{ id: string; src: string; file: File }[]>([]);
  const [areaPct, setAreaPct] = useState<Area>({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [previews, setPreviews] = useState<{ id: string; src: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | false>(false);
  const [borderRadius, setBorderRadius] = useState<number>(0);

  const bgImgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [manualWidth, setManualWidth] = useState<string>('');
  const [manualHeight, setManualHeight] = useState<string>('');

  useEffect(() => {
    const updateSize = () => {
      if (bgImgRef.current) {
        setImgSize({
          width: bgImgRef.current.clientWidth,
          height: bgImgRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', updateSize);
    
    let observer: ResizeObserver;
    if (bgImgRef.current) {
      observer = new ResizeObserver(updateSize);
      observer.observe(bgImgRef.current);
    }
    
    updateSize();
    return () => {
      window.removeEventListener('resize', updateSize);
      if (observer) observer.disconnect();
    };
  }, [bgImage]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBgImage(event.target?.result as string);
        setAreaPct({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
        setAspectRatio(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFgImages((prev) => [
          ...prev,
          { id: Math.random().toString(36).substring(7), src: event.target?.result as string, file },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFgImage = (id: string) => {
    setFgImages((prev) => prev.filter((img) => img.id !== id));
  };

  const generatePreviews = async () => {
    if (!bgImage || fgImages.length === 0) return;
    setIsGenerating(true);
    try {
      const newPreviews = await Promise.all(
        fgImages.map(async (fg) => {
          const src = await generateComposite(bgImage, fg.src, areaPct, fitMode, borderRadius);
          return { id: fg.id, src };
        })
      );
      setPreviews(newPreviews);
    } catch (error) {
      console.error('Error generating previews:', error);
      alert('合成圖片時發生錯誤');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (bgImage && fgImages.length > 0) {
      const timeoutId = setTimeout(() => {
        generatePreviews();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPreviews([]);
    }
  }, [bgImage, fgImages, areaPct, fitMode, borderRadius]);

  const downloadAll = async () => {
    if (previews.length === 0) return;
    const zip = new JSZip();
    previews.forEach((preview, index) => {
      const base64Data = preview.src.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      zip.file(`composite_${index + 1}.png`, base64Data, { base64: true });
    });
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content as Blob, 'composites.zip');
  };

  const downloadSingle = (src: string, index: number) => {
    saveAs(src, `composite_${index + 1}.png`);
  };

  const applyAspectRatio = (ratio: number) => {
    if (naturalSize.width === 0 || naturalSize.height === 0) return;
    
    let newAbsWidth = areaPct.width * naturalSize.width;
    let newAbsHeight = newAbsWidth / ratio;

    if (newAbsHeight > naturalSize.height) {
      newAbsHeight = naturalSize.height;
      newAbsWidth = newAbsHeight * ratio;
    }
    if (newAbsWidth > naturalSize.width) {
      newAbsWidth = naturalSize.width;
      newAbsHeight = newAbsWidth / ratio;
    }

    let newPctWidth = newAbsWidth / naturalSize.width;
    let newPctHeight = newAbsHeight / naturalSize.height;

    let newX = areaPct.x + (areaPct.width - newPctWidth) / 2;
    let newY = areaPct.y + (areaPct.height - newPctHeight) / 2;

    if (newX < 0) newX = 0;
    if (newX + newPctWidth > 1) newX = 1 - newPctWidth;
    if (newY < 0) newY = 0;
    if (newY + newPctHeight > 1) newY = 1 - newPctHeight;

    setAreaPct({
      x: newX,
      y: newY,
      width: newPctWidth,
      height: newPctHeight
    });
  };

  const handleSetRatio = (ratio: number | false) => {
    setAspectRatio(ratio);
    if (ratio !== false) {
      applyAspectRatio(ratio);
    }
  };

  const centerHorizontally = () => {
    setAreaPct(prev => ({ ...prev, x: (1 - prev.width) / 2 }));
  };

  const centerVertically = () => {
    setAreaPct(prev => ({ ...prev, y: (1 - prev.height) / 2 }));
  };

  useEffect(() => {
    if (naturalSize.width > 0 && naturalSize.height > 0) {
      setManualWidth(Math.round(areaPct.width * naturalSize.width).toString());
      setManualHeight(Math.round(areaPct.height * naturalSize.height).toString());
    }
  }, [areaPct, naturalSize]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (zoomedIndex === null) return;
      if (e.key === 'Escape') setZoomedIndex(null);
      if (e.key === 'ArrowLeft') setZoomedIndex((prev) => (prev! - 1 + previews.length) % previews.length);
      if (e.key === 'ArrowRight') setZoomedIndex((prev) => (prev! + 1) % previews.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedIndex, previews.length]);

  const handleManualWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualWidth(val);
    if (aspectRatio !== false && val !== '') {
      const numVal = parseInt(val);
      if (!isNaN(numVal)) {
        setManualHeight(Math.round(numVal / aspectRatio).toString());
      }
    }
  };

  const handleManualHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualHeight(val);
    if (aspectRatio !== false && val !== '') {
      const numVal = parseInt(val);
      if (!isNaN(numVal)) {
        setManualWidth(Math.round(numVal * aspectRatio).toString());
      }
    }
  };

  const applyManualSize = (dimension: 'width' | 'height', valStr: string) => {
    let value = parseInt(valStr);
    if (isNaN(value) || value <= 0) {
      setManualWidth(Math.round(areaPct.width * naturalSize.width).toString());
      setManualHeight(Math.round(areaPct.height * naturalSize.height).toString());
      return;
    }

    let newPct = dimension === 'width' ? value / naturalSize.width : value / naturalSize.height;
    newPct = Math.max(0.01, Math.min(1, newPct));

    setAreaPct(prev => {
      let newX = prev.x;
      let newY = prev.y;
      let newWidth = prev.width;
      let newHeight = prev.height;

      if (dimension === 'width') {
        newWidth = newPct;
        if (newX + newWidth > 1) newX = 1 - newWidth;
        if (aspectRatio !== false) {
          newHeight = (newWidth * naturalSize.width) / (aspectRatio * naturalSize.height);
          if (newHeight > 1) {
            newHeight = 1;
            newWidth = (newHeight * naturalSize.height * aspectRatio) / naturalSize.width;
          }
          if (newY + newHeight > 1) newY = 1 - newHeight;
        }
      } else {
        newHeight = newPct;
        if (newY + newHeight > 1) newY = 1 - newHeight;
        if (aspectRatio !== false) {
          newWidth = (newHeight * naturalSize.height * aspectRatio) / naturalSize.width;
          if (newWidth > 1) {
            newWidth = 1;
            newHeight = (newWidth * naturalSize.width) / (aspectRatio * naturalSize.height);
          }
          if (newX + newWidth > 1) newX = 1 - newWidth;
        }
      }

      return { x: newX, y: newY, width: newWidth, height: newHeight };
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-semibold tracking-tight">批次圖片合成工具</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={downloadAll}
              disabled={previews.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              全部下載 (ZIP)
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-zinc-500" />
                1. 設定背景與合成範圍
              </h2>
              <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Upload className="w-4 h-4" />
                更換背景圖
                <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
              </label>
            </div>

            {bgImage ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                  <div className="flex items-center gap-1 mr-2">
                    <span className="text-sm font-medium text-zinc-600">比例:</span>
                  </div>
                  <div className="flex bg-white border border-zinc-200 rounded-md overflow-hidden">
                    <button
                      onClick={() => handleSetRatio(false)}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${aspectRatio === false ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      <Unlock className="w-3 h-3" /> 自由
                    </button>
                    <div className="w-px bg-zinc-200"></div>
                    <button
                      onClick={() => handleSetRatio(1)}
                      className={`px-3 py-1.5 text-xs font-medium ${aspectRatio === 1 ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      1:1
                    </button>
                    <div className="w-px bg-zinc-200"></div>
                    <button
                      onClick={() => handleSetRatio(4/3)}
                      className={`px-3 py-1.5 text-xs font-medium ${aspectRatio === 4/3 ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      4:3
                    </button>
                    <div className="w-px bg-zinc-200"></div>
                    <button
                      onClick={() => handleSetRatio(3/4)}
                      className={`px-3 py-1.5 text-xs font-medium ${aspectRatio === 3/4 ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      3:4
                    </button>
                    <div className="w-px bg-zinc-200"></div>
                    <button
                      onClick={() => handleSetRatio(16/9)}
                      className={`px-3 py-1.5 text-xs font-medium ${aspectRatio === 16/9 ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      16:9
                    </button>
                    <div className="w-px bg-zinc-200"></div>
                    <button
                      onClick={() => handleSetRatio(9/16)}
                      className={`px-3 py-1.5 text-xs font-medium ${aspectRatio === 9/16 ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      9:16
                    </button>
                  </div>

                  <div className="w-px h-6 bg-zinc-300 mx-2"></div>
                  
                  <div className="flex items-center gap-1 mr-2">
                    <span className="text-sm font-medium text-zinc-600">對齊:</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={centerHorizontally}
                      className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 flex items-center gap-1"
                      title="水平置中"
                    >
                      <AlignCenterHorizontal className="w-3 h-3" /> 水平
                    </button>
                    <button
                      onClick={centerVertically}
                      className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 flex items-center gap-1"
                      title="垂直置中"
                    >
                      <AlignCenterVertical className="w-3 h-3" /> 垂直
                    </button>
                  </div>

                  <div className="w-px h-6 bg-zinc-300 mx-2"></div>
                  
                  <div className="flex items-center gap-1 mr-2">
                    <span className="text-sm font-medium text-zinc-600">尺寸(px):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={manualWidth}
                      onChange={handleManualWidthChange}
                      onBlur={() => applyManualSize('width', manualWidth)}
                      onKeyDown={(e) => e.key === 'Enter' && applyManualSize('width', manualWidth)}
                      className="w-16 px-2 py-1.5 text-xs border border-zinc-200 rounded-md text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      title="寬度 (px)"
                    />
                    <span className="text-xs text-zinc-400">x</span>
                    <input
                      type="number"
                      value={manualHeight}
                      onChange={handleManualHeightChange}
                      onBlur={() => applyManualSize('height', manualHeight)}
                      onKeyDown={(e) => e.key === 'Enter' && applyManualSize('height', manualHeight)}
                      className="w-16 px-2 py-1.5 text-xs border border-zinc-200 rounded-md text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      title="高度 (px)"
                    />
                  </div>

                  <div className="w-px h-6 bg-zinc-300 mx-2"></div>
                  
                  <div className="flex items-center gap-1 mr-2">
                    <span className="text-sm font-medium text-zinc-600">圓角(px):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={borderRadius === 0 ? '' : borderRadius}
                      onChange={(e) => setBorderRadius(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-16 px-2 py-1.5 text-xs border border-zinc-200 rounded-md text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      title="圓角 (px)"
                      min="0"
                    />
                  </div>

                  <div className="w-px h-6 bg-zinc-300 mx-2"></div>
                  
                  <div className="flex items-center gap-1 mr-2">
                    <span className="text-sm font-medium text-zinc-600">填滿:</span>
                  </div>
                  <div className="flex bg-white border border-zinc-200 rounded-md overflow-hidden">
                    <button
                      onClick={() => setFitMode('cover')}
                      className={`px-3 py-1.5 text-xs font-medium ${fitMode === 'cover' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      title="填滿 (Cover) - 可能裁切"
                    >
                      填滿
                    </button>
                    <div className="w-px bg-zinc-200"></div>
                    <button
                      onClick={() => setFitMode('contain')}
                      className={`px-3 py-1.5 text-xs font-medium ${fitMode === 'contain' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      title="包含 (Contain) - 留白"
                    >
                      包含
                    </button>
                    <div className="w-px bg-zinc-200"></div>
                    <button
                      onClick={() => setFitMode('fill')}
                      className={`px-3 py-1.5 text-xs font-medium ${fitMode === 'fill' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      title="拉伸 (Fill) - 變形"
                    >
                      拉伸
                    </button>
                  </div>
                </div>

                <div className="relative border border-zinc-200 rounded-lg overflow-hidden bg-zinc-100 flex items-center justify-center min-h-[300px]">
                  <div className="relative inline-block">
                    <img
                      ref={bgImgRef}
                      src={bgImage}
                      alt="Background"
                      className="max-w-full max-h-[600px] w-auto h-auto block select-none pointer-events-none"
                      onLoad={(e) => {
                        setImgSize({
                          width: e.currentTarget.clientWidth,
                          height: e.currentTarget.clientHeight,
                        });
                        setNaturalSize({
                          width: e.currentTarget.naturalWidth,
                          height: e.currentTarget.naturalHeight,
                        });
                      }}
                      draggable={false}
                    />
                    {imgSize.width > 0 && (
                      <Rnd
                        bounds="parent"
                        position={{
                          x: areaPct.x * imgSize.width,
                          y: areaPct.y * imgSize.height,
                        }}
                        size={{
                          width: areaPct.width * imgSize.width,
                          height: areaPct.height * imgSize.height,
                        }}
                        lockAspectRatio={aspectRatio !== false}
                        onDragStop={(e, d) => {
                          setAreaPct((prev) => ({
                            ...prev,
                            x: d.x / imgSize.width,
                            y: d.y / imgSize.height,
                          }));
                        }}
                        onResizeStop={(e, direction, ref, delta, position) => {
                          setAreaPct({
                            x: position.x / imgSize.width,
                            y: position.y / imgSize.height,
                            width: parseFloat(ref.style.width) / imgSize.width,
                            height: parseFloat(ref.style.height) / imgSize.height,
                          });
                        }}
                        className="border-2 border-indigo-500 bg-indigo-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] cursor-move"
                        style={{ borderRadius: `${naturalSize.width > 0 ? borderRadius * (imgSize.width / naturalSize.width) : 0}px` }}
                      >
                        <div className="w-full h-full flex items-center justify-center text-white font-medium drop-shadow-md select-none pointer-events-none">
                          合成區域
                        </div>
                      </Rnd>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-zinc-300 rounded-xl p-12 flex flex-col items-center justify-center text-zinc-500 bg-zinc-50">
                <ImageIcon className="w-12 h-12 mb-4 text-zinc-400" />
                <p className="mb-2">尚未上傳背景圖</p>
                <label className="cursor-pointer px-4 py-2 bg-white border border-zinc-300 rounded-lg font-medium hover:bg-zinc-50 transition-colors text-zinc-700">
                  選擇圖片
                  <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                </label>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Layers className="w-5 h-5 text-zinc-500" />
                2. 上傳前景圖片
              </h2>
              <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Plus className="w-4 h-4" />
                新增圖片
                <input type="file" accept="image/*" multiple onChange={handleFgUpload} className="hidden" />
              </label>
            </div>

            {fgImages.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto p-1">
                {fgImages.map((img) => (
                  <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-200">
                    <img src={img.src} alt="Foreground" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFgImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer aspect-square rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors">
                  <Plus className="w-6 h-6" />
                  <span className="text-xs mt-1">新增</span>
                  <input type="file" accept="image/*" multiple onChange={handleFgUpload} className="hidden" />
                </label>
              </div>
            ) : (
              <div className="border-2 border-dashed border-zinc-300 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 bg-zinc-50">
                <p className="mb-2 text-sm">尚未上傳任何前景圖片</p>
                <label className="cursor-pointer px-4 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors text-zinc-700">
                  選擇多張圖片
                  <input type="file" accept="image/*" multiple onChange={handleFgUpload} className="hidden" />
                </label>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-zinc-500" />
                3. 預覽與下載
              </h2>
              {isGenerating && <span className="text-sm text-zinc-500 animate-pulse">產生中...</span>}
            </div>

            {previews.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto p-1">
                {previews.map((preview, index) => (
                  <div key={preview.id} className="group relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100">
                    <img src={preview.src} alt={`Preview ${index + 1}`} className="w-full h-auto object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setZoomedIndex(index)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white text-zinc-900 rounded-md font-medium text-sm hover:bg-zinc-100"
                      >
                        <ZoomIn className="w-4 h-4" />
                        放大
                      </button>
                      <button
                        onClick={() => downloadSingle(preview.src, index)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700"
                      >
                        <Download className="w-4 h-4" />
                        下載
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200">
                <p>上傳背景與前景圖片後，<br/>這裡將顯示合成預覽</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {zoomedIndex !== null && previews[zoomedIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setZoomedIndex(null)}>
          <button
            className="absolute top-6 right-6 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-50"
            onClick={() => setZoomedIndex(null)}
          >
            <X className="w-8 h-8" />
          </button>

          {previews.length > 1 && (
            <>
              <button
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedIndex((prev) => (prev! - 1 + previews.length) % previews.length);
                }}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedIndex((prev) => (prev! + 1) % previews.length);
                }}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <div className="relative max-w-full max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previews[zoomedIndex].src}
              alt={`Zoomed Preview ${zoomedIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-6 flex items-center gap-6">
              <span className="text-white/80 font-medium bg-black/50 px-3 py-1.5 rounded-full text-sm">
                {zoomedIndex + 1} / {previews.length}
              </span>
              <button
                onClick={() => downloadSingle(previews[zoomedIndex].src, zoomedIndex)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors shadow-lg"
              >
                <Download className="w-5 h-5" />
                下載此圖片
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
