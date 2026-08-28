import { useState, useRef, useCallback } from 'react';
import { apiUrl } from '../lib/api';
import { Upload, Link, ImageIcon, Film, Sparkles, Loader2, Home, TreePine, Square, Aperture, Plus, X, AlertCircle, Monitor, Smartphone, LayoutGrid, Maximize, Palette, Copy, Wand2 } from 'lucide-react';

type GenerateMode = 'images' | 'video' | 'all';
type SizeOption = '1024*1024' | '1024*1365' | '1365*1024' | '1024*1792' | '1792*1024';
type ArtStyle = 'realistic' | 'watercolor' | 'oil_painting' | 'sketch' | 'cyberpunk' | 'ink_wash' | 'minimalist' | 'festive';
type CopyStyle = 'selling' | 'emotional' | 'functional' | 'promotional';

interface ReferenceAnalysis {
  scene: string;
  style: ArtStyle;
  size: SizeOption;
  lighting: string;
  composition: string;
  description: string;
  recommendedScenes: string[];
}

interface SceneSelection {
  type: 'preset' | 'custom';
  name?: string;
  description?: string;
}

interface UploadAreaProps {
  onStart: (taskId: string) => void;
}

const MODE_OPTIONS: { value: GenerateMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'images', label: '仅图片', desc: '生成场景图', icon: <ImageIcon className="w-5 h-5" /> },
  { value: 'video', label: '仅视频', desc: '生成商品短视频', icon: <Film className="w-5 h-5" /> },
  { value: 'all', label: '图片+视频', desc: '全套营销素材', icon: <Sparkles className="w-5 h-5" /> },
];

const PRESET_SCENES = [
  { name: '家居生活', icon: <Home className="w-5 h-5" /> },
  { name: '户外场景', icon: <TreePine className="w-5 h-5" /> },
  { name: '简约白底', icon: <Square className="w-5 h-5" /> },
  { name: '创意特写', icon: <Aperture className="w-5 h-5" /> },
];

const SIZE_OPTIONS: { value: SizeOption; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: '1024*1024', label: '1:1 正方形', desc: '淘宝/拼多多主图', icon: <LayoutGrid className="w-4 h-4" /> },
  { value: '1024*1365', label: '3:4 竖版', desc: '小红书/京东', icon: <Smartphone className="w-4 h-4" /> },
  { value: '1365*1024', label: '4:3 横版', desc: '详情页/Banner', icon: <Monitor className="w-4 h-4" /> },
  { value: '1024*1792', label: '9:16 竖版', desc: '抖音/视频号', icon: <Smartphone className="w-4 h-4" /> },
  { value: '1792*1024', label: '16:9 横版', desc: '淘宝Banner/海报', icon: <Maximize className="w-4 h-4" /> },
];

const STYLE_OPTIONS: { value: ArtStyle; label: string; emoji: string }[] = [
  { value: 'realistic', label: '写实', emoji: '📷' },
  { value: 'watercolor', label: '水彩', emoji: '🎨' },
  { value: 'oil_painting', label: '油画', emoji: '🖼️' },
  { value: 'sketch', label: '素描', emoji: '✏️' },
  { value: 'cyberpunk', label: '赛博朋克', emoji: '🌃' },
  { value: 'ink_wash', label: '水墨', emoji: '🏔️' },
  { value: 'minimalist', label: '极简', emoji: '⬜' },
  { value: 'festive', label: '节日', emoji: '🎉' },
];

const COPY_STYLE_OPTIONS: { value: CopyStyle; label: string; desc: string; emoji: string }[] = [
  { value: 'selling', label: '卖点型', desc: '突出核心卖点', emoji: '🎯' },
  { value: 'emotional', label: '情感型', desc: '故事场景共鸣', emoji: '💖' },
  { value: 'functional', label: '功能型', desc: '专业功能说明', emoji: '⚙️' },
  { value: 'promotional', label: '促销型', desc: '紧迫感促下单', emoji: '🔥' },
];

const PRODUCT_WORDS = ['保温杯', '杯子', '水瓶', '瓶子', '商品', '产品', '物品'];

export function UploadArea({ onStart }: UploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<GenerateMode>('all');
  const [size, setSize] = useState<SizeOption>('1024*1024');
  const [style, setStyle] = useState<ArtStyle>('realistic');
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [customScenes, setCustomScenes] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState('');
  const [copyStyle, setCopyStyle] = useState<CopyStyle | null>(null);
  const [loading, setLoading] = useState(false);
  const [refDragActive, setRefDragActive] = useState(false);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
  const [refImageUrl, setRefImageUrl] = useState('');
  const [analyzingRef, setAnalyzingRef] = useState(false);
  const [refAnalysis, setRefAnalysis] = useState<ReferenceAnalysis | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleRefFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    const url = URL.createObjectURL(f);
    setRefPreviewUrl(url);
    setRefFile(f);
    setRefImageUrl('');
    setRefAnalysis(null);
  };

  const handleRefDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setRefDragActive(true);
    } else if (e.type === 'dragleave') {
      setRefDragActive(false);
    }
  }, []);

  const handleRefDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRefDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleRefFile(e.dataTransfer.files[0]);
    }
  }, []);

  const analyzeReference = async () => {
    if (!refPreviewUrl) return;
    setAnalyzingRef(true);
    try {
      let res: Response;
      if (refFile) {
        const formData = new FormData();
        formData.append('file', refFile);
        res = await fetch(apiUrl('/api/analyze-reference'), {
          method: 'POST',
          body: formData,
        });
      } else if (refImageUrl) {
        res = await fetch(apiUrl('/api/analyze-reference'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: refImageUrl }),
        });
      } else {
        return;
      }
      const data = await res.json();
      if (data.analysis) {
        setRefAnalysis(data.analysis);
        // 自动填充配置
        setStyle(data.analysis.style);
        setSize(data.analysis.size);
      } else {
        alert(data.error || '分析失败');
      }
    } catch (e: any) {
      alert('分析请求失败: ' + e.message);
    } finally {
      setAnalyzingRef(false);
    }
  };

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setFile(f);
    setImageUrl('');
  };

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    setPreviewUrl(url || null);
  };

  const togglePreset = (name: string) => {
    setSelectedPresets(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addCustomScene = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const hasProductWord = PRODUCT_WORDS.some(w => trimmed.includes(w));
    if (hasProductWord) {
      setCustomError('场景描述请不要包含商品名称，只描述背景环境');
      return;
    }
    setCustomError('');
    setCustomScenes(prev => [...prev, trimmed]);
    setCustomInput('');
  };

  const removeCustomScene = (index: number) => {
    setCustomScenes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!previewUrl) return;

    setLoading(true);
    try {
      let scenes: SceneSelection[] = [];
      for (const name of selectedPresets) {
        scenes.push({ type: 'preset', name });
      }
      for (const desc of customScenes) {
        scenes.push({ type: 'custom', description: desc });
      }
      const pendingCustom = customInput.trim();
      if (pendingCustom) {
        const hasProductWord = PRODUCT_WORDS.some(w => pendingCustom.includes(w));
        if (!hasProductWord) {
          scenes.push({ type: 'custom', description: pendingCustom });
        }
      }
      // 视频模式只取第一个场景
      if (mode === 'video' && scenes.length > 1) {
        scenes = [scenes[0]];
      }

      let res: Response;
      if (imageUrl) {
        res = await fetch(apiUrl('/api/generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, mode, scenes, size, style, copyStyle }),
        });
      } else if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', mode);
        formData.append('size', size);
        formData.append('style', style);
        if (copyStyle) {
          formData.append('copyStyle', copyStyle);
        }
        if (scenes.length > 0) {
          formData.append('scenes', JSON.stringify(scenes));
        }
        res = await fetch(apiUrl('/api/generate'), {
          method: 'POST',
          body: formData,
        });
      } else {
        alert('请先选择图片');
        return;
      }

      const data = await res.json();
      if (data.taskId) {
        onStart(data.taskId);
      } else {
        alert(data.error || '生成失败');
      }
    } catch (e: any) {
      alert('请求失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const hasSelection = selectedPresets.size > 0 || customScenes.length > 0 || customInput.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          AI 商品营销素材一键生成
        </h2>
        <p className="text-gray-500 max-w-lg mx-auto">
          上传一张商品图，AI 自动识别商品信息，生成多场景营销图和短视频
        </p>
      </div>

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}
          ${previewUrl ? 'py-6' : 'py-12'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {previewUrl ? (
          <div className="flex flex-col items-center gap-4">
            <img
              src={previewUrl}
              alt="预览"
              className="max-h-64 rounded-lg shadow-sm object-contain"
            />
            <p className="text-sm text-gray-500">点击或拖拽更换图片</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <Upload className="w-7 h-7 text-blue-600" />
            </div>
            <p className="text-lg font-medium text-gray-700">
              拖拽图片到此处，或点击上传
            </p>
            <p className="text-sm text-gray-400">
              支持 JPG、PNG、WebP 格式
            </p>
          </div>
        )}
      </div>

      {/* Or use URL */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="flex items-center gap-2 mb-3 text-gray-700">
          <Link className="w-4 h-4" />
          <span className="text-sm font-medium">或使用图片链接</span>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/product.jpg"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {imageUrl && (
            <button
              onClick={() => { setImageUrl(''); setPreviewUrl(null); }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Reference Image Upload (Optional - for image replication) */}
      {previewUrl && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-5 border border-purple-200">
          <div className="flex items-center gap-2 mb-3 text-gray-700">
            <Copy className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">复刻参考（可选）</span>
            <span className="text-xs text-gray-400">上传参考图，AI 自动分析视觉风格</span>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer
              ${refDragActive ? 'border-purple-500 bg-purple-50' : 'border-purple-200 bg-white hover:border-purple-400'}
              ${refPreviewUrl ? 'py-3' : 'py-8'}
            `}
            onDragEnter={handleRefDrag}
            onDragLeave={handleRefDrag}
            onDragOver={handleRefDrag}
            onDrop={handleRefDrop}
            onClick={() => refInputRef.current?.click()}
          >
            <input
              ref={refInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleRefFile(e.target.files[0])}
            />

            {refPreviewUrl ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={refPreviewUrl}
                  alt="参考图预览"
                  className="max-h-32 rounded-lg shadow-sm object-contain"
                />
                <p className="text-xs text-gray-500">点击或拖拽更换参考图</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Copy className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-600">
                  上传参考图，复刻视觉风格
                </p>
                <p className="text-xs text-gray-400">AI 会自动分析场景、风格、尺寸</p>
              </div>
            )}
          </div>

          {/* Reference URL input */}
          {!refPreviewUrl && (
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={refImageUrl}
                onChange={(e) => {
                  setRefImageUrl(e.target.value);
                  setRefPreviewUrl(e.target.value || null);
                  setRefFile(null);
                  setRefAnalysis(null);
                }}
                placeholder="或输入参考图链接 https://..."
                className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          )}

          {/* Analyze button */}
          {refPreviewUrl && !refAnalysis && (
            <button
              onClick={analyzeReference}
              disabled={analyzingRef}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium
                hover:bg-purple-700 transition-colors disabled:opacity-60"
            >
              {analyzingRef ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在分析视觉风格...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  分析参考图风格
                </>
              )}
            </button>
          )}

          {/* Analysis Results */}
          {refAnalysis && (
            <div className="mt-3 bg-white rounded-lg p-4 border border-purple-200 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-purple-700 mb-2">
                <Wand2 className="w-4 h-4" />
                AI 风格分析结果
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-purple-50 rounded-lg p-2">
                  <p className="text-gray-400">场景</p>
                  <p className="font-medium text-gray-700">{refAnalysis.scene}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <p className="text-gray-400">光照</p>
                  <p className="font-medium text-gray-700">{refAnalysis.lighting}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <p className="text-gray-400">构图</p>
                  <p className="font-medium text-gray-700">{refAnalysis.composition}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <p className="text-gray-400">推荐风格</p>
                  <p className="font-medium text-gray-700">{STYLE_OPTIONS.find(s => s.value === refAnalysis.style)?.label || refAnalysis.style}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <p className="text-gray-400">推荐尺寸</p>
                  <p className="font-medium text-gray-700">{SIZE_OPTIONS.find(s => s.value === refAnalysis.size)?.label || refAnalysis.size}</p>
                </div>
              </div>
              {refAnalysis.recommendedScenes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                  <span className="text-xs text-gray-400">推荐场景（点击追加描述）:</span>
                  {refAnalysis.recommendedScenes.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCustomInput(prev => {
                          const sep = prev.trim() ? '，' : '';
                          return prev.trim() + sep + s;
                        });
                      }}
                      className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full cursor-pointer hover:bg-purple-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400 pt-1">
                已自动填充风格和尺寸，你可以在下方调整
              </p>
            </div>
          )}

          {/* Clear reference */}
          {refPreviewUrl && (
            <button
              onClick={() => {
                setRefPreviewUrl(null);
                setRefFile(null);
                setRefImageUrl('');
                setRefAnalysis(null);
              }}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              清除参考图
            </button>
          )}
        </div>
      )}

      {/* Mode Selection */}
      {previewUrl && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">选择生成内容</p>
          <div className="grid grid-cols-3 gap-3">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                  ${mode === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }
                `}
              >
                {opt.icon}
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Art Style Selection */}
      {previewUrl && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            选择艺术风格
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStyle(opt.value)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all
                  ${style === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }
                `}
              >
                <span className="text-lg">{opt.emoji}</span>
                <span className="text-[11px] font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Copywriting Style Selection */}
      {previewUrl && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Copy className="w-4 h-4 text-blue-500" />
            文案风格（可选）
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COPY_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCopyStyle(copyStyle === opt.value ? null : opt.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all
                  ${copyStyle === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }
                `}
              >
                <span className="text-lg">{opt.emoji}</span>
                <span className="text-xs font-medium">{opt.label}</span>
                <span className="text-[10px] opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size Selection */}
      {previewUrl && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">选择输出尺寸</p>
            {mode === 'video' && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                视频固定竖版输出
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {SIZE_OPTIONS.map((opt) => {
              const isVideoDisabled = mode === 'video' && opt.value !== '1024*1792';
              return (
                <button
                  key={opt.value}
                  onClick={() => !isVideoDisabled && setSize(opt.value)}
                  disabled={isVideoDisabled}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all
                    ${size === opt.value && !isVideoDisabled
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : isVideoDisabled
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }
                  `}
                >
                  {opt.icon}
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scene Selection */}
      {previewUrl && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-1">选择场景</p>
          <p className="text-xs text-gray-400 mb-3">
            {mode === 'video' ? '选择1个场景作为视频背景' : '不选则默认生成全部 4 个场景'}
          </p>

          {/* Preset Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {PRESET_SCENES.map((scene) => {
              const selected = selectedPresets.has(scene.name);
              return (
                <button
                  key={scene.name}
                  onClick={() => togglePreset(scene.name)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all
                    ${selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }
                  `}
                >
                  {scene.icon}
                  <span className="text-xs font-medium">{scene.name}</span>
                  {selected && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                </button>
              );
            })}
          </div>

          {/* Custom Scene Input */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">自定义场景</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  setCustomError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && addCustomScene()}
                placeholder="例如：在月球表面，星空背景，科幻风格"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addCustomScene}
                disabled={!customInput.trim()}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium
                  hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {customError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                <AlertCircle className="w-3.5 h-3.5" />
                {customError}
              </div>
            )}

            {/* Custom Scene Tags */}
            {customScenes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {customScenes.map((scene, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium"
                  >
                    {scene}
                    <button
                      onClick={() => removeCustomScene(i)}
                      className="hover:text-purple-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Selection Summary */}
          {hasSelection && (
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
              {mode === 'video' ? (
                <>已选场景将用于生成视频</>
              ) : (
                <>
                  已选 {selectedPresets.size} 个预设场景
                  {customScenes.length > 0 && ` + ${customScenes.length} 个自定义场景`}
                  ，将生成 {selectedPresets.size + customScenes.length} 张图
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      {previewUrl && (
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-medium text-lg
              hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed
              shadow-lg shadow-blue-200"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在启动...
              </>
            ) : (
              <>
                {MODE_OPTIONS.find(o => o.value === mode)?.icon}
                开始生成{MODE_OPTIONS.find(o => o.value === mode)?.label}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
