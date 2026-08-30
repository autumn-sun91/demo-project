# 코드 아키텍처

## 전체 구조
```
/
├── app/                 # Next.js 13+ App Router (클라이언트 컴포넌트 중심)
│   ├── favicon.ico
│   ├── globals.css      # 전역 스타일
│   ├── layout.tsx       # 루트 레이아웃
│   └── page.tsx         # 메인 페이지 (파일 업로드 + 결과 표시)
├── lib/                 # 핵심 비즈니스 로직
│   └── chat-analysis.ts # CSV 파싱, 요약 생성, 액션 추출 로직
├── pages/               # 기존 Pages Router (API 라우트만 유지)
│   └── api/             # API 엔드포인트
│       └── process-csv.ts # 파일 업로드 처리 및 분석 트리거
├── public/              # 정적 에셋
├── types/               # TypeScript 타입 정의
│   ├── analysis.ts      # 분석 결과 타입
│   └── busboy.d.ts      # 파일 업로드용 타입
├── styles/              # (사용되지 않음 - CSS는 app/에 통합)
├── next.config.ts       # Next.js 설정
├── package.json         # 프로젝트 메타데이터 및 스크립트
├── tsconfig.json        # TypeScript 설정
└── eslint.config.mjs    # ESLint 설정
```

## 핵심 모듈 설명

### 1. `app/page.tsx` (메인 UI 컴포넌트)
- 드래그 앤 드롭 파일 업로드 인터페이스
- 파일 유효성 검사 (확장자, 크기)
- 분석 상태 관리 (로딩, 에러, 결과)
- 결과 표시 및 마크다운 내보내기 기능
- 클라이언트 컴포넌트 (`"use client"` 지시자 사용)

### 2. `lib/chat-analysis.ts` (핵심 분석 로직)
- CSV 파싱 (csv-parser 라이브러리 사용)
- 헤더 변형 지원 (한국어/영어 다양한 별칭)
- 메시지 통계 계산 (총 메시지, 참여자 수, 비율)
- 날짜 범위 분석 (시간순 정렬)
- 주제 추출 (간단한 키워드 빈도 기반)
- 핵심 내용 요약 (대표 문장 선택)
- 액션 아이템 추출 (규칙 기반 패턴 매칭)
  - 할 일 표현 패턴: "~해 주세요", "~하도록 하겠습니다", etc.
  - 담당자 추출: "@이름", "이름께서" 패턴
  - 기한 추출: "까지", "까지 마무리" 등 시간 표현

### 3. `pages/api/process-csv.ts` (API 라우트)
- 파일 업로드 처리 (Busboy를 사용한 스트리밍)
- 파일 크기 제한 (5MB)
- 분석 로직 호출 및 결과 반환
- 순수하게 프록시 역할 (실제 분석은 클라이언트에서 재실행됨)

## 스타일링 접근 방식
- 전역 스타일: `app/globals.css` (기본 리셋 및 변수)
- 컴포넌트 수준 스타일: CSS Modules 또는 인라인 스타일
- 반응형 디자인: 모바일 브레이크포인트에서 특정 요소 조정

## 주요 의존성
- `next`: 16.3.3 (App Router 지원)
- `react`, `react-dom`: 19.2.8
- `busboy`: 파일 업로드 스트리� 처리
- `csv-parser`: CSV 파싱
- `typescript`: 5.9.3
- `eslint`: 코드 품질 검사