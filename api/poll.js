// Vercel Serverless Function — MP 실시간 설문 세션과 학생 응답.
// 관리자 토큰은 선생님 브라우저 DB에만 저장하고 학생용 응답에는 노출하지 않는다.
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const asText = value => (value == null ? '' : String(value)).trim();
const safeAnswersFor = (session, answers, otherAnswers) => {
  if (!answers || !Array.isArray(session && session.questions)) return null;
  const safe = {}, safeOther = {};
  for (const question of session.questions) {
    const questionId = asText(question.id);
    const raw = answers[questionId];
    if ((question.type || 'choice') === 'text') {
      const text = asText(raw).slice(0, 4000);
      if (!text) return null;
      safe[questionId] = text;
    } else {
      const optionId = asText(raw);
      const otherId = `other:${questionId}`;
      if (optionId === otherId && question.allowOther !== false) {
        const otherText = asText(otherAnswers && otherAnswers[questionId]).slice(0, 4000);
        if (!otherText) return null;
        safeOther[questionId] = otherText;
      } else if (!(question.options || []).some(option => asText(option.id) === optionId)) return null;
      safe[questionId] = optionId;
    }
  }
  return { answers:safe, otherAnswers:safeOther };
};

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

      const safePayload = safeAnswersFor(record.session, response.answers, response.otherAnswers);
      if (!safePayload) return res.status(400).json({ error: '모든 질문에 답해주세요' });

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
        answers: safePayload.answers,
        otherAnswers: safePayload.otherAnswers,
        submittedAt: Date.now(),
      };
      record.responses = record.responses || {};
      record.responses[safeResponse.participantKey] = safeResponse;
      await redis.set(key, record, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok: true, submittedAt: safeResponse.submittedAt });
    }

    if (action === 'adminSaveResponse') {
      const code = asText(body.code), adminToken = asText(body.adminToken), response = body.response;
      const key = `poll:${code}`, record = await redis.get(key);
      if (!record || !record.session) return res.status(404).json({ error: '설문을 찾지 못했어요' });
      if (!adminToken || adminToken !== record.adminToken) return res.status(403).json({ error: '관리자 권한이 필요해요' });
      if (!response || !asText(response.participantKey)) return res.status(400).json({ error: '응답 정보가 올바르지 않아요' });
      const safePayload = safeAnswersFor(record.session, response.answers, response.otherAnswers);
      if (!safePayload) return res.status(400).json({ error: '모든 질문에 답해주세요' });
      const participantKey = asText(response.participantKey).slice(0, 80), previous = (record.responses || {})[participantKey] || {};
      record.responses = record.responses || {};
      record.responses[participantKey] = {...previous,...response,participantKey,answers:safePayload.answers,otherAnswers:safePayload.otherAnswers,submittedAt:Number(response.submittedAt)||previous.submittedAt||Date.now(),editedAt:Date.now()};
      await redis.set(key, record, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok:true, editedAt:record.responses[participantKey].editedAt });
    }

    if (action === 'deleteResponse') {
      const code = asText(body.code), adminToken = asText(body.adminToken), participantKey = asText(body.participantKey);
      const key = `poll:${code}`, record = await redis.get(key);
      if (!record || !record.session) return res.status(404).json({ error: '설문을 찾지 못했어요' });
      if (!adminToken || adminToken !== record.adminToken) return res.status(403).json({ error: '관리자 권한이 필요해요' });
      if (!participantKey) return res.status(400).json({ error: '삭제할 응답이 올바르지 않아요' });
      if (record.responses) delete record.responses[participantKey];
      await redis.set(key, record, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok:true });
    }

    if (action === 'deleteSession') {
      const code = asText(body.code), adminToken = asText(body.adminToken), key = `poll:${code}`;
      const record = await redis.get(key);
      if (!record || !record.session) return res.status(404).json({ error: '설문을 찾지 못했어요' });
      if (!adminToken || adminToken !== record.adminToken) return res.status(403).json({ error: '관리자 권한이 필요해요' });
      await redis.del(key);
      return res.status(200).json({ ok:true });
    }

    return res.status(400).json({ error: '알 수 없는 작업이에요' });
  } catch (error) {
    return res.status(500).json({ error: String(error && error.message || error) });
  }
}
