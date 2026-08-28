import { useMemo } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface TaskEvent {
  taskId: string;
  status: string;
  message: string;
  timestamp: number;
}

interface ProgressPanelProps {
  status: string;
  events: TaskEvent[];
  error: string;
  onViewResult: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '等待开始', color: 'text-gray-500' },
  analyzing: { label: '分析商品', color: 'text-blue-500' },
  prompting: { label: '生成创意', color: 'text-blue-500' },
  generating_images: { label: '生成图片', color: 'text-blue-500' },
  generating_video: { label: '生成视频', color: 'text-blue-500' },
  completed: { label: '已完成', color: 'text-green-500' },
  failed: { label: '失败', color: 'text-red-500' },
};

export function ProgressPanel({ status, events, error, onViewResult }: ProgressPanelProps) {
  // 根据事件历史判断是否包含视频步骤
  const hasVideoStep = events.some(e => e.status === 'generating_video');

  const progress = useMemo(() => {
    const steps = hasVideoStep
      ? ['analyzing', 'prompting', 'generating_images', 'generating_video', 'completed']
      : ['analyzing', 'prompting', 'generating_images', 'completed'];
    const idx = steps.indexOf(status);
    if (idx === -1) return 0;
    return Math.min(((idx + 1) / steps.length) * 100, 100);
  }, [status, hasVideoStep]);

  const currentStatus = STATUS_MAP[status] || { label: '处理中', color: 'text-gray-500' };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Title */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900 mb-2">
          {status === 'completed' ? (
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          ) : status === 'failed' ? (
            <AlertCircle className="w-7 h-7 text-red-500" />
          ) : (
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          )}
          <span>
            {status === 'completed'
              ? '素材生成完成！'
              : status === 'failed'
              ? '生成失败'
              : '正在生成素材...'}
          </span>
        </div>
        <p className={`font-medium ${currentStatus.color}`}>{currentStatus.label}</p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>分析</span>
          <span>创意</span>
          <span>图片</span>
          {hasVideoStep && <span>视频</span>}
          <span>完成</span>
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">生成日志</span>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          {events.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">等待开始...</p>
          )}
          {events.map((event, i) => (
            <div
              key={i}
              className={`text-sm px-3 py-2 rounded-lg flex items-start gap-2
                ${event.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}
              `}
            >
              <span className="text-xs text-gray-400 mt-0.5 shrink-0">
                {new Date(event.timestamp).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span>{event.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      {status === 'completed' && (
        <div className="flex justify-center">
          <button
            onClick={onViewResult}
            className="inline-flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl font-medium text-lg
              hover:bg-green-700 active:bg-green-800 transition-colors shadow-lg shadow-green-200"
          >
            <Sparkles className="w-5 h-5" />
            查看结果
          </button>
        </div>
      )}
    </div>
  );
}
