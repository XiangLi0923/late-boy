import React from 'react';
import { useProjectStore } from '../stores/projectStore';

const TaskOverlay: React.FC = () => {
  const taskMessage = useProjectStore((s) => s.taskMessage);
  if (!taskMessage) return null;

  return (
    <div className="task-overlay" role="status" aria-live="polite">
      <div className="task-overlay-card">
        <div className="task-spinner" aria-hidden="true" />
        <p className="task-message">{taskMessage}</p>
        <p className="task-hint">请保持窗口打开，不要重复点击</p>
      </div>
    </div>
  );
};

export default TaskOverlay;
