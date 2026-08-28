import { useState, useCallback } from 'react';
import { UploadArea } from './components/UploadArea';
import { ProgressPanel } from './components/ProgressPanel';
import { ResultGallery } from './components/ResultGallery';
import { HistoryPanel } from './components/HistoryPanel';
import { useTask } from './hooks/useTask';
import { apiUrl } from './lib/api';
import { Clock, ImageIcon } from 'lucide-react';

type Page = 'upload' | 'progress' | 'result' | 'history';

export default function App() {
  const [page, setPage] = useState<Page>('upload');
  const [taskId, setTaskId] = useState<string>('');
  const [isHistoryView, setIsHistoryView] = useState(false);
  const { status, events, result, error } = useTask(taskId, isHistoryView);

  const handleStart = useCallback((id: string) => {
    setIsHistoryView(false);
    setTaskId(id);
    setPage('progress');
  }, []);

  const handleViewResult = useCallback(() => {
    setPage('result');
  }, []);

  const handleReset = useCallback(() => {
    setTaskId('');
    setIsHistoryView(false);
    setPage('upload');
  }, []);

  const handleViewHistory = useCallback(() => {
    setPage('history');
  }, []);

  const handleViewTask = useCallback((id: string) => {
    setIsHistoryView(true);
    setTaskId(id);
    setPage('result');
  }, []);

  const handleRegenerate = useCallback(async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/history/${id}/regenerate`), { method: 'POST' });
      const data = await res.json();
      if (data.taskId) {
        setIsHistoryView(false);
        setTaskId(data.taskId);
        setPage('progress');
      } else {
        alert(data.error || '重新生成失败');
      }
    } catch (e: any) {
      alert('请求失败: ' + e.message);
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">营销素材工厂</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleViewHistory}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5
                ${page === 'history'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <Clock className="w-4 h-4" />
              我的作品
            </button>
            {page !== 'upload' && page !== 'history' && (
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                重新开始
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {page === 'upload' && <UploadArea onStart={handleStart} />}

        {page === 'progress' && (
          <ProgressPanel
            status={status}
            events={events}
            error={error}
            onViewResult={handleViewResult}
          />
        )}

        {page === 'result' && result && (
          <ResultGallery
            result={result}
            onReset={handleReset}
          />
        )}

        {page === 'history' && (
          <HistoryPanel
            onViewTask={handleViewTask}
            onRegenerate={handleRegenerate}
            onBack={handleReset}
          />
        )}
      </main>
    </div>
  );
}
