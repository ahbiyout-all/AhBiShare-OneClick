# AhBiShare OneClick v1.0.0

Windows 컴퓨터 간 공유폴더 개설(메인 PC)과 원격 드라이브 연결(클라이언트 PC), Win 10·11 호스트-클라이언트 정책 불일치 자동 정렬, Windows 7/8/8.1 구형 OS 브릿지 및 USB 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 **독립형 웹 / Electron 포터블 애플리케이션**입니다.

## 주요 기능

- **메인 PC (공유 개설)**:
  - 네트워크 프로필 개인(Private) 전환 및 방화벽 TCP 445·139 인바운드 허용
  - `LanmanServer`, `FDResPub`, `fdPHost`, `SSDPSrv` 서비스 자동 가동
  - **간편 무비밀번호 모드** 및 **보안 계정 모드** 동시 지원, 임시 공유 만료 타이머 및 `ABSHARE://` 연결 코드·QR 코드 발급
- **클라이언트 PC (원클릭 연결)**:
  - 로컬 서브넷(`/24`) SMB 445 포트·NetBIOS 자동 탐색 및 USB 포터블 설정(`AhBiShare_OneClick.portable.json`) 자동 채우기
  - Windows 10/11 `0x80070035`, `1272`, `5`, `1219` 오류 원인 자동 진단 및 드라이브 마운트
- **OS 호환성 매트릭스 (Win 10 ~ Win 11 26H2)**:
  - 호스트-클라이언트 양단 정책 불일치 실시간 감지 및 **원클릭 일괄 자동 정렬**, 재부팅 필요 여부 판정
- **구형 OS 공유 (Win 7 · 8 · 8.1 ⇄ Win 10 · 11)**:
  - `SMB 2.1 / 3.0` 비암호화 호환 브릿지 1클릭 적용, 2단계 위험 확인 기반 SMB 1.0 안전 제어, 사전 스냅샷 기반 정밀 원복
  - 순정 Windows 7 `cmd.exe` 호환 `.bat` + UTF-16LE BOM `.reg` 적용·원복 4종 스크립트 생성 및 USB 저장

## 실행 및 빌드

```bash
npm install
npm run dev                  # 웹 개발 서버 (http://localhost:3000)
npm run lint                 # TypeScript 타입 검증
npm run build                # 프로덕션 웹 번들 빌드 (dist/)
npm run verify               # 표준·경량 EXE 구성 및 보안 가드레일 무결성 검증
npm run electron:build       # Windows 표준 포터블/설치형 EXE (AhBiShare_OneClick.exe)
npm run electron:build:lite  # Windows 경량 포터블 EXE (AhBiShare_OneClick-Lite.exe, 용량 감소 버전)
npm run electron:build:all   # 표준 + 경량 포터블 EXE 2종 일괄 빌드 및 용량 비교
```

### 경량 버전(`AhBiShare_OneClick-Lite.exe`) 용량 최적화 내역 (Win 7~11 전 세대 단독 실행 유지)
- Vite로 이미 번들된 `node_modules` 중복 패키징 제외 (`app.asar` 대폭 축소)
- `ko`, `en-US` 로케일만 유지하고 미사용 다국어 `.pak` 및 방대한 Chromium 라이선스 HTML 제거
- UI 렌더링과 무관한 WebGPU DXC(`dxcompiler.dll`, `dxil.dll`) 및 Vulkan 소프트웨어 래스터라이저(`vk_swiftshader.dll`, `vulkan-1.dll`) 제거
- Windows 7~11 호환 필수 코어(`icudtl.dat`, `ffmpeg.dll`, `libGLESv2.dll`, `libEGL.dll`, `d3dcompiler_47.dll`, `v8_context_snapshot.bin`) 보존 및 최대 LZMA 압축 적용

## 제작자 및 공식 채널 안내
- **개발자**: AhBiYout
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **소속**: https://www.cisnet.co.kr
- **소속회사**: (주)청운정보시스템 (cisnet.co.kr)
