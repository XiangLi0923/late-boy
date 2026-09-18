import React, { useCallback, useEffect, useState } from 'react';
import { isWeChat, isIOS } from '../engine/wechatEnv';
import { trackEvent } from '../engine/analyticsService';

/**
 * 微信环境守卫：
 * 1. 在微信内打开网页时，全屏引导用户「右上角 ··· → 用浏览器打开」
 * 2. 导出图纸被拦截时（openWeChatGuard('export')），再次弹出并说明原因
 * 3. 底部保留「仍要浏览」入口（查看分享图纸在微信内仍可用）
 */
const DISMISS_KEY = 'wechat_guard_dismissed';

const WeChatGuard: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<'enter' | 'export'>('enter');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isWeChat()) return;

    // 进入页面时：本会话未关闭过则自动弹出
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    if (!dismissed) {
      setVisible(true);
      setReason('enter');
      trackEvent('wechat_guard_shown', { reason: 'enter' });
    }

    // 导出被拦截时：强制再次弹出
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setReason(detail.reason === 'export' ? 'export' : 'enter');
      setVisible(true);
      setCopied(false);
      trackEvent('wechat_guard_shown', { reason: detail.reason || 'enter' });
    };
    window.addEventListener('wechat-guard-open', onOpen);
    return () => window.removeEventListener('wechat-guard-open', onOpen);
  }, []);

  const handleCopy = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 降级方案：老 WebView 无 clipboard API
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    trackEvent('wechat_guard_link_copied');
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
    trackEvent('wechat_guard_dismissed');
  }, []);

  if (!visible) return null;

  const ios = isIOS();

  return (
    <div className="wechat-guard-overlay">
      {/* 指向右上角 ··· 菜单的箭头 */}
      <div className="wechat-guard-arrow" aria-hidden="true">
        <svg viewBox="0 0 100 120" width="86" height="103">
          <path
            d="M78 108 L30 34"
            stroke="#ffd43b"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M22 22 L42 30 L28 44 Z"
            fill="#ffd43b"
          />
        </svg>
        <span className="wechat-guard-arrow-dot">···</span>
      </div>

      <div className="wechat-guard-card">
        <div className="wechat-guard-icon">🌐</div>

        {reason === 'export' ? (
          <>
            <h2>导出图纸需要浏览器</h2>
            <p className="wechat-guard-desc">
              微信内无法下载文件，请在浏览器中打开本页面后再导出。
            </p>
          </>
        ) : (
          <>
            <h2>请在浏览器中打开</h2>
            <p className="wechat-guard-desc">
              微信内无法下载图纸文件，使用浏览器打开后即可正常导出。
            </p>
          </>
        )}

        <div className="wechat-guard-steps">
          <div className="wechat-guard-step">
            <span className="wechat-guard-step-num">1</span>
            <span>点击右上角 <strong>···</strong> 菜单</span>
          </div>
          <div className="wechat-guard-step">
            <span className="wechat-guard-step-num">2</span>
            <span>
              选择「<strong>{ios ? '在 Safari 中打开' : '在浏览器打开'}</strong>」
            </span>
          </div>
          <div className="wechat-guard-step">
            <span className="wechat-guard-step-num">3</span>
            <span>上传图片 → 生成图纸 → 导出下载</span>
          </div>
        </div>

        <button className="btn btn-primary wechat-guard-copy" onClick={handleCopy}>
          {copied ? '✅ 链接已复制' : '📋 复制链接（可粘贴到浏览器）'}
        </button>

        <button className="wechat-guard-dismiss" onClick={handleDismiss}>
          仍要继续浏览（仅预览，不能导出）
        </button>
      </div>
    </div>
  );
};

export default WeChatGuard;
