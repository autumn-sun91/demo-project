export interface ChatMessage {
  timestamp: string;
  user: string;
  message: string;
}

export interface ParticipantStat {
  name: string;
  messageCount: number;
  percentage: number;
}

export interface ActionItem {
  id: number;
  text: string;
  assignee: string | null;
  dueDate: string | null;
  sourceUser: string;
  sourceTimestamp: string;
}

export interface AnalysisResult {
  fileName: string;
  totalMessages: number;
  participantCount: number;
  participants: ParticipantStat[];
  dateRange: { start: string | null; end: string | null };
  summary: {
    overview: string;
    keyPoints: string[];
    topics: string[];
  };
  actionItems: ActionItem[];
  warnings: string[];
}

const HEADER_ALIASES = {
  timestamp: ["timestamp", "time", "datetime", "date", "createdat", "일시", "시간", "날짜", "작성일"],
  user: ["user", "username", "sender", "name", "author", "participant", "사용자", "이름", "발신자", "작성자", "참여자"],
  message: ["message", "text", "content", "body", "chat", "메시지", "메세지", "내용", "본문", "대화"],
} as const;

const ACTION_PATTERN = /(?:\btodo\b|\baction\s*items?\b|\bneed(?:s)?\s+to\b|\bhave\s+to\b|\bmust\b|\bplease\b|\bfollow[ -]?up\b|\bi(?:'ll|\s+will)\b|해야|해주세요|해\s*주세요|부탁(?:해요|합니다|드려요)?|확인해|공유해|전달해|정리해|준비해|업데이트해|처리해|진행해|검토해|보내\s*주세요|(?:확인|공유|전달|정리|준비|업데이트|처리|진행|검토|발송)할게요?|까지\s*(?:할게|하겠|완료|주세요))/i;

const IMPORTANT_PATTERN = /(?:결정|합의|결론|핵심|중요|문제|이슈|원인|변경|목표|일정|출시|배포|회의|decision|agreed|important|issue|problem|deadline|release|launch)/i;

const STOP_WORDS = new Set([
  "그리고", "하지만", "그래서", "그런데", "대한", "관련", "있는", "없는", "하는", "해서", "합니다", "입니다", "같아요", "좋아요", "확인", "부탁", "오늘", "내일", "이번", "다음", "현재", "가장", "중요한", "저희", "우리", "제가", "제가요", "the", "and", "for", "that", "this", "with", "from", "have", "will", "please", "need", "should", "about", "into", "your", "you", "are", "was", "were", "message", "todo",
]);

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]/g, "");
}

export function resolveHeaders(headers: string[]) {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const resolve = (aliases: readonly string[]) => aliases.map(normalizeHeader).map((alias) => normalized.get(alias)).find(Boolean);

  return {
    timestamp: resolve(HEADER_ALIASES.timestamp),
    user: resolve(HEADER_ALIASES.user),
    message: resolve(HEADER_ALIASES.message),
  };
}

export function toChatMessage(
  row: Record<string, unknown>,
  headers: ReturnType<typeof resolveHeaders>,
): ChatMessage | null {
  const message = headers.message ? String(row[headers.message] ?? "").trim() : "";
  if (!message) return null;

  return {
    timestamp: headers.timestamp ? String(row[headers.timestamp] ?? "").trim() : "",
    user: headers.user ? String(row[headers.user] ?? "").trim() || "알 수 없음" : "알 수 없음",
    message,
  };
}

function splitSentences(message: string): string[] {
  return message
    .split(/\r?\n|(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim().replace(/^[•*-]\s*/, ""))
    .filter((sentence) => sentence.length >= 4);
}

function extractDueDate(text: string): string | null {
  const match = text.match(/(?:오늘|내일|모레|이번\s*주|다음\s*주|이번\s*달|다음\s*달|월요일|화요일|수요일|목요일|금요일|토요일|일요일|\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{1,2}월\s*\d{1,2}일)(?:\s*(?:오전|오후)?\s*\d{1,2}(?::\d{2})?시?)?(?:까지)?|\bby\s+(?:today|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day|\w+\s+\d{1,2})\b/i);
  return match?.[0] ?? null;
}

function extractAssignee(text: string, sourceUser: string): string | null {
  const mention = text.match(/@([\p{L}\p{N}_.-]{1,30})/u);
  if (mention) return mention[1];

  const named = text.match(/(?:^|\s)([가-힣A-Za-z0-9_]{2,20})(?:님|씨)(?:이|가|은|는|께서)?(?:\s|,)/);
  if (named) return named[1];
  if (/^(?:저는|제가|나는|내가)(?:\s|,|$)|\bi(?:'ll|\s+will)\b/i.test(text)) return sourceUser;
  return null;
}

function normalizeForDeduplication(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function extractActionItems(messages: ChatMessage[]): ActionItem[] {
  const found: Omit<ActionItem, "id">[] = [];
  const seen = new Set<string>();

  for (const chat of messages) {
    for (const sentence of splitSentences(chat.message)) {
      if (!ACTION_PATTERN.test(sentence)) continue;
      const key = normalizeForDeduplication(sentence);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      found.push({
        text: sentence.slice(0, 240),
        assignee: extractAssignee(sentence, chat.user),
        dueDate: extractDueDate(sentence),
        sourceUser: chat.user,
        sourceTimestamp: chat.timestamp,
      });
      if (found.length === 30) break;
    }
    if (found.length === 30) break;
  }

  return found.map((item, index) => ({ id: index + 1, ...item }));
}

function getTopics(messages: ChatMessage[]): string[] {
  const frequencies = new Map<string, number>();
  const documentCounts = new Map<string, number>();

  for (const { message } of messages) {
    const tokens = message.toLowerCase().match(/[가-힣]{2,}|[a-z][a-z0-9]{2,}/g) ?? [];
    const uniqueTokens = new Set<string>();
    for (const rawToken of tokens) {
      const token = /[가-힣]/.test(rawToken)
        ? rawToken.replace(/(?:에서는|에게서|으로|에서|에게|까지|부터|에는|은|는|이|가|을|를|과|와|도|에)$/u, "")
        : rawToken;
      if (token.length < 2) continue;
      if (STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      uniqueTokens.add(token);
    }
    uniqueTokens.forEach((token) => documentCounts.set(token, (documentCounts.get(token) ?? 0) + 1));
  }

  return [...frequencies]
    .filter(([token]) => (documentCounts.get(token) ?? 0) >= (messages.length >= 8 ? 2 : 1))
    .sort((a, b) => b[1] - a[1] || (documentCounts.get(b[0]) ?? 0) - (documentCounts.get(a[0]) ?? 0))
    .slice(0, 6)
    .map(([token]) => token);
}

function getKeyPoints(messages: ChatMessage[], topics: string[]): string[] {
  const candidates = messages.flatMap((chat, messageIndex) =>
    splitSentences(chat.message).map((text) => {
      const topicMatches = topics.filter((topic) => text.toLowerCase().includes(topic)).length;
      const score = topicMatches * 3 + (IMPORTANT_PATTERN.test(text) ? 4 : 0) + (ACTION_PATTERN.test(text) ? 1 : 0) + Math.min(text.length / 80, 2) - messageIndex / Math.max(messages.length, 1);
      return { text, score };
    }),
  );

  const seen = new Set<string>();
  return candidates
    .filter(({ text }) => text.length <= 260)
    .sort((a, b) => b.score - a.score)
    .filter(({ text }) => {
      const key = normalizeForDeduplication(text);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map(({ text }) => text);
}

function parseDate(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function analyzeChat(messages: ChatMessage[], fileName: string, warnings: string[] = []): AnalysisResult {
  const participantCounts = new Map<string, number>();
  messages.forEach(({ user }) => participantCounts.set(user, (participantCounts.get(user) ?? 0) + 1));

  const participants = [...participantCounts]
    .sort((a, b) => b[1] - a[1])
    .map(([name, messageCount]) => ({
      name,
      messageCount,
      percentage: Math.round((messageCount / messages.length) * 100),
    }));

  const datedMessages = messages
    .map(({ timestamp }) => ({ timestamp, value: parseDate(timestamp) }))
    .filter((item): item is { timestamp: string; value: number } => item.value !== null)
    .sort((a, b) => a.value - b.value);

  const topics = getTopics(messages);
  const keyPoints = getKeyPoints(messages, topics);
  const topParticipant = participants[0];
  const topicText = topics.length ? ` 주요 주제는 ${topics.slice(0, 3).join(", ")}입니다.` : "";
  const overview = `${participants.length}명이 총 ${messages.length}개의 메시지를 나눴습니다.${topParticipant ? ` ${topParticipant.name}님이 ${topParticipant.messageCount}개로 가장 많이 참여했습니다.` : ""}${topicText}`;

  return {
    fileName,
    totalMessages: messages.length,
    participantCount: participants.length,
    participants,
    dateRange: {
      start: datedMessages[0]?.timestamp ?? null,
      end: datedMessages.at(-1)?.timestamp ?? null,
    },
    summary: { overview, keyPoints, topics },
    actionItems: extractActionItems(messages),
    warnings,
  };
}
