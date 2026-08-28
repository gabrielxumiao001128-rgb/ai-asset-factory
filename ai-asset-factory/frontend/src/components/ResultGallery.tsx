import { useState } from 'react';
import { assetUrl } from '../lib/api';
import { Download, ImageIcon, Film, RotateCcw, Tag, Palette, Box, FileText, Copy, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface GeneratedImage {
  url: string;
  localPath: string;
  promptUsed: string;
  sceneName: string;
}

interface GeneratedVideo {
  url: string;
  localPath: string;
  duration: number;
}

interface ProductInfo {
  category: string;
  material: string;
  color: string;
  shape: string;
  sellingPoints: string[];
  keywords: string[];
}

interface CopywritingSet {
  shortTitle: string;
  longTitle: string;
  bullets: string[];
  sceneCopy: Record<string, string>;
  xiaohongshu: string;
  douyin: string;
}

interface TaskResult {
  taskId: string;
  status: string;
  productInfo?: ProductInfo;
  copywriting?: CopywritingSet;
  images: GeneratedImage[];
  video?: GeneratedVideo;
  originalImageUrl: string;
}

interface ResultGalleryProps {
  result: TaskResult;
  onReset: () => void;
}

export function ResultGallery({ result, onReset }: ResultGalleryProps) {
  const { productInfo, copywriting, images, video, originalImageUrl } = result;
  const [copiedField, setCopiedField] = useState<string>('');
  const [showSocial, setShowSocial] = useState(true);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const sceneNameMap: Record<string, string> = {
    '家居生活': 'bg-orange-50 text-orange-700 border-orange-200',
    '户外场景': 'bg-green-50 text-green-700 border-green-200',
    '简约白底': 'bg-gray-50 text-gray-700 border-gray-200',
    '创意特写': 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          素材生成完成
        </h2>
        <p className="text-gray-500">
          共生成 {copywriting ? '文案 + ' : ''}{images.length} 张场景图{video ? ' + 1 个短视频' : ''}
        </p>
      </div>

      {/* Product Info */}
      {productInfo && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-500" />
            AI 识别结果
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem icon={<Box className="w-4 h-4" />} label="品类" value={productInfo.category} />
            <InfoItem icon={<Palette className="w-4 h-4" />} label="颜色" value={productInfo.color} />
            <InfoItem icon={<Box className="w-4 h-4" />} label="材质" value={productInfo.material} />
            <InfoItem icon={<Box className="w-4 h-4" />} label="外形" value={productInfo.shape} />
          </div>
          {productInfo.sellingPoints.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {productInfo.sellingPoints.map((point, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium"
                >
                  {point}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Copywriting */}
      {copywriting && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            AI 营销文案
          </h3>

          {/* Titles */}
          <div className="space-y-3 mb-4">
            <CopyField
              label="短标题"
              text={copywriting.shortTitle}
              onCopy={() => handleCopy(copywriting.shortTitle, 'shortTitle')}
              copied={copiedField === 'shortTitle'}
            />
            <CopyField
              label="长标题"
              text={copywriting.longTitle}
              onCopy={() => handleCopy(copywriting.longTitle, 'longTitle')}
              copied={copiedField === 'longTitle'}
            />
          </div>

          {/* Bullets */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">卖点文案</p>
            <div className="space-y-2">
              {copywriting.bullets.map((bullet, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 bg-white/60 rounded-lg px-3 py-2"
                >
                  <span className="text-xs text-blue-500 font-bold mt-0.5">{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1">{bullet}</span>
                  <button
                    onClick={() => handleCopy(bullet, `bullet-${i}`)}
                    className="text-gray-300 hover:text-blue-500 transition-colors shrink-0"
                  >
                    {copiedField === `bullet-${i}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Social Media Copy */}
          <div className="border-t border-blue-200/50 pt-4">
            <button
              onClick={() => setShowSocial(!showSocial)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                社交媒体文案
              </span>
              {showSocial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showSocial && (
              <div className="mt-3 space-y-3">
                <CopyBlock
                  label="小红书"
                  text={copywriting.xiaohongshu}
                  onCopy={() => handleCopy(copywriting.xiaohongshu, 'xiaohongshu')}
                  copied={copiedField === 'xiaohongshu'}
                />
                <CopyBlock
                  label="抖音"
                  text={copywriting.douyin}
                  onCopy={() => handleCopy(copywriting.douyin, 'douyin')}
                  copied={copiedField === 'douyin'}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Original Image */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">原图</h3>
        <img
          src={assetUrl(originalImageUrl)}
          alt="原图"
          className="max-h-48 rounded-lg object-contain"
        />
      </div>

      {/* Images Grid */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-500" />
          场景图
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {images.map((img, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-square bg-gray-50">
                <img
                  src={assetUrl(img.url)}
                  alt={img.sceneName}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      sceneNameMap[img.sceneName] || 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    {img.sceneName}
                  </span>
                  <button
                    onClick={() => handleDownload(assetUrl(img.url), `${img.sceneName}.png`)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                {/* 场景配文 */}
                {copywriting?.sceneCopy?.[img.sceneName] ? (
                  <div className="flex items-start gap-2 bg-blue-50/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-600 flex-1">{copywriting.sceneCopy[img.sceneName]}</p>
                    <button
                      onClick={() => handleCopy(copywriting.sceneCopy[img.sceneName], `scene-${i}`)}
                      className="text-gray-300 hover:text-blue-500 transition-colors shrink-0"
                    >
                      {copiedField === `scene-${i}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 line-clamp-2">{img.promptUsed}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Video */}
      {video && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Film className="w-5 h-5 text-blue-500" />
            商品视频
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <video
              src={assetUrl(video.url)}
              controls
              className="w-full max-h-96 bg-black"
              poster={assetUrl(images[0]?.url)}
            />
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                时长: {video.duration} 秒
              </span>
              <button
                onClick={() => handleDownload(assetUrl(video.url), 'product-video.mp4')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg
                  hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                下载视频
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl
            font-medium hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          生成新素材
        </button>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function CopyField({
  label,
  text,
  onCopy,
  copied,
}: {
  label: string;
  text: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/60 rounded-lg px-3 py-2">
      <span className="text-xs text-gray-500 shrink-0 w-14">{label}</span>
      <span className="text-sm text-gray-800 flex-1 font-medium">{text}</span>
      <button
        onClick={onCopy}
        className="text-gray-300 hover:text-blue-500 transition-colors shrink-0"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function CopyBlock({
  label,
  text,
  onCopy,
  copied,
}: {
  label: string;
  text: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="bg-white/60 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <button
          onClick={onCopy}
          className="text-gray-300 hover:text-blue-500 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}
