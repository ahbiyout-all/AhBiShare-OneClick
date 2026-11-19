# [Google Blogger 구글 블로그 포스팅 문서]

> 공식 구글 블로그([https://ahbiyoutvibe.blogspot.com/](https://ahbiyoutvibe.blogspot.com/)) 게시용 원고입니다.  
> 아래 **[작성 모드 (서식 있는 텍스트)]** 또는 **[HTML 편집 모드]** 중 사용하시는 에디터 모드에 맞춰 그대로 복사하여 게시하세요.

---

## 1️⃣ [작성 모드 (서식 있는 텍스트)]

# AhBiShare OneClick v1.1.1 — Windows 7~11 원클릭 공유폴더 · 사용장소 프로필 · 포터블 자동 교체 유틸리티

## 프로그램 소개
**AhBiShare OneClick**은 Windows PC 간 폴더 공유 개설(메인 PC), 네트워크 드라이브 연결(클라이언트 PC), 사용장소별(사무실·집·현장) 설정 파일 저장 및 원클릭 일괄 적용, Windows 10·11 정책 불일치 자동 정렬, 그리고 Windows 7·8·8.1 구형 OS 호환 브릿지 및 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 **무료 오픈소스 유틸리티**입니다.

---

## ✨ 이번 업데이트 주요 내용 (v1.1.1 · 2026-11-18)
- **사용장소별 개별 프로필(`.location.json`) & 1클릭 일괄 적용 (신규)**:
  - 사무실·집·현장 등 작업 장소마다 호스트 공유 설정과 클라이언트 네트워크 드라이브 구성을 **AES-256-GCM 암호화**된 `.location.json` 파일로 분리 저장하고, JSON 내보내기/불러오기 및 버튼 한 번으로 일괄 적용할 수 있습니다.
- **GitHub 자동 업데이트 감지 + 기존 포터블 종료·제거·자동 교체 (신규)**:
  - GitHub Releases에서 최신 버전을 감지하면 업데이트 확인창을 표시하며, 현재 실행 중인 에디션(`표준` · `Lite` · `Win7`)을 자동 판별해 동일 에디션의 최신 `.exe`를 내려받습니다.
  - 공식 GitHub 도메인 검증 및 Windows PE 실행 헤더(`MZ`) 무결성 검증 후, **기존 포터블 프로세스를 종료·제거하고 새 버전 포터블로 자동 교체 및 재실행**합니다. (기존 `.portable.json` 및 `locations/` 데이터 유지)
- **Windows 7 화면 및 PowerShell 2.0 호환성 강화**:
  - Tailwind CSS v4 `oklch()` 색상을 Electron 21(Chromium 106) 호환 색상으로 컴파일 변환해 Windows 7 환경에서 화면이 검게 보이던 문제를 해결했고, PowerShell 2.0 콘솔/변수 예외(`$PSDefaultParameterValues`, `[Console]` 핸들 등)를 보완했습니다.
- **심층 안정화 및 릴리즈 무결성 체계 정비**:
  - HTTP 청크 다운로드 완료(`res.complete`) 및 취소 동기화, USB 루트 드라이브(`E:\`) 키트 저장 경로, 모달 위 토스트 겹침(`z-[60]`), SemVer 2.0 pre-release 비교 오류를 수정했으며, 저장소 핵심 소스·공식 문서·버전 관리(`MAJOR.MINOR.PATCH`) 체계를 정비했습니다.

---

## 📦 배포 파일 안내 (4종)
| 배포 파일명 | 권장 운영체제 | 설명 |
| :--- | :--- | :--- |
| **`AhBiShare_OneClick_v1.1.1.exe`** | Windows 10 / 11 (x64) | 표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행) |
| **`AhBiShare_OneClick-Lite_v1.1.1.exe`** | Windows 10 / 11 (x64) | 불필요한 로케일·그래픽 모듈을 경량화한 포터블 버전 |
| **`AhBiShare_OneClick_Win7_v1.1.1.exe`** | Windows 7 SP1 / 8 / 8.1 (x64) | 구형 OS 전용 Electron 21 기반 호환 포터블 빌드 |
| **`AhBiShare_OneClick-Setup_v1.1.1.exe`** | Windows 7 ~ 11 (x64) | Inno Setup 설치형 (바로가기 및 방화벽 자동 등록) |

---

## 🖼️ 앱 미리보기 (스크린샷)
> [이곳에 AhBiShare OneClick 메인 워크스페이스, 사용장소 프로필 바, 포터블 자동 교체 업데이트 확인창 실행 화면 캡처를 삽입하세요]

---

## 📥 공식 다운로드
- 🔗 **[AhBiShare OneClick v1.1.1 공식 다운로드 (GitHub Releases)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)**

---

## 🏷️ 버전 및 시스템 요구 사항
- **현재 버전**: v1.1.1 (Semantic Versioning: `MAJOR.MINOR.PATCH`)
- **배포 파일**: `AhBiShare_OneClick_v1.1.1.exe`, `AhBiShare_OneClick-Lite_v1.1.1.exe`, `AhBiShare_OneClick_Win7_v1.1.1.exe`, `AhBiShare_OneClick-Setup_v1.1.1.exe`
- **지원 운영체제**: Windows 7 SP1, Windows 8 / 8.1, Windows 10, Windows 11 (21H2 ~ 26H2, x64)
- **실행 권한**: 관리자 권한 필수 (SMB 서비스, 방화벽 TCP 445·139 및 레지스트리 정책 적용)

---

## 👨‍💻 제작자 및 공식 채널 안내
- **개발자 · 저작권**: AhBiYout (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: [https://github.com/ahbiyout-all/AhBiShare-OneClick](https://github.com/ahbiyout-all/AhBiShare-OneClick)
- **공식 구글 블로그**: [https://ahbiyoutvibe.blogspot.com/](https://ahbiyoutvibe.blogspot.com/)
- **라이선스**: MIT License

---

## 📜 전체 업데이트 누적 이력
- **v1.1.0 (2026-11-18 · MINOR)**
  - 사용장소별 개별 프로필(`.location.json`, AES-256-GCM 암호화), JSON 내보내기/불러오기 및 1클릭 일괄 적용 추가
  - GitHub Releases 업데이트 확인창 및 기존 포터블 종료·제거 후 새 포터블 자동 교체·재실행(Self-Replace) 기능 추가
  - Win 7 Chromium 106 CSS(`oklch()`) 호환성, PowerShell 2.0 가드, USB 루트 경로, 다운로드 스트림 취소 동기화 등 심층 오류 수정 및 저장소 Core Tree·문서 체계 정비
- **v1.0.0 (2026-11-16 · MAJOR)**
  - AhBiShare OneClick 단독 독립형 애플리케이션 정립 및 Win 7~11 전 세대 통합 지원
  - 구형 OS 공유 2단계(메인·클라이언트) 통합 원클릭·오프라인 `.bat`/`.reg` 4종 키트·양방향 JSON 데이터 브릿지 추가
  - 표준·경량 Lite·Win 7 전용 포터블 EXE 및 Inno Setup 인스톨러·GitHub 실시간 업데이트 알림 구축

---

## 🏷️ 추천 태그
AhBiShare, 폴더공유, 윈도우공유, SMB공유, 네트워크드라이브, Win7공유, Win11공유, LANShare, WindowsSharing, SMBBridge, PortableTool, 청운정보시스템, AhBiYout

---

## 2️⃣ [HTML 편집 모드]

> Google Blogger 글쓰기 화면 상단 왼쪽 `<> (HTML 보기)` 모드로 전환한 뒤 아래 HTML 코드를 통째로 붙여넣으세요.

```html
<div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1e293b; line-height: 1.75; max-width: 840px; margin: 0 auto; font-size: 15px;">
  <h2 style="color: #4338ca; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 18px; line-height: 1.4;">
    AhBiShare OneClick v1.1.1 — Windows 7~11 원클릭 공유폴더 · 사용장소 프로필 · 포터블 자동 교체 유틸리티
  </h2>

  <p style="margin-bottom: 18px;">
    <strong>AhBiShare OneClick</strong>은 Windows PC 간 폴더 공유 개설(메인 PC), 네트워크 드라이브 연결(클라이언트 PC), 사용장소별(사무실·집·현장) 설정 파일 저장 및 원클릭 일괄 적용, Windows 10·11 정책 불일치 자동 정렬, 그리고 Windows 7·8·8.1 구형 OS 호환 브릿지 및 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 <strong>무료 오픈소스 유틸리티</strong>입니다.
  </p>

  <div style="background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 16px 18px; margin: 20px 0;">
    <h3 style="color: #312e81; margin: 0 0 10px 0; font-size: 17px;">✨ 이번 업데이트 주요 내용 (v1.1.1 · 2026-11-18)</h3>
    <ul style="margin: 0; padding-left: 20px;">
      <li style="margin-bottom: 8px;"><strong>사용장소별 개별 프로필(.location.json) &amp; 1클릭 일괄 적용 (신규)</strong>: 사무실·집·현장별 공유·드라이브 구성을 <strong>AES-256-GCM 암호화</strong>된 <code>.location.json</code> 파일로 저장·불러오기·내보내기하고 버튼 한 번으로 일괄 연결합니다.</li>
      <li style="margin-bottom: 8px;"><strong>포터블 원클릭 자동 업데이트 교체 (신규)</strong>: GitHub 최신 버전 감지 시 실행 중인 에디션(표준·Lite·Win7)을 자동 판별해 내려받고, 공식 도메인 및 Windows PE 실행 헤더(<code>MZ</code>) 검증 후 <strong>기존 포터블 EXE를 종료·제거하고 새 버전으로 자동 교체·재실행</strong>합니다.</li>
      <li style="margin-bottom: 8px;"><strong>Windows 7 화면 &amp; PowerShell 2.0 호환성 강화</strong>: Win 7(Electron 21) 화면 미표시 문제(<code>oklch()</code> 색상 호환 변환)와 PowerShell 2.0 콘솔·변수 예외를 해결해 Win 7 SP1 ~ Win 11 26H2 전 세대 안정성을 확보했습니다.</li>
      <li><strong>원클릭 공유 개설·구형 OS 브릿지·무결성 정비</strong>: 방화벽 TCP 445·139 자동 개방, <code>ABSHARE://</code> 연결 코드·QR 발급, USB 오프라인 <code>.bat</code>/<code>.reg</code> 키트, 양방향 JSON 데이터 브릿지 및 다운로드 취소·USB 루트 경로 버그를 모두 보완했습니다.</li>
    </ul>
  </div>

  <h3 style="color: #312e81; margin-top: 26px; font-size: 17px;">📦 배포 파일 안내 (4종)</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0 22px 0; font-size: 14px;">
    <thead>
      <tr style="background: #f1f5f9; color: #0f172a; text-align: left;">
        <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">배포 파일명</th>
        <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">권장 운영체제</th>
        <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">설명</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick_v1.1.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 10 / 11 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행)</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick-Lite_v1.1.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 10 / 11 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">불필요한 로케일·WebGPU·Vulkan 제거 경량 포터블</td>
      </tr>
      <tr>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick_Win7_v1.1.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 7 SP1 / 8 / 8.1 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">구형 OS 전용 Electron 21 기반 호환 포터블 빌드</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick-Setup_v1.1.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 7 ~ 11 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Inno Setup 설치형 (바로가기·방화벽 자동 등록)</td>
      </tr>
    </tbody>
  </table>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">🖼️ 앱 미리보기 (스크린샷)</h3>
  <div style="background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 10px; padding: 26px; text-align: center; margin: 12px 0 22px 0;">
    <p style="margin: 0; color: #64748b; font-size: 13px;">[이곳에 AhBiShare OneClick 메인 화면 / 사용장소 프로필 바 / 포터블 자동 업데이트 창 스크린샷 이미지를 삽입하세요]</p>
  </div>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">📥 공식 다운로드</h3>
  <p style="margin: 12px 0 22px 0;">
    <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">AhBiShare OneClick v1.1.1 공식 다운로드 (GitHub Releases)</a>
  </p>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">🏷️ 버전 및 시스템 요구 사항</h3>
  <ul style="padding-left: 20px;">
    <li><strong>최신 버전</strong>: v1.1.1 (Semantic Versioning: MAJOR.MINOR.PATCH)</li>
    <li><strong>배포 파일</strong>: <code>AhBiShare_OneClick_v1.1.1.exe</code> · <code>AhBiShare_OneClick-Lite_v1.1.1.exe</code> · <code>AhBiShare_OneClick_Win7_v1.1.1.exe</code> · <code>AhBiShare_OneClick-Setup_v1.1.1.exe</code></li>
    <li><strong>운영체제</strong>: Windows 7 SP1, Windows 8 / 8.1, Windows 10, Windows 11 (21H2 ~ 26H2, x64)</li>
    <li><strong>실행 권한</strong>: 관리자 권한 필수 (SMB 서비스, 방화벽 TCP 445·139 및 레지스트리 정책 적용)</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">👨‍💻 제작자 및 공식 채널 안내</h3>
  <ul style="padding-left: 20px;">
    <li><strong>개발자 · 저작권</strong>: AhBiYout (Copyright © 1998-2026 AhBiYout. All rights reserved.)</li>
    <li><strong>소속회사</strong>: <a href="https://www.cisnet.co.kr" target="_blank" rel="noopener noreferrer">(주)청운정보시스템 (cisnet.co.kr)</a></li>
    <li><strong>GitHub 저장소</strong>: <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick" target="_blank" rel="noopener noreferrer">https://github.com/ahbiyout-all/AhBiShare-OneClick</a></li>
    <li><strong>공식 구글 블로그</strong>: <a href="https://ahbiyoutvibe.blogspot.com/" target="_blank" rel="noopener noreferrer">https://ahbiyoutvibe.blogspot.com/</a></li>
    <li><strong>라이선스</strong>: MIT License</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">📜 전체 업데이트 누적 이력</h3>
  <p style="margin-bottom: 6px;"><strong>v1.1.0 (2026-11-18 · MINOR)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>사용장소별 개별 프로필(<code>.location.json</code>) AES-256-GCM 암호화 저장, JSON 내보내기/불러오기 및 1클릭 일괄 적용 추가</li>
    <li>GitHub Releases 실시간 업데이트 확인창 및 기존 포터블 종료·제거·새 파일 자동 교체(Self-Replace) 기능 추가</li>
    <li>Windows 7 Electron 21 화면 렌더링(<code>oklch()</code> 변환), PowerShell 2.0 호환성, USB 루트 드라이브 저장, 다운로드 무결성·취소 동기화 수정 및 저장소/문서 체계 정비</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.0.0 (2026-11-16 · MAJOR)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>AhBiShare OneClick 단독 독립형 애플리케이션 출범 및 Win 7~11 전 세대 호환 파이프라인 정립</li>
    <li>구형 OS 공유 2단계(메인·클라이언트) 통합 원클릭 및 순정 Win 7 오프라인 <code>.bat</code>/<code>.reg</code> 4종 키트 생성기 추가</li>
    <li>Win 10·11 ⇄ Win 7·8 간 공유 설정 양방향 JSON 데이터 브릿지 동기화 기능 추가</li>
    <li>표준·경량 Lite·Win 7 전용 포터블 EXE 및 방화벽 자동 등록 Inno Setup 인스톨러 구축</li>
  </ul>

  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="font-size: 12px; color: #64748b;">
    <strong>추천 태그</strong>: AhBiShare, 폴더공유, 윈도우공유, SMB공유, 네트워크드라이브, Win7공유, Win11공유, LANShare, WindowsSharing, SMBBridge, PortableTool, 청운정보시스템, AhBiYout
  </p>
</div>
```
