# [Google Blogger 구글 블로그 포스팅 문서]

---

## 📌 블로그 작성 모드 안내
1. **[작성 모드 (서식 있는 텍스트 - Compose Mode)]**: 아래 `서식 있는 텍스트 본문`을 복사하여 붙여넣어 제목·목록·링크 서식을 그대로 활용합니다.
2. **[HTML 편집 모드 (HTML View Mode)]**: Blogger 에디터 상단 왼쪽 `<> (HTML 보기)` 전환 후 아래 `HTML 편집용 코드` 전체를 붙여넣습니다.

---

### [HTML 편집용 코드 (HTML Editing Mode)]
```html
<div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1e293b; line-height: 1.7; max-width: 820px; margin: 0 auto;">
  <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">AhBiShare OneClick v1.1.0 — Windows 7~11 원클릭 공유폴더 &amp; 사용장소 프로필·포터블 자동 교체 유틸리티</h2>

  <p><strong>AhBiShare OneClick</strong>은 Windows PC 간 폴더 공유 개설(메인 PC), 네트워크 드라이브 연결(클라이언트 PC), 사용장소별(사무실·집·현장) 설정 파일 저장 및 원클릭 일괄 적용, Windows 10·11 정책 불일치 자동 정렬, 그리고 Windows 7·8·8.1 구형 OS 호환 브릿지 및 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 무료 오픈소스 유틸리티입니다.</p>

  <h3 style="color: #312e81; margin-top: 24px;">✨ 이번 업데이트 주요 내용 (v1.1.0)</h3>
  <ul>
    <li><strong>사용장소별 개별 프로필(.location.json) &amp; 1클릭 일괄 적용 (신규)</strong>: 사무실·집·현장 등 작업 장소별 공유·드라이브 구성을 AES-256-GCM 암호화된 <code>.location.json</code> 파일로 저장·불러오기·내보내기하고, 버튼 한 번으로 일괄 연결합니다.</li>
    <li><strong>포터블 원클릭 자동 업데이트 교체 (신규)</strong>: GitHub 최신 버전 감지 시 실행 중인 에디션(표준·Lite·Win7)을 자동 판별하고, 내려받기 및 실행 헤더 무결성(PE) 검증 후 기존 포터블 EXE를 종료·제거하고 새 버전으로 자동 교체·재실행합니다.</li>
    <li><strong>Windows 7 UI &amp; PowerShell 2.0 호환성 강화</strong>: Win 7(Electron 21) 환경 화면 미표시 문제(<code>oklch()</code> 변환) 및 PowerShell 2.0 콘솔/변수 예외를 수정해 Win 7 SP1 ~ Win 11 26H2 전 세대 안정성을 높였습니다.</li>
    <li><strong>원클릭 공유 개설·구형 OS 브릿지·경량 Lite 빌드</strong>: 방화벽 TCP 445·139 자동 개방, <code>ABSHARE://</code> 연결 코드·QR 발급, USB 오프라인 <code>.bat</code>/<code>.reg</code> 키트 및 양방향 JSON 데이터 브릿지를 제공합니다.</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px;">🖼️ 앱 그림 (미리보기)</h3>
  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 24px; text-align: center; margin: 14px 0;">
    <p style="margin: 0; color: #64748b; font-size: 13px;">[이곳에 AhBiShare OneClick 실행 화면(메인 워크스페이스 / 사용장소 프로필 바 / 포터블 자동 업데이트 창) 캡처 이미지를 삽입하세요]</p>
  </div>

  <h3 style="color: #312e81; margin-top: 24px;">📥 다운로드</h3>
  <p>
    <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 11px 22px; border-radius: 8px; text-decoration: none; font-weight: bold;">AhBiShare OneClick v1.1.0 공식 다운로드 (GitHub Releases)</a>
  </p>

  <h3 style="color: #312e81; margin-top: 24px;">🏷️ 버전 정보</h3>
  <ul>
    <li><strong>최신 버전</strong>: v1.1.0 (Semantic Versioning: MAJOR.MINOR.PATCH)</li>
    <li><strong>배포 파일</strong>: <code>AhBiShare_OneClick_v1.1.0.exe</code> (표준 포터블) · <code>AhBiShare_OneClick-Lite_v1.1.0.exe</code> (경량 Lite) · <code>AhBiShare_OneClick_Win7_v1.1.0.exe</code> (Win 7/8 전용) · <code>AhBiShare_OneClick-Setup_v1.1.0.exe</code> (설치형)</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px;">💻 시스템 요구 사항</h3>
  <ul>
    <li><strong>운영체제</strong>: Windows 7 SP1, Windows 8 / 8.1, Windows 10, Windows 11 (21H2 ~ 26H2, x64)</li>
    <li><strong>실행 권한</strong>: 관리자 권한 필수 (SMB 서비스, 방화벽 및 레지스트리 정책 적용)</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px;">👨‍💻 제작자 및 공식 채널 안내</h3>
  <ul>
    <li><strong>개발자 · 저작권</strong>: AhBiYout (Copyright © 1998-2026 AhBiYout. All rights reserved.)</li>
    <li><strong>소속회사</strong>: <a href="https://www.cisnet.co.kr" target="_blank" rel="noopener noreferrer">(주)청운정보시스템 (cisnet.co.kr)</a></li>
    <li><strong>GitHub 저장소</strong>: <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick" target="_blank" rel="noopener noreferrer">https://github.com/ahbiyout-all/AhBiShare-OneClick</a></li>
    <li><strong>공식 구글 블로그</strong>: <a href="https://ahbiyoutvibe.blogspot.com/" target="_blank" rel="noopener noreferrer">https://ahbiyoutvibe.blogspot.com/</a></li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px;">📜 전체 업데이트 내역 (누적 이력)</h3>
  <p><strong>v1.1.0 (2026-11-18 · MINOR)</strong></p>
  <ul>
    <li>사용장소별 개별 프로필(<code>.location.json</code>) AES-256-GCM 암호화 저장, JSON 내보내기/불러오기 및 1클릭 일괄 적용 추가</li>
    <li>GitHub Releases 실시간 업데이트 확인창 및 기존 포터블 종료·제거·새 파일 자동 교체(Self-Replace) 기능 추가</li>
    <li>Windows 7 Electron 21 화면 렌더링(<code>oklch()</code> 변환), PowerShell 2.0 호환성, USB 루트 드라이브 저장, 다운로드 무결성 및 취소 동기화 수정</li>
  </ul>
  <p><strong>v1.0.0 (2026-11-16 · MAJOR)</strong></p>
  <ul>
    <li>AhBiShare OneClick 단독 독립형 애플리케이션 출범 및 Win 7~11 전 세대 호환 파이프라인 정립</li>
    <li>구형 OS 공유 2단계(메인·클라이언트) 통합 원클릭 및 순정 Win 7 오프라인 <code>.bat</code>/<code>.reg</code> 4종 키트 생성기 추가</li>
    <li>Win 10·11 ⇄ Win 7·8 간 공유 설정 양방향 JSON 데이터 브릿지 동기화 기능 추가</li>
    <li>표준·경량 Lite·Win 7 전용 포터블 EXE 및 방화벽 자동 등록 Inno Setup 인스톨러 구축</li>
  </ul>

  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="font-size: 12px; color: #64748b;"><strong>추천 태그</strong>: AhBiShare, 폴더공유, 윈도우공유, SMB공유, 네트워크드라이브, Win7공유, Win11공유, LANShare, WindowsSharing, SMBBridge, PortableTool, 청운정보시스템, AhBiYout</p>
</div>
```

---

### [작성 모드 (서식 있는 텍스트 - Compose Mode)]

# AhBiShare OneClick v1.1.0 — Windows 7~11 원클릭 공유폴더 & 사용장소 프로필·포터블 자동 교체 유틸리티

## 본문
**AhBiShare OneClick**은 Windows PC 간 공유폴더 개설(메인 PC), 네트워크 드라이브 연결(클라이언트 PC), 사용장소별(사무실·집·현장) 설정 파일 저장 및 원클릭 일괄 적용, Windows 10·11 정책 불일치 자동 정렬, 그리고 Windows 7·8·8.1 구형 OS 호환 브릿지 및 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 무료 오픈소스 유틸리티입니다.

## 업데이트
- **사용장소별 개별 프로필(`.location.json`) & 1클릭 일괄 적용**: 사무실·집·현장별 공유/드라이브 구성을 암호화된 JSON 파일로 저장·불러오기·내보내기하고 버튼 한 번으로 일괄 적용
- **포터블 원클릭 자동 업데이트 교체**: GitHub 최신 버전 감지 시 실행 중인 에디션(`Standard`·`Lite`·`Win7`)을 자동 매칭해 내려받고, 무결성(PE) 검증 후 기존 포터블 EXE를 종료·삭제한 뒤 새 파일로 교체·재실행
- **Windows 7 화면 및 PowerShell 2.0 호환성 강화**: Win 7(Electron 21) 화면 표시 오류 및 PowerShell 2.0 변수/콘솔 예외 수정
- **원클릭 공유 개설 및 구형 OS 공유**: 방화벽 TCP 445·139 개방, `ABSHARE://` 연결 코드·QR 코드 발급, USB 오프라인 4종(`.bat`/`.reg`) 키트 및 양방향 JSON 데이터 브릿지

## 앱 그림
> [이곳에 AhBiShare OneClick 메인 워크스페이스, 사용장소 프로필 바, 포터블 자동 교체 업데이트 창 스크린샷을 삽입하세요]

## 다운로드
- [AhBiShare OneClick v1.1.0 공식 다운로드 (GitHub Releases)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)

## 버전 정보
- **현재 버전**: v1.1.0 (Semantic Versioning: MAJOR.MINOR.PATCH)
- **배포 파일**: `AhBiShare_OneClick_v1.1.0.exe`, `AhBiShare_OneClick-Lite_v1.1.0.exe`, `AhBiShare_OneClick_Win7_v1.1.0.exe`, `AhBiShare_OneClick-Setup_v1.1.0.exe`

## 시스템 요구 사항
- **운영체제**: Windows 7 SP1, Windows 8 / 8.1, Windows 10, Windows 11 (21H2 ~ 26H2, x64)
- **권한**: 관리자 권한 필수

## 제작자 및 공식 채널 안내
- **개발자 · 저작권**: AhBiYout (Copyright © 1998-2026 AhBiYout. All rights reserved.)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: [https://github.com/ahbiyout-all/AhBiShare-OneClick](https://github.com/ahbiyout-all/AhBiShare-OneClick)
- **공식 구글 블로그**: [https://ahbiyoutvibe.blogspot.com/](https://ahbiyoutvibe.blogspot.com/)

## 전체 업데이트
- **v1.1.0 (2026-11-18 · MINOR)**
  - 사용장소별 `.location.json` 프로필(AES-256-GCM 암호화), JSON 내보내기/불러오기 및 1클릭 일괄 적용 추가
  - GitHub Releases 업데이트 확인창 및 기존 포터블 종료·제거 후 새 포터블 자동 교체·재실행 기능 추가
  - Win 7 Chromium 106 CSS(`oklch()`) 호환성, PowerShell 2.0 가드, USB 루트 경로, 다운로드 스트림 취소 동기화 등 심층 오류 수정
- **v1.0.0 (2026-11-16 · MAJOR)**
  - AhBiShare OneClick 단독 독립형 애플리케이션 정립 및 Win 7~11 통합 지원
  - 구형 OS 공유 2단계 통합 원클릭·오프라인 `.bat`/`.reg` 키트·양방향 데이터 브릿지 추가
  - 표준·경량 Lite·Win 7 전용 포터블 EXE 및 Inno Setup 인스톨러·GitHub 실시간 업데이트 알림 구축

## 추천 태그
AhBiShare, 폴더공유, 윈도우공유, SMB공유, 네트워크드라이브, Win7공유, Win11공유, LANShare, WindowsSharing, SMBBridge, PortableTool, 청운정보시스템, AhBiYout
(13개 태그 · 115자)
