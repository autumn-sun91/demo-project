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

