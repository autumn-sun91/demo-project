import {
  resolveHeaders,
  toChatMessage,
  splitSentences,
  extractDueDate,
  extractAssignee,
  extractActionItems,
  getTopics,
  getKeyPoints,
  analyzeChat,
  ChatMessage,
  ParticipantStat,
  ActionItem,
  AnalysisResult
} from './chat-analysis';

describe('Header Resolution', () => {
  test('should resolve standard English headers', () => {
    const result = resolveHeaders(['timestamp', 'user', 'message']);
    expect(result.timestamp).toBe('timestamp');
    expect(result.user).toBe('user');
    expect(result.message).toBe('message');
  });

  test('should resolve Korean headers', () => {
    const result = resolveHeaders(['일시', '사용자', '메시지']);
    expect(result.timestamp).toBe('일시');
    expect(result.user).toBe('사용자');
    expect(result.message).toBe('메시지');
  });

  test('should handle headers with spaces and underscores', () => {
    const result = resolveHeaders(['created_at', 'user name', 'chat message']);
    expect(result.timestamp).toBe('created_at');
    expect(result.user).toBe('user name');
    expect(result.message).toBe('chat message');
  });

  test('should handle BOM in headers', () => {
    const result = resolveHeaders(['﻿timestamp', 'user', 'message']);
    expect(result.timestamp).toBe('﻿timestamp');
    expect(result.user).toBe('user');
    expect(result.message).toBe('message');
  });

  test('should return null for missing headers', () => {
    const result = resolveHeaders(['timestamp', 'user']);
    expect(result.timestamp).toBe('timestamp');
    expect(result.user).toBe('user');
    expect(result.message).toBeNull();
  });
});

describe('toChatMessage', () => {
  const headers = resolveHeaders(['timestamp', 'user', 'message']);

  test('should create chat message from valid row', () => {
    const row = { timestamp: '2023-01-01 10:00', user: 'John', message: 'Hello world' };
    const result = toChatMessage(row, headers);
    expect(result).toEqual({
      timestamp: '2023-01-01 10:00',
      user: 'John',
      message: 'Hello world'
    });
  });

  test('should handle empty message', () => {
    const row = { timestamp: '2023-01-01 10:00', user: 'John', message: '' };
    const result = toChatMessage(row, headers);
    expect(result).toBeNull();
  });

  test('should handle missing user', () => {
    const row = { timestamp: '2023-01-01 10:00', message: 'Hello world' };
    const result = toChatMessage(row, headers);
    expect(result?.user).toBe('알 수 없음');
  });

  test('should trim whitespace', () => {
    const row = { timestamp: ' 2023-01-01 10:00 ', user: ' John ', message: ' Hello world ' };
    const result = toChatMessage(row, headers);
    expect(result).toEqual({
      timestamp: '2023-01-01 10:00',
      user: 'John',
      message: 'Hello world'
    });
  });
});

describe('splitSentences', () => {
  test('should split by newlines', () => {
    const result = splitSentences('Hello\nWorld');
    expect(result).toEqual(['Hello', 'World']);
  });

  test('should split by sentence endings', () => {
    const result = splitSentences('Hello. World! How?');
    expect(result).toEqual(['Hello', 'World', 'How']);
  });

  test('should remove list markers', () => {
    const result = splitSentences('- First\n* Second\n. Third');
    expect(result).toEqual(['First', 'Second', 'Third']);
  });

  test('should filter short sentences', () => {
    const result = splitSentences('Hi. Hello world.');
    expect(result).toEqual(['Hello world']);
  });

  test('should handle Korean text', () => {
    const result = splitSentences('안녕하세요. 반갑습니다!');
    expect(result).toEqual(['안녕하세요', '반갑습니다']);
  });
});

describe('extractDueDate', () => {
  test('should extract Korean date expressions', () => {
    expect(extractDueDate('내일까지 끝내야 함')).toBe('내일까지');
    expect(extractDueDate('모레 오전 9시까지')).toBe('모레 오전 9시까지');
    expect(extractDueDate('다음 주 월요일까지')).toBe('다음 주 월요일까지');
    expect(extractDueDate('2023-12-31까지 보고서 제출')).toBe('2023-12-31까지');
    expect(extractDueDate('12월 25일까지')).toBe('12월 25일까지');
  });

  test('should extract English date expressions', () => {
    expect(extractDueDate('Please finish by tomorrow')).toBe('by tomorrow');
    expect(extractDueDate('Deadline: next Monday')).toBe('next Monday');
    expect(extractDueDate('Complete by Dec 25')).toBe('by Dec 25');
  });

  test('should return null when no date found', () => {
    expect(extractDueDate('Just a regular message')).toBeNull();
    expect(extractDueDate('')).toBeNull();
  });
});

describe('extractAssignee', () => {
  test('should extract @mentions', () => {
    expect(extractAssignee('@John please review', 'Alice')).toBe('John');
    expect(extractAssignee('Hey @김철수, check this', '박영희')).toBe('김철수');
  });

  test('should extract Korean honorifics', () => {
    expect(extractAssignee('김씨께서 확인해 주세요', '박씨')).toBe('김');
    expect(extractAssignee('이님 please handle this', '김')).toBe('이');
  });

  test('should extract self-assignment', () => {
    expect(extractAssignee('저가 이것을 처리하겠습니다', '저')).toBe('저');
    expect(extractAssignee('내가 할게', '나')).toBe('나');
    expect(extractAssignee('I will do this', 'Alice')).toBe('Alice');
    expect(extractAssignee('Ill handle it', 'Bob')).toBe('Bob');
  });

  test('should return null when no assignee found', () => {
    expect(extractAssignee('Just a message', 'User')).toBeNull();
    expect(extractAssignee('', 'User')).toBeNull();
  });
});

describe('extractActionItems', () => {
  const messages: ChatMessage[] = [
    { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'Please review the document by tomorrow' },
    { timestamp: '2023-01-01 10:05', user: 'Bob', message: '@John please handle this task' },
    { timestamp: '2023-01-01 10:10', user: 'Charlie', message: '저가 이것을 처리하겠습니다' },
    { timestamp: '2023-01-01 10:15', user: 'Alice', message: 'Just a regular message' },
  ];

  test('should extract action items with assignees and due dates', () => {
    const result = extractActionItems(messages);
    expect(result.length).toBeGreaterThan(0);

    // Check first action item
    expect(result[0]).toMatchObject({
      text: 'Please review the document by tomorrow',
      assignee: null,
      dueDate: expect.stringContaining('내일'),
      sourceUser: 'Alice'
    });

    // Check second action item with @mention
    expect(result[1]).toMatchObject({
      text: '@John please handle this task',
      assignee: 'John',
      dueDate: null,
      sourceUser: 'Bob'
    });

    // Check self-assignment
    expect(result[2]).toMatchObject({
      text: '저가 이것을 처리하겠습니다',
      assignee: 'Charlie',
      dueDate: null,
      sourceUser: 'Charlie'
    });
  });

  test('should deduplicate similar action items', () => {
    const duplicateMessages: ChatMessage[] = [
      { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'Please review the document' },
      { timestamp: '2023-01-01 10:05', user: 'Bob', message: 'please review the document' }, // Duplicate
      { timestamp: '2023-01-01 10:10', user: 'Charlie', message: 'Please review the document!' }, // Similar
    ];

    const result = extractActionItems(duplicateMessages);
    expect(result.length).toBe(1); // Should only have one unique action item
  });

  test('should limit to 30 action items', () => {
    const manyMessages: ChatMessage[] = Array.from({ length: 35 }, (_, i) => ({
      timestamp: `2023-01-01 10:${i.toString().padStart(2, '0')}`,
      user: `User${i}`,
      message: `Please handle task ${i}`
    }));

    const result = extractActionItems(manyMessages);
    expect(result.length).toBe(30);
  });

  test('should return empty array for no action items', () => {
    const noActionMessages: ChatMessage[] = [
      { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'Just chatting' },
      { timestamp: '2023-01-01 10:05', user: 'Bob', message: 'How are you?' },
    ];

    const result = extractActionItems(noActionMessages);
    expect(result.length).toBe(0);
  });
});

describe('getTopics', () => {
  const messages: ChatMessage[] = [
    { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'We discussed the project deadline and budget' },
    { timestamp: '2023-01-01 10:05', user: 'Bob', message: 'The project deadline is next Friday' },
    { timestamp: '2023-01-01 10:10', user: 'Charlie', message: 'We need to increase the budget for marketing' },
    { timestamp: '2023-01-01 10:15', user: 'Alice', message: 'Marketing campaign will start next month' },
  ];

  test('should extract frequent topics', () => {
    const result = getTopics(messages);
    expect(result).toContain('project');
    expect(result).toContain('deadline');
    expect(result).toContain('budget');
    expect(result).toContain('marketing');
  });

  test('should filter out stop words', () => {
    const stopWordMessages: ChatMessage[] = [
      { timestamp: '2023-01-01 10:00', user: 'Alice', message: '그리고 그런데 그러나 इसलिए' },
      { timestamp: '2023-01-01 10:05', user: 'Bob', message: '하는 해서 합니다 같습니다' },
    ];

    const result = getTopics(stopWordMessages);
    expect(result.length).toBe(0);
  });

  test('should handle short messages', () => {
    const shortMessages: ChatMessage[] = [
      { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'Hi' },
      { timestamp: '2023-01-01 10:05', user: 'Bob', message: 'Hello' },
    ];

    const result = getTopics(shortMessages);
    expect(result.length).toBe(0);
  });
});

describe('getKeyPoints', () => {
  const messages: ChatMessage[] = [
    { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'We decided to launch the product next month. This is a key decision.' },
    { timestamp: '2023-01-01 10:05', user: 'Bob', message: 'The budget needs approval from management.' },
    { timestamp: '2023-01-01 10:10', user: 'Charlie', message: 'Please prepare the presentation slides by tomorrow.' },
    { timestamp: '2023-01-01 10:15', user: 'Alice', message: 'Just a regular update.' },
  ];

  test('should extract important points', () => {
    const topics = ['product', 'launch', 'budget', 'presentation'];
    const result = getKeyPoints(messages, topics);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain('decided');
    expect(result[1]).toContain('budget');
    expect(result[2]).toContain('Please prepare');
  });

  test('should limit to 4 key points', () => {
    const manyMessages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: `2023-01-01 10:${i.toString().padStart(2, '0')}`,
      user: `User${i}`,
      message: `Important point ${i} that should be considered carefully.`
    }));

    const topics = ['important', 'point'];
    const result = getKeyPoints(manyMessages, topics);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  test('should deduplicate similar key points', () => {
    const similarMessages: ChatMessage[] = [
      { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'Please review the document carefully' },
      { timestamp: '2023-01-01 10:05', user: 'Bob', message: 'please review the document carefully' }, // Duplicate
      { timestamp: '2023-01-01 10:10', user: 'Charlie', message: 'Please review the document!!' }, // Similar
    ];

    const topics = ['review', 'document'];
    const result = getKeyPoints(similarMessages, topics);
    expect(result.length).toBe(1);
  });
});

describe('analyzeChat', () => {
  const messages: ChatMessage[] = [
    { timestamp: '2023-01-01 10:00', user: 'Alice', message: 'We decided to launch the product next month' },
    { timestamp: '2023-01-01 10:05', user: 'Bob', message: '@John please prepare the presentation by tomorrow' },
    { timestamp: '2023-01-01 10:10', user: 'Charlie', message: '저가 이것을 처리하겠습니다' },
    { timestamp: '2023-01-01 10:15', user: 'Alice', message: 'The budget needs approval' },
  ];

  test('should analyze chat and return proper structure', () => {
    const result = analyzeChat(messages, 'test.csv');

    expect(result).toMatchObject({
      fileName: 'test.csv',
      totalMessages: 4,
      participantCount: 3,
    });

    expect(Array.isArray(result.participants)).toBe(true);
    expect(result.participants.length).toBe(3);

    expect(Array.isArray(result.summary.keyPoints)).toBe(true);
    expect(Array.isArray(result.summary.topics)).toBe(true);
    expect(typeof result.summary.overview).toBe('string');

    expect(Array.isArray(result.actionItems)).toBe(true);
    expect(result.actionItems.length).toBeGreaterThan(0);

    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('should calculate participant statistics correctly', () => {
    const result = analyzeChat(messages, 'test.csv');

    // Alice: 2 messages (50%)
    // Bob: 1 message (25%)
    // Charlie: 1 message (25%)
    const aliceStat = result.participants.find(p => p.name === 'Alice');
    const bobStat = result.participants.find(p => p.name === 'Bob');
    const charlieStat = result.participants.find(p => p.name === 'Charlie');

    expect(aliceStat?.messageCount).toBe(2);
    expect(aliceStat?.percentage).toBe(50);
    expect(bobStat?.messageCount).toBe(1);
    expect(bobStat?.percentage).toBe(25);
    expect(charlieStat?.messageCount).toBe(1);
    expect(charlieStat?.percentage).toBe(25);
  });

  test('should extract action items with proper assignees and due dates', () => {
    const result = analyzeChat(messages, 'test.csv');

    // Should have action items from Bob and Charlie's messages
    const actionItemWithAssignee = result.actionItems.find(item => item.assignee === 'John');
    const actionItemWithSelfAssignee = result.actionItems.find(item => item.assignee === 'Charlie');

    expect(actionItemWithAssignee).toBeDefined();
    expect(actionItemWithAssignee?.text).toContain('please prepare');
    expect(actionItemWithAssignee?.dueDate).toContain('내일');

    expect(actionItemWithSelfAssignee).toBeDefined();
    expect(actionItemWithSelfAssignee?.text).toContain('저가 이것을');
    expect(actionItemWithSelfAssignee?.assignee).toBe('Charlie');
  });

  test('should handle empty messages array', () => {
    const result = analyzeChat([], 'empty.csv');

    expect(result.totalMessages).toBe(0);
    expect(result.participantCount).toBe(0);
    expect(result.participants.length).toBe(0);
    expect(result.summary.keyPoints.length).toBe(0);
    expect(result.summary.topics.length).toBe(0);
    expect(result.actionItems.length).toBe(0);
    expect(result.summary.overview).toBe('0명이 총 0개의 메시지를 나눴습니다.');
  });

  test('should handle messages with missing timestamps', () => {
    const messagesWithMissingTime: ChatMessage[] = [
      { timestamp: '', user: 'Alice', message: 'Hello' },
      { timestamp: '2023-01-01 10:00', user: 'Bob', message: 'World' },
    ];

    const result = analyzeChat(messagesWithMissingTime, 'test.csv');

    expect(result.totalMessages).toBe(2);
    expect(result.participantCount).toBe(2);
    // Date range should only include the valid timestamp
    expect(result.dateRange.start).toBe('2023-01-01 10:00');
    expect(result.dateRange.end).toBe('2023-01-01 10:00');
  });
});