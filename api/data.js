// Vercel Serverless Function — 아주 작은 key-value 서버 DB (Vercel KV)
// 배포 후 Vercel 대시보드에서 KV 스토어를 만들고 이 프로젝트에 연결하면
// KV_REST_API_URL / KV_REST_API_TOKEN 환경변수가 자동으로 채워져요.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const key = (req.query.key || (req.body && req.body.key) || '').toString().trim();
  if (!key) {
    res.status(400).json({ error: 'key가 필요해요' });
    return;
  }
  const storeKey = `arena:${key}`;

  try {
    if (req.method === 'GET') {
      const data = await kv.get(storeKey);
      res.status(200).json({ data: data || null });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await kv.set(storeKey, body.data);
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    res.status(405).json({ error: '지원하지 않는 메서드예요' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
