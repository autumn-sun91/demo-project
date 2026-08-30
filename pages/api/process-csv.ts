import type { NextApiRequest, NextApiResponse } from 'next';
import csvParser from 'csv-parser';
import busboy from 'busboy';
import { Readable } from 'stream';
import { analyzeChat, resolveHeaders, toChatMessage, type AnalysisResult, type ChatMessage } from '@/lib/chat-analysis';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_MESSAGES = 20_000;

export const config = {
  api: { bodyParser: false },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResult | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method POST required' });
  }

  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'multipart/form-data 형식으로 CSV 파일을 업로드해 주세요.' });
  }

  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
    return res.status(413).json({ error: '파일은 최대 5MB까지 업로드할 수 있습니다.' });
  }

  try {
    const bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_FILE_SIZE, fields: 0 } });
    const chunks: Uint8Array[] = [];
    let fileName = '';
    let fileFound = false;
    let fileTooLarge = false;
    let invalidFileType = false;
    let messagesTruncated = false;

    bb.on('file', (_fieldname, file, info) => {
      fileFound = true;
      fileName = info.filename;
      invalidFileType = !info.filename.toLowerCase().endsWith('.csv');
      file.on('limit', () => { fileTooLarge = true; });
      file.on('data', (data: Uint8Array) => chunks.push(data));
    });

    await new Promise<void>((resolve, reject) => {
      bb.on('close', resolve);
      bb.on('error', reject);
      req.pipe(bb);
    });

    if (!fileFound || chunks.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (fileTooLarge) return res.status(413).json({ error: '파일은 최대 5MB까지 업로드할 수 있습니다.' });
    if (invalidFileType) return res.status(415).json({ error: 'CSV 파일만 업로드할 수 있습니다.' });

    const buffer = Buffer.concat(chunks);
    const rows: Record<string, unknown>[] = [];
    let csvHeaders: string[] = [];

    await new Promise<void>((resolve, reject) => {
      Readable.from([buffer])
        .pipe(csvParser({ strict: false }))
        .on('headers', (headers: string[]) => { csvHeaders = headers; })
        .on('data', (row: Record<string, unknown>) => {
          if (rows.length < MAX_MESSAGES) rows.push(row);
          else messagesTruncated = true;
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const resolvedHeaders = resolveHeaders(csvHeaders);
    if (!resolvedHeaders.message) {
      return res.status(422).json({ error: '메시지 열을 찾을 수 없습니다. message, text, content, 메시지 또는 내용 헤더를 사용해 주세요.' });
    }

    const messages: ChatMessage[] = [];
    rows.forEach((row) => {
      const chat = toChatMessage(row, resolvedHeaders);
      if (chat) messages.push(chat);
    });

    if (!messages.length) return res.status(422).json({ error: '분석할 메시지가 없습니다.' });

    const warnings: string[] = [];
    if (!resolvedHeaders.user) warnings.push('사용자 열을 찾지 못해 발신자를 “알 수 없음”으로 표시했습니다.');
    if (!resolvedHeaders.timestamp) warnings.push('시간 열을 찾지 못해 대화 기간을 계산하지 못했습니다.');
    if (messagesTruncated) warnings.push(`처리 한도인 ${MAX_MESSAGES.toLocaleString()}개 메시지만 분석했습니다.`);

    res.status(200).json(analyzeChat(messages, fileName, warnings));
  } catch (error) {
    console.error(error);
    const message = error instanceof Error && /csv/i.test(error.message)
      ? 'CSV 형식을 읽을 수 없습니다. 구분자와 따옴표를 확인해 주세요.'
      : '파일을 처리하는 중 오류가 발생했습니다.';
    res.status(500).json({ error: message });
  }
}
