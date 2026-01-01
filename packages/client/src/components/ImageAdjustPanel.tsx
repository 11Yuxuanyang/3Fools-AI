import React, { useState } from 'react';
import {
  Sun,
  Contrast,
  Droplets,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  X,
  RotateCcwIcon,
  Grid3X3,
  CircleDashed,
  Check,
  Thermometer,
  Sparkles,
  Circle,
  Square,
  Type,
  Aperture,
  Palette,
  Rainbow,
  Layers,
  Eraser,
  Focus,
  Grip,
  Moon,
  SunDim,
} from 'lucide-react';
import { CanvasItem } from '../types';

interface ImageAdjustPanelProps {
  item: CanvasItem;
  onUpdate: (updates: Partial<CanvasItem>) => void;
  onClose: () => void;
  scale?: number;
  onMosaic?: () => void;
  onBlur?: () => void;
}

// 滤镜预设
const FILTER_PRESETS = [
  { name: 'none', label: '原图', filter: '' },
  { name: 'vintage', label: '复古', filter: 'sepia(0.3) contrast(1.1) brightness(0.9)' },
  { name: 'fresh', label: '清新', filter: 'saturate(1.3) brightness(1.1)' },
  { name: 'warm', label: '暖色', filter: 'sepia(0.2) saturate(1.2) brightness(1.05)' },
  { name: 'cool', label: '冷色', filter: 'saturate(0.9) hue-rotate(10deg) brightness(1.05)' },
  { name: 'bw', label: '黑白', filter: 'grayscale(1)' },
  { name: 'dramatic', label: '戏剧', filter: 'contrast(1.3) saturate(1.2) brightness(0.95)' },
  { name: 'soft', label: '柔和', filter: 'contrast(0.9) brightness(1.1) saturate(0.9)' },
];

// 通用滑块组件
interface SliderProps {
  icon?: React.ReactNode;
  label: string;
  value: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({
  icon,
  label,
  value,
  defaultValue = 100,
  min = 0,
  max = 200,
  onChange,
}) => {
  const isDefault = value === defaultValue;
  const showPercentage = defaultValue === 100;
  const displayValue = showPercentage ? value - 100 : value;

  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-gray-400 flex-shrink-0">{icon}</span>}
      <span className="text-xs text-gray-600 w-14 flex-shrink-0 whitespace-nowrap">{label}</span>
      <div className="relative flex-1 h-5 flex items-center">
        <div className="absolute inset-x-0 h-1 bg-gray-100 rounded-full" />
        {showPercentage && (
          <div
            className="absolute h-1 bg-violet-400 rounded-full"
            style={{
              left: value < 100 ? `${value / 2}%` : '50%',
              right: value > 100 ? `${100 - value / 2}%` : '50%',
            }}
          />
        )}
        {showPercentage && <div className="absolute left-1/2 -translate-x-1/2 w-px h-2 bg-gray-300" />}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-5 appearance-none bg-transparent cursor-pointer z-10
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-violet-500
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:shadow
            [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>
      <span className={`text-xs w-7 text-right tabular-nums ${isDefault ? 'text-gray-400' : 'text-violet-600'}`}>
        {showPercentage ? (displayValue >= 0 ? '+' : '') + displayValue : value}
      </span>
      {!isDefault && (
        <button
          onClick={() => onChange(defaultValue)}
          className="p-0.5 text-gray-300 hover:text-violet-500 transition-colors"
        >
          <RotateCcwIcon size={10} />
        </button>
      )}
    </div>
  );
};

export const ImageAdjustPanel: React.FC<ImageAdjustPanelProps> = ({
  item,
  onUpdate,
  onClose,
  scale = 1,
  onMosaic,
  onBlur,
}) => {
  const [activeTab, setActiveTab] = useState<'adjust' | 'filter' | 'decor' | 'obscure'>('adjust');


  // 基础属性
  const brightness = item.brightness ?? 100;
  const contrast = item.contrast ?? 100;
  const saturation = item.saturation ?? 100;
  const rotation = item.rotation ?? 0;
  const flipH = item.flipH ?? false;
  const flipV = item.flipV ?? false;
  const currentFilter = item.filter ?? 'none';

  // 进阶属性
  const exposure = item.exposure ?? 100;
  const sharpness = item.sharpness ?? 100;
  const highlights = item.highlights ?? 100;
  const shadows = item.shadows ?? 100;
  const temperature = item.temperature ?? 100;
  const tint = item.tint ?? 100;
  const hue = item.hue ?? 0;
  const texture = item.texture ?? 100;
  const luminanceNoise = item.luminanceNoise ?? 0;
  const colorNoise = item.colorNoise ?? 0;
  const vignette = item.vignette ?? 0;
  const grain = item.grain ?? 0;

  // 边框属性
  const imgBorderWidth = item.imgBorderWidth ?? 0;
  const imgBorderColor = item.imgBorderColor ?? '#ffffff';
  const imgBorderStyle = item.imgBorderStyle ?? 'solid';

  // 阴影属性
  const imgShadowEnabled = item.imgShadowEnabled ?? false;
  const imgShadowX = item.imgShadowX ?? 0;
  const imgShadowY = item.imgShadowY ?? 4;
  const imgShadowBlur = item.imgShadowBlur ?? 10;
  const imgShadowColor = item.imgShadowColor ?? 'rgba(0,0,0,0.3)';

  // 水印属性
  const watermarkText = item.watermarkText ?? '';
  const watermarkPosition = item.watermarkPosition ?? 'bottom-right';
  const watermarkSize = item.watermarkSize ?? 16;
  const watermarkColor = item.watermarkColor ?? '#ffffff';
  const watermarkOpacity = item.watermarkOpacity ?? 80;

  const handleRotate = (degrees: number) => {
    const newRotation = ((rotation + degrees) % 360 + 360) % 360;
    onUpdate({ rotation: newRotation });
  };

  const handleResetAll = () => {
    onUpdate({
      brightness: 100, contrast: 100, saturation: 100,
      rotation: 0, flipH: false, flipV: false, filter: 'none',
      exposure: 100, sharpness: 100, highlights: 100, shadows: 100,
      temperature: 100, tint: 100, hue: 0, texture: 100, luminanceNoise: 0, colorNoise: 0,
      vignette: 0, grain: 0,
      imgBorderWidth: 0, imgBorderColor: '#ffffff', imgBorderStyle: 'solid',
      imgShadowEnabled: false, imgShadowX: 0, imgShadowY: 4, imgShadowBlur: 10, imgShadowColor: 'rgba(0,0,0,0.3)',
      watermarkText: '', watermarkPosition: 'bottom-right', watermarkSize: 16, watermarkColor: '#ffffff', watermarkOpacity: 80,
    });
  };

  const hasChanges = brightness !== 100 || contrast !== 100 || saturation !== 100 ||
    rotation !== 0 || flipH || flipV || currentFilter !== 'none' ||
    exposure !== 100 || sharpness !== 100 || highlights !== 100 || shadows !== 100 ||
    temperature !== 100 || tint !== 100 || hue !== 0 || texture !== 100 || luminanceNoise !== 0 || colorNoise !== 0 ||
    vignette !== 0 || grain !== 0 ||
    imgBorderWidth !== 0 || imgShadowEnabled || watermarkText !== '';

  const [rightTab, setRightTab] = useState<'filter' | 'decor' | 'obscure'>('filter');

  // 通用面板容器样式
  const panelClass = "absolute top-0 z-50 animate-in fade-in duration-150";
  const panelStyle = "bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg";

  return (
    <>
      {/* 底部工具栏 - 变换 */}
      <div
        className="absolute left-1/2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        style={{
          top: item.height * scale + 8,
          transform: 'translateX(-50%)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg px-2 py-1.5 flex items-center gap-1">
          <button
            onClick={() => handleRotate(-90)}
            className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
            title="逆时针旋转90°"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
            title="顺时针旋转90°"
          >
            <RotateCw size={16} />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <button
            onClick={() => onUpdate({ flipH: !flipH })}
            className={`p-1.5 rounded-lg transition-colors ${flipH ? 'text-violet-600 bg-violet-50' : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="水平翻转"
          >
            <FlipHorizontal size={16} />
          </button>
          <button
            onClick={() => onUpdate({ flipV: !flipV })}
            className={`p-1.5 rounded-lg transition-colors ${flipV ? 'text-violet-600 bg-violet-50' : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="垂直翻转"
          >
            <FlipVertical size={16} />
          </button>
          {rotation !== 0 && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-0.5" />
              <span className="text-xs text-gray-500 px-1">{rotation}°</span>
            </>
          )}
        </div>
      </div>

      {/* 右侧面板 - 调色 */}
      <div
        className={`${panelClass} slide-in-from-left-1`}
        style={{ left: item.width * scale / 2 + 8 }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className={`${panelStyle} w-64`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-700">修图</span>
            <div className="flex items-center gap-1">
              {hasChanges && (
                <button onClick={handleResetAll} className="text-xs text-gray-400 hover:text-violet-600 px-1.5 py-0.5 rounded hover:bg-violet-50">
                  重置
                </button>
              )}
            </div>
          </div>
          <div className="p-3 max-h-96 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              {/* 光线 */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">光线</div>
                <Slider icon={<Aperture size={12} />} label="曝光" value={exposure} onChange={(v) => onUpdate({ exposure: v })} />
                <Slider icon={<SunDim size={12} />} label="亮度" value={brightness} onChange={(v) => onUpdate({ brightness: v })} />
                <Slider icon={<Contrast size={12} />} label="对比度" value={contrast} onChange={(v) => onUpdate({ contrast: v })} />
                <Slider icon={<Sun size={12} />} label="高光" value={highlights} onChange={(v) => onUpdate({ highlights: v })} />
                <Slider icon={<Moon size={12} />} label="阴影" value={shadows} onChange={(v) => onUpdate({ shadows: v })} />
              </div>

              {/* 颜色 */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">颜色</div>
                <Slider icon={<Droplets size={12} />} label="饱和度" value={saturation} onChange={(v) => onUpdate({ saturation: v })} />
                <Slider icon={<Thermometer size={12} />} label="色温" value={temperature} onChange={(v) => onUpdate({ temperature: v })} />
                <Slider icon={<Palette size={12} />} label="色调" value={tint} onChange={(v) => onUpdate({ tint: v })} />
                <Slider icon={<Rainbow size={12} />} label="色相" value={hue} defaultValue={0} min={0} max={360} onChange={(v) => onUpdate({ hue: v })} />
              </div>

              {/* 细节 */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">细节</div>
                <Slider icon={<Sparkles size={12} />} label="锐化" value={sharpness} onChange={(v) => onUpdate({ sharpness: v })} />
                <Slider icon={<Layers size={12} />} label="纹理" value={texture} onChange={(v) => onUpdate({ texture: v })} />
                <Slider icon={<Eraser size={12} />} label="亮度降噪" value={luminanceNoise} defaultValue={0} min={0} max={100} onChange={(v) => onUpdate({ luminanceNoise: v })} />
                <Slider icon={<Palette size={12} />} label="颜色降噪" value={colorNoise} defaultValue={0} min={0} max={100} onChange={(v) => onUpdate({ colorNoise: v })} />
              </div>

              {/* 效果 */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">效果</div>
                <Slider icon={<Focus size={12} />} label="晕影" value={vignette} defaultValue={0} min={0} max={100} onChange={(v) => onUpdate({ vignette: v })} />
                <Slider icon={<Grip size={12} />} label="颗粒" value={grain} defaultValue={0} min={0} max={100} onChange={(v) => onUpdate({ grain: v })} />
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 左侧面板 - 滤镜/装饰/遮挡 */}
      <div
        className={`${panelClass} slide-in-from-right-1`}
        style={{ right: item.width * scale / 2 + 8 }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className={`${panelStyle} w-64`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setRightTab('filter')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  rightTab === 'filter' ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                滤镜
              </button>
              <button
                onClick={() => setRightTab('decor')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  rightTab === 'decor' ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                装饰
              </button>
              <button
                onClick={() => setRightTab('obscure')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  rightTab === 'obscure' ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                遮挡
              </button>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
              <X size={14} />
            </button>
          </div>
          <div className="p-3 max-h-96 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
            {rightTab === 'filter' && (
              <div className="grid grid-cols-4 gap-2">
                {FILTER_PRESETS.map((preset) => {
                  const isSelected = currentFilter === preset.name;
                  return (
                    <button key={preset.name} onClick={() => onUpdate({ filter: preset.name })} className="group relative flex flex-col items-center">
                      <div className={`relative w-12 h-12 rounded-lg overflow-hidden transition-all ${isSelected ? 'ring-2 ring-violet-500 ring-offset-1' : 'ring-1 ring-gray-200 group-hover:ring-gray-300'}`}>
                        <img src={item.src} alt={preset.label} className="w-full h-full object-cover" style={{ filter: preset.filter || 'none' }} draggable={false} />
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
                            <Check size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                      <span className={`mt-1 text-[10px] ${isSelected ? 'text-violet-600 font-medium' : 'text-gray-500'}`}>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {rightTab === 'decor' && (
              <div className="space-y-4">
                {/* 边框 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Square size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-600">边框</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400">宽度</label>
                      <input
                        type="range" min={0} max={20} value={imgBorderWidth}
                        onChange={(e) => onUpdate({ imgBorderWidth: Number(e.target.value) })}
                        className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400">颜色</label>
                      <input type="color" value={imgBorderColor} onChange={(e) => onUpdate({ imgBorderColor: e.target.value })} className="w-full h-6 rounded cursor-pointer" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => onUpdate({ imgBorderStyle: style })}
                        className={`flex-1 py-1 text-[10px] rounded ${imgBorderStyle === style ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-500'}`}
                      >
                        {style === 'solid' ? '实线' : style === 'dashed' ? '虚线' : '点线'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 阴影 */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox" checked={imgShadowEnabled}
                      onChange={(e) => onUpdate({ imgShadowEnabled: e.target.checked })}
                      className="rounded border-gray-300 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-xs text-gray-600">阴影</span>
                  </label>
                  {imgShadowEnabled && (
                    <div className="space-y-1.5 pl-5">
                      <Slider label="水平" value={imgShadowX} defaultValue={0} min={-20} max={20} onChange={(v) => onUpdate({ imgShadowX: v })} />
                      <Slider label="垂直" value={imgShadowY} defaultValue={4} min={-20} max={20} onChange={(v) => onUpdate({ imgShadowY: v })} />
                      <Slider label="模糊" value={imgShadowBlur} defaultValue={10} min={0} max={50} onChange={(v) => onUpdate({ imgShadowBlur: v })} />
                    </div>
                  )}
                </div>

                {/* 水印 */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Type size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-600">水印</span>
                  </div>
                  <input
                    type="text" placeholder="输入水印文字"
                    value={watermarkText}
                    onChange={(e) => onUpdate({ watermarkText: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  {watermarkText && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-5 gap-1">
                        {(['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => onUpdate({ watermarkPosition: pos })}
                            className={`p-1.5 text-[10px] rounded ${watermarkPosition === pos ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-400'}`}
                          >
                            {pos === 'top-left' ? '↖' : pos === 'top-right' ? '↗' : pos === 'center' ? '◉' : pos === 'bottom-left' ? '↙' : '↘'}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400">大小</label>
                          <input
                            type="range" min={10} max={48} value={watermarkSize}
                            onChange={(e) => onUpdate({ watermarkSize: Number(e.target.value) })}
                            className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:rounded-full"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">颜色</label>
                          <input type="color" value={watermarkColor} onChange={(e) => onUpdate({ watermarkColor: e.target.value })} className="w-full h-6 rounded cursor-pointer" />
                        </div>
                      </div>
                      <Slider label="透明度" value={watermarkOpacity} defaultValue={80} min={0} max={100} onChange={(v) => onUpdate({ watermarkOpacity: v })} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === 'obscure' && (
              <div className="space-y-1">
                <button onClick={() => { onMosaic?.(); onClose(); }} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50">
                  <Grid3X3 size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-700">马赛克</span>
                </button>
                <button onClick={() => { onBlur?.(); onClose(); }} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50">
                  <CircleDashed size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-700">模糊</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// 生成 CSS filter
export function getImageFilterStyle(item: CanvasItem): React.CSSProperties {
  const exposure = item.exposure ?? 100;
  const brightness = item.brightness ?? 100;
  const contrast = item.contrast ?? 100;
  const saturation = item.saturation ?? 100;
  const filterPreset = item.filter ?? 'none';
  const sharpness = item.sharpness ?? 100;
  const highlights = item.highlights ?? 100;
  const shadows = item.shadows ?? 100;
  const temperature = item.temperature ?? 100;
  const tint = item.tint ?? 100;
  const hue = item.hue ?? 0;
  const texture = item.texture ?? 100;
  const luminanceNoise = item.luminanceNoise ?? 0;
  const colorNoise = item.colorNoise ?? 0;

  // 曝光 (通过亮度和对比度组合模拟)
  const exposureValue = exposure / 100;
  const exposureBrightness = exposureValue;
  const exposureContrast = 1 + (exposure - 100) / 400;

  // 基础滤镜
  let filter = `brightness(${(brightness / 100) * exposureBrightness}) contrast(${(contrast / 100) * exposureContrast}) saturate(${saturation / 100})`;

  // 色相旋转
  if (hue !== 0) {
    filter += ` hue-rotate(${hue}deg)`;
  }

  // 锐化 + 纹理 (通过增加对比度模拟)
  const sharpnessEffect = (sharpness - 100) / 400;
  const textureEffect = (texture - 100) / 400;
  const combinedContrast = 1 + sharpnessEffect + textureEffect;
  if (combinedContrast !== 1) {
    filter += ` contrast(${combinedContrast})`;
  }

  // 高光/阴影 (通过亮度微调模拟)
  if (highlights !== 100 || shadows !== 100) {
    const highlightAdjust = (highlights - 100) / 400;
    const shadowAdjust = (shadows - 100) / 400;
    const brightnessAdjust = 1 + (highlightAdjust + shadowAdjust) / 2;
    filter += ` brightness(${brightnessAdjust})`;
  }

  // 色温 (通过 sepia 和 hue-rotate 模拟)
  if (temperature !== 100) {
    if (temperature > 100) {
      // 暖色调
      const warmth = (temperature - 100) / 200;
      filter += ` sepia(${warmth * 0.3}) saturate(${1 + warmth * 0.2})`;
    } else {
      // 冷色调
      const coolness = (100 - temperature) / 100;
      filter += ` hue-rotate(${coolness * 20}deg) saturate(${1 - coolness * 0.1})`;
    }
  }

  // 色调 (绿-品红，通过 hue-rotate 模拟)
  if (tint !== 100) {
    const tintDegrees = (tint - 100) * 0.5; // -50 到 +50 度
    filter += ` hue-rotate(${tintDegrees}deg)`;
  }

  // 亮度降噪 (通过轻微模糊模拟)
  if (luminanceNoise > 0) {
    const blurAmount = luminanceNoise / 50; // 最大 2px 模糊
    filter += ` blur(${blurAmount}px)`;
  }

  // 颜色降噪 (通过降低饱和度模拟减少彩色噪点)
  if (colorNoise > 0) {
    const desaturate = 1 - (colorNoise / 200); // 最多降低 50% 饱和度
    filter += ` saturate(${desaturate})`;
  }

  // 滤镜预设
  const preset = FILTER_PRESETS.find(p => p.name === filterPreset);
  if (preset && preset.filter) {
    filter += ` ${preset.filter}`;
  }

  return { filter };
}

// 生成边框和阴影样式
export function getImageBorderStyle(item: CanvasItem): React.CSSProperties {
  const style: React.CSSProperties = {};

  const borderWidth = item.imgBorderWidth ?? 0;
  if (borderWidth > 0) {
    style.border = `${borderWidth}px ${item.imgBorderStyle ?? 'solid'} ${item.imgBorderColor ?? '#ffffff'}`;
  }

  if (item.imgShadowEnabled) {
    const x = item.imgShadowX ?? 0;
    const y = item.imgShadowY ?? 4;
    const blur = item.imgShadowBlur ?? 10;
    const color = item.imgShadowColor ?? 'rgba(0,0,0,0.3)';
    style.boxShadow = `${x}px ${y}px ${blur}px ${color}`;
  }

  return style;
}

// 生成晕影/颗粒覆盖层样式
export function getImageOverlayStyle(item: CanvasItem): { vignette: React.CSSProperties | null; grain: React.CSSProperties | null } {
  const vignette = item.vignette ?? 0;
  const grain = item.grain ?? 0;

  return {
    vignette: vignette > 0 ? {
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at center, transparent 0%, transparent ${100 - vignette}%, rgba(0,0,0,${vignette / 100}) 100%)`,
      pointerEvents: 'none',
      borderRadius: 'inherit',
    } : null,
    grain: grain > 0 ? {
      position: 'absolute',
      inset: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      opacity: grain / 200,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
      borderRadius: 'inherit',
    } as React.CSSProperties : null,
  };
}

// 生成旋转/翻转
export function getImageTransformStyle(item: CanvasItem): React.CSSProperties {
  const rotation = item.rotation ?? 0;
  const flipH = item.flipH ?? false;
  const flipV = item.flipV ?? false;

  const transforms: string[] = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipH) transforms.push('scaleX(-1)');
  if (flipV) transforms.push('scaleY(-1)');

  return { transform: transforms.length > 0 ? transforms.join(' ') : undefined };
}
