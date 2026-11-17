# 🛠 AhBiShare OneClick 패치 노트 (Patch Notes)

## 📅 v1.0.0 (2026-11-16) — Semantic Versioning 정식 릴리즈
- **개발자**: AhBiYout
- **소속회사**: (주)청운정보시스템 (cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick

### 주요 기능 및 개선 사항
1. **독립형 단일 애플리케이션 정립 (`v1.0.0`)**:
   - Windows 컴퓨터 간 원클릭 공유폴더 개설(메인 PC) 및 네트워크 드라이브 마운트(클라이언트 PC), `ABSHARE://` 연결 코드·QR 발급, USB 포터블 AES-256-GCM 암호화 동기화(`AhBiShare_OneClick.portable.json`) 구축.
   - PowerShell 2.0/5.1 듀얼 폴백 엔진을 통해 Windows 7 SP1 ~ Windows 11 26H2 전 세대 지원.
2. **구형 OS 공유 및 양방향 데이터 브릿지 (Win 7·8·8.1 ⇄ Win 10·11)**:
   - `1단계 메인 PC` / `2단계 클라이언트 PC` 2단계 통합 원클릭 구성 및 SMB 2.1/3.0 비암호화 호환 브릿지·2단계 SMB 1.0 안전 제어·사전 스냅샷 원복 탑재.
   - 순정 Win 7 `cmd.exe` 호환 `.bat` + UTF-16LE BOM `.reg` 오프라인 4종 키트 생성기 및 **Win 10/11 ⇄ Win 7/8 양방향 설정 데이터 브릿지(JSON)** 지원.
3. **표준·경량(Lite)·Win 7 포터블 EXE 및 버전 자동 표기 빌드 체계**:
   - 표준 포터블(`AhBiShare_OneClick_v1.0.0.exe`), 용량 감소 경량 포터블(`AhBiShare_OneClick-Lite_v1.0.0.exe`), 레거시 Win 7 전용(`AhBiShare_OneClick_Win7_v1.0.0.exe`), 설치 파일(`AhBiShare_OneClick-Setup_v1.0.0.exe`)에 버전 번호 자동 부여.
4. **Inno Setup 인스톨러 & GitHub Releases 실시간 자동 업데이트**:
   - 개별 파일 풀림(Unpacked Multi-File) 설치, 기존 프로세스 강제 종료, 기존 설치 제거/덮어쓰기 선택, 무인 설치(`/SILENT`, `/VERYSILENT`), 프로그램 추가/제거 등록, 기본명·버전명 방화벽 자동 등록 지원.
   - GitHub Releases API 연동 실시간 업데이트 감지 및 알림 팝업창 탑재.
