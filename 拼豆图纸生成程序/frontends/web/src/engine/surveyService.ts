import { trackEvent } from './analyticsService';

const SURVEY_KEY = 'perler_survey_opened_v1';

/** 本地日期字符串（YYYY-MM-DD），用于「每设备每日最多弹一次」判断 */
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function openSurveyOnce(): boolean {
  const surveyUrl =
    (import.meta.env.VITE_SURVEY_URL as string | undefined) ||
    (import.meta.env.VITE_FEEDBACK_FORM_URL as string | undefined);

  if (!surveyUrl || localStorage.getItem(SURVEY_KEY) === todayStr()) return false;

  try {
    localStorage.setItem(SURVEY_KEY, todayStr());
    const api = (window as any).electronAPI;
    if (api && typeof api.openExternal === 'function') {
      void api.openExternal(surveyUrl);
    } else {
      window.open(surveyUrl, '_blank', 'noopener,noreferrer');
    }
    trackEvent('survey_prompted', { url: surveyUrl });
    return true;
  } catch {
    return false;
  }
}
