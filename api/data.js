// Vercel Serverless Function — 아주 작은 key-value 서버 DB.
// (예전엔 "Vercel KV"였는데 지금은 없어졌고, 같은 역할을 Upstash Redis가
//  대신해요. Vercel의 Upstash 연동은 환경변수를 KV_REST_API_URL /
//  KV_REST_API_TOKEN 이름으로 넣어주기 때문에, 그 이름을 그대로 읽는다.)
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const key = (req.query.key || (req.body && req.body.key) || '').toString().trim();
  if (!key) {
    res.status(400).json({ error: 'key가 필요해요' });
    return;
  }
  const storeKey = `arena:${key}`;

  try {
    if (req.method === 'GET') {
      const data = await redis.get(storeKey);
      res.status(200).json({ data: data || null });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const incoming = body && body.data;
      if (!incoming || !incoming.classes) {
        res.status(400).json({ error: '저장할 데이터가 올바르지 않아요' });
        return;
      }
      if (!body.force) {
        const current = await redis.get(storeKey);
        const currentTime = Number(current && current._updatedAt) || 0;
        const incomingTime = Number(incoming._updatedAt) || 0;
        if (currentTime > incomingTime) {
          res.status(409).json({ error: '서버에 더 최신 데이터가 있어요', data: current });
          return;
        }
      }
      await redis.set(storeKey, incoming);
      res.status(200).json({ ok: true, updatedAt: incoming._updatedAt || null });
      return;
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    res.status(405).json({ error: '지원하지 않는 메서드예요' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
