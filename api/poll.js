// Vercel Serverless Function — MP 실시간 설문 세션과 학생 응답.
// 관리자 토큰은 선생님 브라우저 DB에만 저장하고 학생용 응답에는 노출하지 않는다.
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const asText = value => (value == null ? '' : String(value)).trim();

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const code = asText(req.query.code);
      if (!code) return res.status(400).json({ error: '참여 코드가 필요해요' });
      const record = await redis.get(`poll:${code}`);
      if (!record || !record.session) return res.status(404).json({ error: '설문을 찾지 못했어요' });
      const result = { session: record.session };
      if (asText(req.query.adminToken) && asText(req.query.adminToken) === record.adminToken) {
        result.responses = record.responses || {};
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(result);
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: '지원하지 않는 메서드예요' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = asText(body.action);

    if (action === 'publish') {
      const session = body.session;
      const adminToken = asText(body.adminToken);
      if (!session || !asText(session.code) || !Array.isArray(session.questions) || !adminToken) {
        return res.status(400).json({ error: '설문 정보가 올바르지 않아요' });
      }
      const key = `poll:${asText(session.code)}`;
      const current = await redis.get(key);
      const responses = current && current.adminToken === adminToken ? (current.responses || {}) : {};
      await redis.set(key, { session, adminToken, responses }, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok: true });
    }

    if (action === 'respond') {
      const code = asText(body.code);
      const response = body.response;
      if (!code || !response || !asText(response.participantKey) || !response.answers) {
        return res.status(400).json({ error: '응답 정보가 올바르지 않아요' });
      }
      const key = `poll:${code}`;
      const record = await redis.get(key);
      if (!record || !record.session) return res.status(404).json({ error: '설문을 찾지 못했어요' });
      if (record.session.status !== 'live') return res.status(409).json({ error: '종료된 설문이에요' });

      const questionIds = new Set(record.session.questions.map(q => asText(q.id)));
      const validOptions = new Map(record.session.questions.map(q => [asText(q.id), new Set((q.options || []).map(o => asText(o.id)))]));
      const safeAnswers = {};
      for (const [questionId, optionId] of Object.entries(response.answers)) {
        if (questionIds.has(questionId) && validOptions.get(questionId).has(asText(optionId))) safeAnswers[questionId] = asText(optionId);
      }
      if (Object.keys(safeAnswers).length !== questionIds.size) return res.status(400).json({ error: '모든 질문에 답해주세요' });

      let studentId = response.studentId ? asText(response.studentId) : null;
      let studentNumber = Number(response.studentNumber) || null;
      if (record.session.mode !== 'anonymous') {
        const student = (record.session.students || []).find(s => asText(s.id) === studentId);
        if (!student) return res.status(400).json({ error: '학생 번호가 올바르지 않아요' });
        studentNumber = Number(student.number) || studentNumber;
      } else {
        studentId = null;
        studentNumber = null;
      }

      const safeResponse = {
        participantKey: asText(response.participantKey).slice(0, 80),
        studentId,
        studentNumber,
        answers: safeAnswers,
        submittedAt: Date.now(),
      };
      record.responses = record.responses || {};
      record.responses[safeResponse.participantKey] = safeResponse;
      await redis.set(key, record, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok: true, submittedAt: safeResponse.submittedAt });
    }

    return res.status(400).json({ error: '알 수 없는 작업이에요' });
  } catch (error) {
    return res.status(500).json({ error: String(error && error.message || error) });
  }
}
