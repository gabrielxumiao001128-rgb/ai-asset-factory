import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '../lib/api';

interface TaskEvent {
  taskId: string;
  status: string;
  message: string;
  timestamp: number;
}

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

interface TaskResult {
  taskId: string;
  status: string;
  productInfo?: ProductInfo;
  images: GeneratedImage[];
  video?: GeneratedVideo;
  originalImageUrl: string;
  error?: string;
}

export function useTask(taskId: string, isHistory: boolean = false) {
  const [status, setStatus] = useState<string>(isHistory ? '' : 'pending');
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string>('');
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!taskId) return;

    // 重置状态
    setStatus(isHistory ? '' : 'pending');
    setEvents([]);
    setResult(null);
    setError('');

    // 统一的 fetchResult 函数
    const fetchResult = async (id: string) => {
      try {
        const res = await fetch(apiUrl(`/api/tasks/${id}`));
        const data: TaskResult = await res.json();
        setResult(data);
        setStatus(data.status);
        if (data.error) setError(data.error);
      } catch (e: any) {
        setError('获取结果失败: ' + e.message);
      }
    };

    // 历史记录查看：直接 fetch，不走 SSE
    if (isHistory) {
      fetchResult(taskId);
      return;
    }

    // 新任务：启动 SSE
    const sse = new EventSource(apiUrl(`/api/tasks/${taskId}/events`));
    sseRef.current = sse;

    sse.onmessage = (e) => {
      try {
        const event: TaskEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
        setStatus(event.status);

        if (event.status === 'completed' || event.status === 'failed') {
          sse.close();
          fetchResult(taskId);
        }
      } catch {
        // ignore parse error
      }
    };

    sse.onerror = () => {
      sse.close();
      startPolling(taskId);
    };

    const startPolling = (id: string) => {
      if (pollRef.current) return;
      const poll = () => {
        fetch(apiUrl(`/api/tasks/${id}`))
          .then((r) => r.json())
          .then((data: TaskResult) => {
            setStatus(data.status);
            if (data.status === 'completed' || data.status === 'failed') {
              setResult(data);
              if (data.error) setError(data.error);
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
            }
          })
          .catch(() => {
            // ignore
          });
      };
      pollRef.current = window.setInterval(poll, 3000);
      poll();
    };

    return () => {
      sse.close();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [taskId, isHistory]);

  return { status, events, result, error };
}
