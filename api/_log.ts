import { env } from './_env';

type LogLevel = 'info' | 'warn' | 'error';

type LogEvent = {
  name: string;
  level?: LogLevel;
  message?: string;
  meta?: Record<string, unknown>;
};

export function logEvent(event: LogEvent) {
  if (env.FEATURE_LOGS === 'false') return;
  const level = event.level || 'info';
  const payload = {
    ts: new Date().toISOString(),
    level,
    name: event.name,
    message: event.message,
    meta: event.meta,
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}
