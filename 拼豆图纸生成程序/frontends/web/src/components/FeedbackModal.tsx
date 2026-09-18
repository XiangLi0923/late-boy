import React, { useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { getAnonymousClientId, trackEvent } from '../engine/analyticsService';

const FeedbackModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const store = useProjectStore();
  const feedbackFormUrl =
    (import.meta.env.VITE_SURVEY_URL as string | undefined) ||
    (import.meta.env.VITE_FEEDBACK_FORM_URL as string | undefined);

  const buildFeedback = (): string => {
    const lines = [
      '阿莉的图 v1.2.2 用户反馈',
      '',
      `页面：${window.location.href}`,
      `时间：${new Date().toISOString()}`,
      `系统：${navigator.platform || '未知'} / ${navigator.userAgent}`,
      `匿名用户：${getAnonymousClientId()}`,
      `网格：${store.gridWidth}×${store.gridHeight}`,
      `色板：${store.selectedPaletteId}`,
      `抖动：${store.ditherMode}`,
      `当前状态：${store.beadGrid ? '已生成图纸' : store.imageLoaded ? '已上传图片' : '未上传图片'}`,
      '',
      '反馈内容：',
      text.trim() || '（未填写）',
    ];
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildFeedback());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      trackEvent('feedback_copied');
    } catch {
      setCopied(false);
    }
  };

  const handleMail = () => {
    const subject = encodeURIComponent('阿莉的图反馈');
    const body = encodeURIComponent(buildFeedback());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    trackEvent('feedback_mail_opened');
  };

  const handleOpenForm = () => {
    if (!feedbackFormUrl) return;
    window.open(feedbackFormUrl, '_blank', 'noopener,noreferrer');
    trackEvent('feedback_form_opened');
  };

  return (
    <>
      <button className="btn btn-small" onClick={() => setOpen(true)}>
        反馈
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
            <h2>产品反馈</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="哪里不好用？还希望增加什么功能？"
              rows={6}
            />
            <div className="modal-actions">
              {feedbackFormUrl && (
                <button className="btn btn-primary" onClick={handleOpenForm}>
                  提交反馈表单
                </button>
              )}
              <button className="btn btn-primary" onClick={handleCopy}>
                {copied ? '已复制' : '复制反馈内容'}
              </button>
              <button className="btn" onClick={handleMail}>
                发送邮件
              </button>
              <button className="btn" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackModal;
