const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
  console.error('Missing KV_REST_API_URL or KV_REST_API_TOKEN');
  process.exit(1);
}

const encoder = new TextEncoder();

function dateKey(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function kvFetch(command) {
  const res = await fetch(KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data?.result ?? null;
}

async function kvGet(key) {
  const result = await kvFetch(['GET', key]);
  if (result === null || result === undefined) return 0;
  if (typeof result === 'string') {
    const n = Number(result);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof result === 'number') return result;
  return 0;
}

function getDates(days) {
  const dates = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(d);
  }
  return dates;
}

async function main() {
  const days = Number(process.argv[2] || '7');
  if (!Number.isFinite(days) || days <= 0) {
    console.error('Usage: node api/scripts/metrics_export.js <days>');
    process.exit(1);
  }

  const headers = [
    'date',
    'active_dj',
    'mix_created',
    'mix_published',
    'upload_started',
    'upload_completed',
    'upload_failed',
    'time_to_publish_avg_seconds',
  ];
  console.log(headers.join(','));

  for (const d of getDates(days)) {
    const key = dateKey(d);
    const activeDj = await kvGet(`metrics:active_dj:${key}`);
    const mixCreated = await kvGet(`metrics:mix_created:${key}`);
    const mixPublished = await kvGet(`metrics:mix_published:${key}`);
    const uploadStarted = await kvGet(`metrics:upload_started:${key}`);
    const uploadCompleted = await kvGet(`metrics:upload_completed:${key}`);
    const uploadFailed = await kvGet(`metrics:upload_failed:${key}`);
    const ttpCount = await kvGet(`metrics:time_to_publish_count:${key}`);
    const ttpSum = await kvGet(`metrics:time_to_publish_sum:${key}`);
    const ttpAvg = ttpCount > 0 ? (ttpSum / ttpCount) : 0;

    console.log([
      key,
      activeDj,
      mixCreated,
      mixPublished,
      uploadStarted,
      uploadCompleted,
      uploadFailed,
      ttpAvg.toFixed(2),
    ].join(','));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
