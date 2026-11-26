# 📚 AhBiShare OneClick 공식 문서 모음 (`docs/`)

이 폴더는 **AhBiShare OneClick** (`v1.3.1`)의 GitHub 배포·릴리즈·운영·Google Blogger 홍보·패치 이력 및 Semantic Versioning 문서를 한곳에 모아 관리하기 위한 공식 문서 허브입니다.

[⬅️ 루트 `README.md` (한국어)](../README.md) · [English README (`README.en.md`)](../README.en.md) · [최신 GitHub Releases (`v1.3.1`)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)

---

## 📁 문서 구성 안내

| 문서 파일 | 용도 및 대상 | 주요 내용 |
| :--- | :--- | :--- |
| [**`docs/github_release_post.md`**](github_release_post.md) | GitHub 저장소 & Releases 배포 소개용 | `v1.3.1` 최신 패치·`v1.3.0` 주요 기능(`<appDir>/backup` 자동 암호화 백업·시점 복원 · 양방향 매트릭스/마법사 동기화 · 1~17차 심층 점검), 4종 배포 EXE, 보안 아키텍처, 빌드·검증·저장소 구성 |
| [**`docs/PATCH_NOTES.md`**](PATCH_NOTES.md) | 패치 노트 & CI 릴리즈 본문 원본 | `최신 변경 내역`(`v1.3.1`) 및 SemVer(`MAJOR`/`MINOR`/`PATCH`) 3단계 누적 패치 이력(`v1.0.0`~`v1.3.1`), 1~17차 심층 점검(Deep Audit) 상세 기록 |
| [**`docs/VERSIONING.md`**](VERSIONING.md) | Semantic Versioning 버전 관리 규약 | 3단계 버전 승격 기준(`MAJOR.MINOR.PATCH`), 특이점 자동 기록 및 `scripts/bump_version.js` 전 파일 일괄 동기화 절차 |
| [**`docs/github_release_guide.md`**](github_release_guide.md) | GitHub 저장소 추적 · Actions CI 운영 가이드 | Core Tree 선별 추적 대상, `.gitignore` 엄격 차단 규칙, `push_github.bat` 안전 가드, 버전 전용 릴리즈 자산 규칙 |
| [**`docs/google_blogger_post.md`**](google_blogger_post.md) | Google Blogger 공식 블로그 포스팅용 | **`[작성 모드 (서식 있는 텍스트)]`** 및 **`[HTML 편집 모드]`** 전용 복사·붙여넣기 원고 완본, 4종 배포 표·다운로드·누적 이력 포함 |
| [**`docs/blogger_post.html`**](blogger_post.html) | Google Blogger HTML 보기 직접 업로드용 | 순수 HTML·인라인 스타일로 최적화된 블로그 게시물 완본(제목·본문·`v1.3.1` 업데이트·3종 앱 그림 플레이스홀더·다운로드·버전·요구사항·제작자·전체 기능 개선 이력·20개/200자 이내 추천 태그) |

---

## 🔄 버전 관리 · 패치 노트 · 무결성 검증 명령

코드에 주요 변경 사항(신규 기능, 호환성 특이점, 버그 수정)이 반영되면 루트의 버전 관리 스크립트를 통해 **단일 진실 원천(Single Source of Truth)** 으로 버전을 승격하고 패치 노트에 기록합니다.

```bash
# 패치(PATCH): 버그 수정, 보안·호환성 보완 (1.3.0 -> 1.3.1)
npm run version:bump -- patch --summary "패치 요약" --note "세부 수정 내용"

# 마이너(MINOR): 하위 호환 신규 기능 추가 (1.2.1 -> 1.3.0)
npm run version:bump -- minor --summary "기능 요약" --note "신규 기능 설명"

# 메이저(MAJOR): 비호환 구조 개편 (1.3.1 -> 2.0.0)
npm run version:bump -- major --summary "메이저 개편 요약" --note "주요 변경점"

# TypeScript 검증 및 15개 릴리즈·보안·백업·양방향 동기화·업데이터·SemVer 무결성 스위트 실행
npm run lint && npm run verify
```

---

- **최신 문서 갱신일**: 2026-11-26 (`v1.3.1`)
- **개발자 · 저작권**: AhBiYout (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
