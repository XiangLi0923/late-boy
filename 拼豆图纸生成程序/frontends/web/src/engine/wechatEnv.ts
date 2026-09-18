/**
 * 微信内嵌浏览器环境检测
 *
 * 微信 WebView（UA 含 MicroMessenger）会拦截 blob: 下载，
 * 导出图纸（PNG/PDF/CSV/JSON）必须在外部浏览器中进行。
 */

/** 当前是否运行在微信内置浏览器中 */
export function isWeChat(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

/** 是否 iOS（微信内 iOS 与安卓的「用浏览器打开」入口文案不同） */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

/** 打开微信引导层（reason: 'enter' 进入时 | 'export' 导出被拦截时） */
export function openWeChatGuard(reason: 'enter' | 'export' = 'export'): void {
  window.dispatchEvent(new CustomEvent('wechat-guard-open', { detail: { reason } }));
}
