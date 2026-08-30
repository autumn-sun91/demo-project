# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 명령어

### 기본 개발 흐름
```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# production 빌드
npm run build

# production 서버 실행
npm run start

# 린트 실행
npm run lint
```

### 테스트
현재 프로젝트는 별도의 테스트 프레임워크를 설정하지 않았습니다. 기능 검증은 수동으로 진행합니다:
1. 개발 서버 실행 후 브라우저에서 기능 테스트
2. 다양한 형식의 CSV 파일로 분석 정확도 검증

### 파일 처리 제한
- 최대 파일 크기: 5MB (클라이언트 측에서 검증)
- 지원 인코딩: UTF-8 CSV 권장
- 처리 방식: 전체 로직이 브라우저에서 실행되며, 서버는 단지 파일 업로드 엔드포인트만 제공

## 코드 아키텍처
상세한 코드 아키텍처는 @architecture.md 파일을 참조하세요.

## API 관련 문서
API 라우트 개발에 대한 상세 가이드는 `pages/api/CLAUDE.md` 파일을 참조하세요.

## 개발 시 주의사항

### Next.js 버전 특이사항
이 프로젝트는 Next.js 16.3.3을 사용하며, 이는 다음 사항에 영향을 미칩니다:
- App Router가 안정화되었지만 일부 마이너스 버그 가능성 존재
- `next dev` 실행 시 자동으로 `.next` 디렉토리에 캐시 생성
- TypeScript 엄격 모드 적용 (tsconfig.json 참조)

### 파일 업로드 제한 사항
- 클라이언트 측에서 5MB 제한 구현했으나, 서버 측에서도 동일 제한 적용 필요
- 대용량 파일 처리 시 메모리 사용량 증가 가능성 있음

### 개발 유틸리티 스크립트
`.claude/scripts/` 디렉토리에는 개발 워크플로우를 돕는 유틸리티 스크립트들이 포함되어 있습니다.

#### hook-helper.sh
- TDD 가드 훅 및 유사한 CLI 훅에서 재사용할 수 있는 유틸리티 함수들의 모음입니다.
- 직접 실행하는 스크립트가 아니라, 다른 훅 스크립트(예: tdd-guard.sh)에서 `source .claude/scripts/hook-helper.sh` 를 통해 불러와 사용합니다.
- 주요 함수:
  - `is_test_file`: 테스트 파일 여부 판별
  - `should_skip_testing`: 테스트 생략이 허용되는 파일 유형 판별 (설정, 스타일, types/, Next.js 프레임워크 파일, components/ 등)
  - `test_file_exists`: 해당 소스 파일에 대한 테스트 파일이 존재하는지 확인
  - `generate_tdd_denial`: 테스트 미존재 시 훅에서 반환할 거부 응답 JSON 생성

#### test-generator.sh
- 소스 파일로부터 테스트 스텁 파일을 자동 생성하는 스크립트입니다.
- TDD를 따르기 위해 구현 전 테스트를 먼저 작성할 때 사용합니다.
- **사용법**: `./test-generator.sh <source-file-path>`
  - 예: `./test-generator.sh lib/chat-analysis.ts`
- 동작 방식:
  1. 소스 파일에서 `export function` 또는 `export const` 로 내보낸 함수 이름들을 추출
  2. 동일한 디렉토리에 `<basename>.test.ts` 파일 생성 (존재하면 생략하지 않음)
  3. 생성된 테스트 파일에는 추출된 함수들에 대한 기본 테스트 스텁이 포함됩니다 (`expect(true).toBe(true)`)
- 생성된 테스트 파일을 수정한 후, 구현 파일을 작성하면 TDD 가드 훅이 테스트 존재를 확인하고 허용합니다.

이 스크립트들은 `.claude/settings.json` 에서 허용된 읽기 전용 작업으로 설정되어 있어, 일반적인 개발 중에는 추가 권한 프롬프트 없이 사용할 수 있습니다.

