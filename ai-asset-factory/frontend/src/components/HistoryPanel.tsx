import { useState, useEffect } from 'react';
import { apiUrl, assetUrl } from '../lib/api';
import { Clock, ImageIcon, Film, ArrowRight, RotateCcw } from 'lucide-react';

interface HistoryEntry {
  taskId: string;
  originalImageUrl: string;
  productInfo?: {
    category: string;
    color: string;
    material: string;
  };
  scenes?: any[];
  mode?: string;
  size?: string;
  imageCount: number;
  hasVideo: boolean;
  thumbnailUrl?: string;
  createdAt: number;
  completedAt?: number;
  status: string;
}

interface HistoryPanelProps {
  onViewTask: (taskId: string) => void;
  onRegenerate: (taskId: string) => void;
  onBack: () => void;
}

const SIZE_LABELS: Record<string, string> = {
  '1024*1024': '1:1',
  '1024*1365': '3:4',
  '1365*1024': '4:3',
  '1024*1792': '9:16',
  '1792*1024': '16:9',
};

export function HistoryPanel({ onViewTask, onRegenerate, onBack }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/history'))
      .then(r => r.json())
      .then(data => {
        setHistory(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-gray-900">我的作品</h2>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          返回上传
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">暂无历史记录</p>
          <p className="text-sm text-gray-400 mt-1">上传商品图开始生成素材吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((entry) => (
            <div
              key={entry.taskId}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden group
                hover:shadow-lg hover:border-blue-300 transition-all"
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-gray-50">
                {entry.thumbnailUrl ? (
                  <img
                    src={assetUrl(entry.thumbnailUrl)}
                    alt="缩略图"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {entry.imageCount > 0 && (
                    <span className="px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {entry.imageCount}
                    </span>
                  )}
                  {entry.hasVideo && (
                    <span className="px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      视频
                    </span>
                  )}
                </div>

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors
                  flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => onViewTask(entry.taskId)}
                    className="px-4 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium
                      hover:bg-gray-50 transition-colors"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => onRegenerate(entry.taskId)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                      hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    重新生成
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{formatDate(entry.createdAt)}</span>
                  {entry.size && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      {SIZE_LABELS[entry.size] || entry.size}
                    </span>
                  )}
                </div>
                {entry.productInfo && (
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {entry.productInfo.category}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {entry.productInfo && (
                    <>
                      <span>{entry.productInfo.color}</span>
                      <span>·</span>
                      <span>{entry.productInfo.material}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => onViewTask(entry.taskId)}
                    className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                  >
                    查看详情
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onRegenerate(entry.taskId)}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
