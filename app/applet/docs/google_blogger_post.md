# [Google Blogger 구글 블로그 포스팅 초안 문서]

---

## 📌 블로그 작성 가이드 (Blogger Posting Mode Guide)
1. **[작성 모드 (서식 있는 텍스트 - Compose Mode)]**: 아래 텍스트 본문을 그대로 복사하여 붙여넣고, 제목, 소제목, 볼드체 등 서식을 시각적으로 편집할 때 사용합니다.
2. **[HTML 편집 모드 (HTML View Mode)]**: Blogger 에디터 상단의 `<>`(HTML 보기) 버튼을 클릭한 후, 아래 제공되는 HTML 마크업 블록을 붙여넣어 완벽한 반응형 레이아웃과 CSS 스타일을 적용합니다.

---

### [HTML 편집용 코드 (HTML Markup Block)]
```html
<div style="font-family: 'Malgun Gothic', sans-serif; color: #333; line-height: 1.6;">
  <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 8px;">AhBiShare OneClick v1.0.0 - Windows 초간편 공유 &amp; 구형 OS 호환 유틸리티</h2>
  
  <p><strong>AhBiShare OneClick</strong>은 Windows 컴퓨터 간 공유폴더 개설(메인 PC)과 원격 드라이브 연결(클라이언트 PC), Win 10·11 호스트-클라이언트 정책 불일치 자동 정렬, Windows 7/8/8.1 구형 OS 브릿지 및 USB 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 독립형 독립형 Windows 포터블 및 인스톨러 유틸리티입니다.</p>

  <h3 style="color: #312e81; margin-top: 20px;">🚀 주요 업데이트 및 특징</h3>
  <ul>
    <li><strong>메인 PC (공유 개설)</strong>: 네트워크 프로필 개인(Private) 전환, 방화벽 TCP 445/139 개방, 무비밀번호 게스트 및 보안 계정 모드 동시 지원.</li>
    <li><strong>클라이언트 PC (원클릭 연결)</strong>: 로컬 서브넷 SMB 탐색, 드라이브 마운트, Windows 0x80070035/1219 오류 자동 진단.</li>
    <li><strong>구형 OS 공유 (Win 7·8·8.1 ⇄ Win 10·11)</strong>: SMB 2.1/3.0 호환 브릿지, 2단계 SMB 1.0 제어, 스냅샷 원복 및 순정 Win 7 `.bat` + `.reg` 4종 키트 생성.</li>
    <li><strong>용량 감소 Lite EXE 및 Inno Setup 설치 지원</strong>: 불필요 리소스 제거로 초경량 실행 파일 제공 및 프로그램 추가/제거 연동 설치.</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 20px;">🖼️ 앱 화면 미리보기</h3>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; text-align: center; border-radius: 8px; margin: 15px 0;">
    <p style="color: #64748b; font-size: 13px; margin: 0;">[AhBiShare OneClick 메인 대시보드 및 구형 OS 탭 스크린샷 영역]</p>
  </div>

  <h3 style="color: #312e81; margin-top: 20px;">📥 다운로드</h3>
  <p>
    <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest" target="_blank" style="background: #4f46e5; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">AhBiShare OneClick 최신 버전 다운로드 (GitHub Releases)</a>
  </p>

  <h3 style="color: #312e81; margin-top: 20px;">📌 버전 정보</h3>
  <p><strong>현재 버전</strong>: v1.0.0 (Semantic Versioning 규격 준수)</p>

  <h3 style="color: #312e81; margin-top: 20px;">💻 시스템 요구 사항</h3>
  <ul>
    <li><strong>운영체제</strong>: Windows 7 SP1, Windows 8, 8.1, Windows 10, Windows 11 (32비트 / 64비트 x64)</li>
    <li><strong>권한</strong>: 관리자 권한 (Administrator Privilege Required for Network Policy &amp; Firewall Configuration)</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 20px;">📞 제작자 및 공식 채널 안내</h3>
  <ul style="list-style: none; padding: 0;">
    <li>개발자: <strong>AhBiYout</strong></li>
    <li>GitHub 저장소: <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick" target="_blank">github.com/ahbiyout-all/AhBiShare-OneClick</a></li>
    <li>공식 구글 블로그: <a href="https://ahbiyoutvibe.blogspot.com/" target="_blank">ahbiyoutvibe.blogspot.com</a></li>
    <li>소속회사: <a href="https://www.cisnet.co.kr" target="_blank">(주)청운정보시스템 (cisnet.co.kr)</a></li>
  </ul>

  <h3 style="color: #312e81; margin-top: 20px;">📋 전체 업데이트 내역 (패치노트)</h3>
  <p><strong>v1.0.0 (2026-11-16)</strong></p>
  <ul>
    <li>AhBiShare OneClick 독립형 유틸리티 v1.0.0 정식 릴리즈</li>
    <li>구형 OS 공유 탭(메인/클라이언트 2단계 형식) 및 USB 오프라인 4종 키트 생성 기능 추가</li>
    <li>표준 EXE 및 용량 감소 Lite EXE(`AhBiShare_OneClick-Lite.exe`) 멀티 빌드 파이프라인 완성</li>
    <li>Inno Setup 인스톨러 자동 방화벽 등록 및 프로그램 추가/제거 연동 구현</li>
    <li>GitHub Releases 실시간 자동 업데이트 팝업 알림 시스템 구축</li>
  </ul>

  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
  <p style="font-size: 12px; color: #64748b;"><strong>추천 태그 (Tags)</strong>: AhBiShare, WindowsSharing, SMBSharing, Win7Win11, LANShare, NetworkUtility, 포터블공유, 윈도우공유, 청운정보시스템, AhBiYout</p>
</div>
```

---

### [서식 있는 텍스트 본문 (Rich Text Compose View)]

# AhBiShare OneClick v1.0.0 - Windows 초간편 공유 & 구형 OS 호환 유틸리티

**AhBiShare OneClick**은 Windows 컴퓨터 간 공유폴더 개설(메인 PC)과 원격 드라이브 연결(클라이언트 PC), Win 10·11 호스트-클라이언트 정책 불일치 자동 정렬, Windows 7/8/8.1 구형 OS 브릿지 및 USB 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 독립형 Windows 포터블 및 인스톨러 유틸리티입니다.

## 🚀 주요 업데이트 및 특징
- **메인 PC (공유 개설)**: 네트워크 프로필 개인(Private) 전환, 방화벽 TCP 445/139 개방, 무비밀번호 게스트 및 보안 계정 모드 동시 지원.
- **클라이언트 PC (원클릭 연결)**: 로컬 서브넷 SMB 탐색, 드라이브 마운트, Windows 0x80070035/1219 오류 자동 진단.
- **구형 OS 공유 (Win 7·8·8.1 ⇄ Win 10·11)**: SMB 2.1/3.0 호환 브릿지, 2단계 SMB 1.0 제어, 스냅샷 원복 및 순정 Win 7 `.bat` + `.reg` 4종 키트 생성.
- **용량 감소 Lite EXE 및 Inno Setup 설치 지원**: 불필요 리소스 제거로 초경량 실행 파일 제공 및 프로그램 추가/제거 연동 설치.

## 🖼️ 앱 화면 미리보기
> [AhBiShare OneClick 메인 대시보드 및 구형 OS 탭 스크린샷 영역]

## 📥 다운로드
- [AhBiShare OneClick 최신 버전 다운로드 (GitHub Releases)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)

## 📌 버전 정보
- **현재 버전**: v1.0.0 (Semantic Versioning 규격 준수)

## 💻 시스템 요구 사항
- **운영체제**: Windows 7 SP1, Windows 8, 8.1, Windows 10, Windows 11 (32비트 / 64비트 x64)
- **권한**: 관리자 권한 (Administrator Privilege Required for Network Policy & Firewall Configuration)

## 📞 제작자 및 공식 채널 안내
- 개발자: **AhBiYout**
- GitHub 저장소: [github.com/ahbiyout-all/AhBiShare-OneClick](https://github.com/ahbiyout-all/AhBiShare-OneClick)
- 공식 구글 블로그: [ahbiyoutvibe.blogspot.com](https://ahbiyoutvibe.blogspot.com/)
- 소속회사: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)

## 📋 전체 업데이트 내역 (패치노트)
**v1.0.0 (2026-11-16)**
- AhBiShare OneClick 독립형 유틸리티 v1.0.0 정식 릴리즈
- 구형 OS 공유 탭(메인/클라이언트 2단계 형식) 및 USB 오프라인 4종 키트 생성 기능 추가
- 표준 EXE 및 용량 감소 Lite EXE(`AhBiShare_OneClick-Lite.exe`) 멀티 빌드 파이프라인 완성
- Inno Setup 인스톨러 자동 방화벽 등록 및 프로그램 추가/제거 연동 구현
- GitHub Releases 실시간 자동 업데이트 팝업 알림 시스템 구축

---
**추천 태그 (Tags)**: AhBiShare, WindowsSharing, SMBSharing, Win7Win11, LANShare, NetworkUtility, 포터블공유, 윈도우공유, 청운정보시스템, AhBiYout, FileSharing, PCtoPC, 윈도우7공유, 파일공유프로그램 (총 14개, 128글자)
