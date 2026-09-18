import React, { useCallback, useEffect, useState } from 'react';
import { applyProjectToStore, normalizeProjectJSON } from '../engine/projectIO';
import {
  clearHistory,
  deleteHistoryItem,
  listHistory,
  toggleHistoryFavorite,
  type HistoryItem,
} from '../engine/historyService';
import { trackEvent } from '../engine/analyticsService';

interface Props {
  onOpen: () => void;
}

const ProjectHistoryPanel: React.FC<Props> = ({ onOpen }) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  const refresh = useCallback(() => setItems(listHistory()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleOpen = useCallback((item: HistoryItem) => {
    const project = normalizeProjectJSON(item.project);
    if (!project) return;
    applyProjectToStore(project);
    trackEvent('history_opened', { gridWidth: item.gridWidth, gridHeight: item.gridHeight });
    onOpen();
  }, [onOpen]);

  const handleFavorite = useCallback((id: string) => {
    toggleHistoryFavorite(id);
    trackEvent('history_favorite_toggled', { id });
    refresh();
  }, [refresh]);

  const handleDelete = useCallback((id: string) => {
    deleteHistoryItem(id);
    trackEvent('history_deleted', { id });
    refresh();
  }, [refresh]);

  const handleClear = useCallback(() => {
    if (window.confirm('确定清空全部历史记录吗？')) {
      clearHistory();
      refresh();
    }
  }, [refresh]);

  const filtered = filter === 'favorites' ? items.filter((item) => item.favorite) : items;

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2>生成历史</h2>
        <div className="history-actions">
          <button
            className={`btn btn-small ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button
            className={`btn btn-small ${filter === 'favorites' ? 'active' : ''}`}
            onClick={() => setFilter('favorites')}
          >
            收藏
          </button>
          <button className="btn btn-small" onClick={handleClear}>
            清空
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="history-empty">
          <p>还没有保存的图纸</p>
          <p className="hint">生成图纸后会自动出现在这里</p>
        </div>
      ) : (
        <div className="history-list">
          {filtered.map((item) => (
            <div key={item.id} className="history-card">
              {item.thumbnail && (
                <img className="history-thumb" src={item.thumbnail} alt={item.title} />
              )}
              <div className="history-info">
                <div className="history-title">{item.title}</div>
                <div className="history-meta">
                  {item.gridWidth}×{item.gridHeight} · {item.usedColors} 色 · {item.paletteBrand}
                </div>
                <div className="history-time">
                  {new Date(item.savedAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="history-card-actions">
                <button
                  className={`btn btn-small ${item.favorite ? 'active' : ''}`}
                  onClick={() => handleFavorite(item.id)}
                  title={item.favorite ? '取消收藏' : '收藏'}
                >
                  {item.favorite ? '★' : '☆'}
                </button>
                <button className="btn btn-small" onClick={() => handleOpen(item)}>
                  打开
                </button>
                <button className="btn btn-small" onClick={() => handleDelete(item.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectHistoryPanel;
