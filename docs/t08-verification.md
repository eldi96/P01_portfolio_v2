# T08 패스키 통합 검증 — 2026-10-25

## 적용 범위

Notion 개발 기록의 `T08-passkey-handoff.txt`(기준 3ff92f6, 인계 구현 9e79f59)를 `codex/t08-passkey`에서 통합했다. 공개 index.html에는 푸터의 `나만의 공간` 링크만 추가했고 기존 공개 텍스트·그래픽·섹션은 보존했다. 기존 neon.ts, .neon 컨텍스트와 .env.local의 Neon 접속값은 유지했다.

- 등록·로그인·일회용 질문·세션·개인 기록·패스키 관리: `api/`, `lib/`, `migrations/`.
- 최초 등록은 운영자 CLI가 발급하는 30분 초대이며 브라우저 등록 전에는 계정에 패스키가 없다.
- 기존 Neon production을 유지하고 `dev-t08-passkey`에서 검증했다. production에는 새 `t08_` 테이블만 추가했다.
- Vercel 기존 프로젝트 `p01-portfolio-v2`를 사용했다. Preview는 개발 DB, Production은 기존 production DB다.
- Vercel DATABASE_URL은 Secret, 운영 APP_ORIGIN은 `https://p01-portfolio-v2.vercel.app` Config다. 실제 값은 문서/소스/정적 출력에 포함하지 않는다.
- 인계 코드의 Zod 4.1.11 간접 취약점은 @vercel/cli-config 범위의 4.6.7 override로 수정했다. Neon 의존성은 유지했다.
- 미사용 이미지 시안 4개는 삭제하지 않고 빌드와 업로드 대상에서 제외했다.

## 완료한 검증

| 항목 | 결과 | 범위 |
| --- | --- | --- |
| npm ci | 성공 | 최종 잠금 파일 설치 |
| npm test | 10/10 통과 | PGlite PostgreSQL + 소프트웨어 인증기 + 실제 WebAuthn 서명 검증 |
| 실제 Neon 개발 DB 테스트 | 10/10 통과 | pg + 실제 PostgreSQL 18, 개발 브랜치 전용 |
| Vercel 미리보기 HTTP | 22개 통과 | Vercel 함수 → 개발 Neon DB → 쿠키·응답, 소프트웨어 인증기 |
| 운영 API | 6개 통과 | 실제 production DB, 세션·미인증 거절·Origin 검사 |
| 대표 주소 익명 확인 | 9개 통과 | 공개/로그인 HTML 200, 미인증 자료·키 401, 설정/서버 소스 경로 404 |
| npm run check / build | 성공 | 서버·브라우저 JS 구문과 정적 빌드 |
| 정적 출력 경계 | 통과 | env·서버·초대·테스트·연구 자료 없음 |
| npm audit --omit=dev | 취약점 0 | 설치된 운영 의존성 |
| 마이그레이션 재실행 | Already applied | 개발 브랜치 재실행의 멱등성 |

자동 검사에서는 정상 등록/로그인, 서명·Origin·질문·사용자 확인 오류, 질문 재사용, 계정 간 양방향 접근, 두 번째 키, 삭제한 키·관련 세션, 마지막 키 삭제 거절, 만료와 로그아웃을 검증했다. 테스트 데이터는 개발 DB에서 정리했다.

운영 배포: `dpl_9ZenZKom8GnSiinnmk6wmY47PzJC`, production READY 후 promote 성공.
공개 주소: https://p01-portfolio-v2.vercel.app/
개인 공간: https://p01-portfolio-v2.vercel.app/private.html
브라우저에서 운영 로그인 화면·오류 없는 콘솔을 확인했다. 공개 페이지의 익명 접근을 위해 Vercel 배포 보호 설정을 해제하지 않았다.

## 미완료·한계

- 실제 기기 검증의 최신 상태는 아래 2026-10-26 기록을 따른다. 소프트웨어 인증기 검증을 실제 기기 테스트로 표시하지 않는다.
- 전체 패스키 분실 시 셀프 복구와 관리 작업 직전 재인증은 인계 코드의 미구현 범위로 유지한다. 운영자가 계정 DB에 접근할 수 있다는 이유로 본인 확인 절차를 생략해서는 안 된다.
- 운영 배포는 Vercel CLI로 진행했으며, 같은 구현과 후속 수정을 GitHub main에 반영한다. 새 환경에서도 DB 마이그레이션·서버 환경변수 설정은 별도로 필요하다.
- runtime의 비공개 응답은 no-store이고 정적 잠금 화면에는 개인 기록이 없다. 생체정보·PIN·개인키·초대 링크·세션 토큰은 검증 기록에 저장하지 않았다.

## 증거와 재현

로컬 `test-results/passkey-api.json`, `passkey-neon.json`, `passkey-vercel-preview.json`, `passkey-vercel-production.json`, `production-public.json`에 비밀값을 제외한 결과가 있다. 산출물은 Git 제외다.

`tests/http-check.mjs`는 격리된 미리보기 URL과 개발 DB만 허용한다. 실제 DB 테스트는 `T08_LIVE_DB=1` 및 전용 개발 브랜치 환경파일을 명시해야 하며 production에서는 실행하지 않는다. 일반 `npm test`는 DB 접속 정보 없이 PGlite로 실행한다.

## 추가 기기 등록 증분 — 2026-10-25

Notion `T08-additional-device.txt`(클라우드 239ce13)의 증분을 기존 PC 구현 위에 통합했다. 기존 테스트의 pg/Neon 실행 방식과 HTTP 검증 보강은 보존했다.

- 최근 5분 내 로그인한 PC에서 5분짜리 단일 사용 링크를 발급하고, 로그인하지 않은 다른 기기에서 같은 계정의 새 패스키를 등록한다.
- `002-additional-enrollment.sql`은 초대 테이블에 발급 세션 참조 컬럼만 추가한다. 기존 001 SQL은 수정하지 않았다.
- 재발급·취소·만료·발급자 로그아웃 후 링크 거절과 링크 성공 소비를 검증했다.
- 자동 테스트 12/12, 실제 Neon 개발 DB 12/12, Vercel 미리보기 HTTP 46개 통과. 이들은 소프트웨어 인증기 검증이며 실제 아이폰 Safari 등록은 아직 미검증이다.
- 운영 002 적용 후 기존 계정 1개·패스키 1개·기록 3개와 기존 공개키 지문이 동일함을 확인했다. 기존 설정·다른 작업 파일은 보존했다.
- 사용자가 테스트를 간단히 진행하도록 요청한 뒤에는 검사를 확대하지 않고 마이그레이션·배포·핵심 응답만 확인했다.
- 추가 등록 URL은 계정에 새 키를 붙이는 권한이 있으므로 채팅·노션·테스트 출력·캡처에 저장하지 않았다.

## 실제 추가 등록 확인 및 소스 정리 — 2026-10-26

- 사용자가 휴대폰 추가 등록을 완료했다고 알린 뒤 운영 DB에서 같은 계정의 패스키 2개와 초대 정상 소비를 확인했다. 저장 관리자 계정이나 기기 종류는 DB만으로 단정하지 않는다.
- 실제 아이폰에서 로그아웃 후 재로그인, 키 하나 삭제 후 성공/실패 비교, 기기 화면 증거는 별도 확인 대상이다.
- 등록 버튼 아래 진행·오류·성공 안내와 네트워크 응답 제한을 추가하고 운영에 배포했다.
- 공개키·계정·기록을 보존했다. GitHub 반영에는 .neon·.env.local·초대 파일·미사용 이미지 시안을 포함하지 않는다.
