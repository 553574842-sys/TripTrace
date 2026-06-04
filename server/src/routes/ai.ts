import express, { Request, Response } from 'express';
import multer from 'multer';
import type { NextFunction } from 'express';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

type ParsedTransport = {
  type?: 'flight' | 'train' | 'car' | 'cruise';
  title?: string;
  status?: 'pending' | 'confirmed';
  from?: { name?: string; code?: string | null };
  to?: { name?: string; code?: string | null };
  departure_date?: string | null;
  arrival_date?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  airline?: string | null;
  flight_number?: string | null;
  train_number?: string | null;
  platform?: string | null;
  seat?: string | null;
  confirmation_number?: string | null;
  notes?: string | null;
  confidence?: number;
};

type AiErrorCode =
  | 'AI_KEY_MISSING'
  | 'AI_KEY_INVALID'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_IMAGE_TOO_LARGE'
  | 'AI_IMAGE_UNSUPPORTED'
  | 'AI_RESPONSE_PARSE_FAILED'
  | 'AI_RESPONSE_EMPTY'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_REQUEST_INVALID';

function aiError(res: Response, status: number, code: AiErrorCode, error: string, details?: unknown) {
  return res.status(status).json({ code, error, ...(details ? { details } : {}) });
}

function uploadTransportImage(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return aiError(res, 413, 'AI_IMAGE_TOO_LARGE', '图片太大，请上传 8MB 以内的截图。');
      }
      return aiError(res, 400, 'AI_REQUEST_INVALID', '上传图片失败，请重新选择截图后再试。');
    }
    if (err) return aiError(res, 400, 'AI_REQUEST_INVALID', '上传图片失败，请重新选择截图后再试。');
    next();
  });
}

function getAiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return { apiKey, baseUrl, model };
}

function extractJson(text: string): ParsedTransport {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain JSON');
    return JSON.parse(match[0]);
  }
}

function parseProviderError(body: string): string {
  try {
    const data = JSON.parse(body) as { error?: { message?: string; code?: string; type?: string } | string };
    if (typeof data.error === 'string') return data.error;
    return [data.error?.message, data.error?.code, data.error?.type].filter(Boolean).join(' ');
  } catch {
    return body;
  }
}

function classifyProviderError(status: number, body: string): { status: number; code: AiErrorCode; error: string } {
  const message = parseProviderError(body).toLowerCase();
  if (status === 401 || status === 403 || /invalid.*api.*key|incorrect api key|unauthorized|forbidden/.test(message)) {
    return { status: 401, code: 'AI_KEY_INVALID', error: 'AI API Key 无效或没有权限，请检查后端配置。' };
  }
  if (status === 404 || /model.*not.*found|does not exist|model_not_found|unknown model/.test(message)) {
    return { status: 400, code: 'AI_MODEL_UNAVAILABLE', error: '当前 AI 模型不可用，请检查 AI_MODEL 配置或更换模型。' };
  }
  if (status === 429 || /rate limit|quota|insufficient_quota/.test(message)) {
    return { status: 429, code: 'AI_RATE_LIMITED', error: 'AI 调用额度不足或请求过于频繁，请稍后再试。' };
  }
  if (/image.*too.*large|file.*too.*large|payload.*too.*large|maximum.*image|context_length_exceeded/.test(message)) {
    return { status: 413, code: 'AI_IMAGE_TOO_LARGE', error: '图片太大，请压缩截图或改用文字描述。' };
  }
  if (/unsupported.*image|invalid.*image|image.*format|unsupported.*file|invalid.*file/.test(message)) {
    return { status: 400, code: 'AI_IMAGE_UNSUPPORTED', error: '文件格式不支持，请上传 PNG、JPG 或 WebP 截图。' };
  }
  if (status === 400) {
    return { status: 400, code: 'AI_REQUEST_INVALID', error: 'AI 请求参数不正确，请检查截图、描述文本和模型配置。' };
  }
  return { status: 502, code: 'AI_PROVIDER_UNAVAILABLE', error: 'AI 服务暂时不可用，请稍后重试。' };
}

function normalizeTransport(raw: ParsedTransport): ParsedTransport {
  const type = ['flight', 'train', 'car', 'cruise'].includes(String(raw.type)) ? raw.type : undefined;
  const status = raw.status === 'confirmed' ? 'confirmed' : 'pending';
  const clean = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
  return {
    type,
    title: clean(raw.title) || undefined,
    status,
    from: raw.from ? { name: clean(raw.from.name) || undefined, code: clean(raw.from.code) } : undefined,
    to: raw.to ? { name: clean(raw.to.name) || undefined, code: clean(raw.to.code) } : undefined,
    departure_date: clean(raw.departure_date),
    arrival_date: clean(raw.arrival_date),
    departure_time: clean(raw.departure_time),
    arrival_time: clean(raw.arrival_time),
    airline: clean(raw.airline),
    flight_number: clean(raw.flight_number),
    train_number: clean(raw.train_number),
    platform: clean(raw.platform),
    seat: clean(raw.seat),
    confirmation_number: clean(raw.confirmation_number),
    notes: clean(raw.notes),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : undefined,
  };
}

router.post('/transport/parse', authenticate, uploadTransportImage, async (req: Request, res: Response) => {
  const { apiKey, baseUrl, model } = getAiConfig();
  if (!apiKey) {
    return aiError(res, 400, 'AI_KEY_MISSING', '尚未配置 AI API Key，请在后端设置 AI_API_KEY 或 OPENAI_API_KEY。');
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text && !req.file) return aiError(res, 400, 'AI_REQUEST_INVALID', '请先输入描述或上传截图。');
  if (req.file && !req.file.mimetype.startsWith('image/')) {
    return aiError(res, 400, 'AI_IMAGE_UNSUPPORTED', '文件格式不支持，请上传 PNG、JPG 或 WebP 截图。');
  }

  const system = [
    'You extract transport booking details for a travel planner.',
    'Return ONLY valid JSON. Do not include markdown.',
    'Supported type values: flight, train, car, cruise.',
    'Dates must be YYYY-MM-DD when present. Times must be 24-hour HH:mm when present.',
    'Use null for unknown fields. For flights, airport code should be IATA when visible.',
    'Schema: {"type","title","status","from":{"name","code"},"to":{"name","code"},"departure_date","arrival_date","departure_time","arrival_time","airline","flight_number","train_number","platform","seat","confirmation_number","notes","confidence"}.',
  ].join(' ');

  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: text || 'Parse the transport booking details from this image.' },
  ];
  if (req.file) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` },
    });
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45000),
    });

    const body = await response.text();
    if (!response.ok) {
      const classified = classifyProviderError(response.status, body);
      console.warn(`[AI] provider request failed status=${response.status} code=${classified.code}`);
      return aiError(res, classified.status, classified.code, classified.error);
    }
    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
    } catch {
      return aiError(res, 502, 'AI_RESPONSE_PARSE_FAILED', 'AI 返回内容不是有效 JSON，请稍后重试或更换模型。');
    }
    const content = data.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
      return aiError(res, 502, 'AI_RESPONSE_EMPTY', 'AI 没有返回可识别内容，请补充描述后重试。');
    }
    let parsed: ParsedTransport;
    try {
      parsed = normalizeTransport(extractJson(content));
    } catch {
      return aiError(res, 502, 'AI_RESPONSE_PARSE_FAILED', 'AI 返回格式无法解析，请换一张更清晰的截图或改用文字描述。');
    }
    res.json({ transport: parsed });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return aiError(res, 504, 'AI_TIMEOUT', 'AI 识别超时，请稍后重试。');
    }
    return aiError(res, 502, 'AI_PROVIDER_UNAVAILABLE', 'AI 服务暂时不可用，请检查网络、Base URL 或稍后重试。');
  }
});

export default router;
