import { AppLocale } from '@/types/share';
import { APP_VERSION } from '@/version';

export type LicenseFamily = 'MIT' | 'ISC' | 'BSD-3-Clause' | 'Apache-2.0';

export interface ProjectLicenseInfo {
  productName: string;
  version: string;
  spdx: 'MIT';
  copyrightLine: string;
  holder: 'AhBiYout';
  repositoryUrl: string;
  mitFullText: string;
}

export interface ThirdPartyNoticeEntry {
  id: string;
  name: string;
  version: string;
  categoryKo: string;
  categoryEn: string;
  license: LicenseFamily;
  copyrightHolder: string;
  homepageUrl: string;
  summaryKo: string;
  summaryEn: string;
  licenseText: string;
}

const MIT_BODY_TEMPLATE = (copyrightHolderLine: string) => `MIT License

${copyrightHolderLine}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS
ACTION, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const ISC_BODY_TEMPLATE = (copyrightHolderLine: string) => `ISC License

${copyrightHolderLine}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;

export const PROJECT_LICENSE_INFO: ProjectLicenseInfo = {
  productName: 'AhBiShare OneClick',
  version: APP_VERSION,
  spdx: 'MIT',
  copyrightLine: 'Copyright © 2026 AhBiYout. All rights reserved.',
  holder: 'AhBiYout',
  repositoryUrl: 'https://github.com/ahbiyout-all/AhBiShare-OneClick',
  mitFullText: `MIT License

Copyright (c) 2026 AhBiYout. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORT,
ACTION, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
PERFORMANCE OF THIS SOFTWARE.`,
};

export const THIRD_PARTY_NOTICES: ThirdPartyNoticeEntry[] = [
  {
    id: 'electron',
    name: 'Electron',
    version: '41.10.7 (Win7: 21.4.4)',
    categoryKo: '데스크톱 런타임',
    categoryEn: 'Desktop Runtime',
    license: 'MIT',
    copyrightHolder: 'Electron contributors & GitHub Inc.',
    homepageUrl: 'https://www.electronjs.org/',
    summaryKo: 'Windows 데스크톱 애플리케이션 셸 및 IPC 프로세스 런타임 프레임워크',
    summaryEn: 'Windows desktop application shell and IPC runtime framework.',
    licenseText: `Copyright (c) Electron contributors
Copyright (c) 2013-2020 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  },
  {
    id: 'chromium',
    name: 'Chromium & V8 Engine',
    version: 'Bundled in Electron',
    categoryKo: '렌더링 · JS 엔진',
    categoryEn: 'Rendering & JS Engine',
    license: 'BSD-3-Clause',
    copyrightHolder: 'The Chromium Authors',
    homepageUrl: 'https://www.chromium.org/',
    summaryKo: '경량(Lite) 빌드에서 용량 절감을 위해 대용량 HTML을 정리해도 필수 저작권 고지를 유지합니다.',
    summaryEn: 'Retains mandatory Chromium & V8 attribution even when raw HTML archives are pruned in Lite builds.',
    licenseText: `Copyright 2015 The Chromium Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    version: 'Bundled in Electron',
    categoryKo: '백엔드 런타임',
    categoryEn: 'JavaScript Runtime',
    license: 'MIT',
    copyrightHolder: 'Node.js contributors',
    homepageUrl: 'https://nodejs.org/',
    summaryKo: '로컬 AES-256-GCM 암호화 저장, PowerShell 브리지 및 LAN 스캐너 실행 런타임',
    summaryEn: 'Runtime powering local AES-256-GCM encrypted persistence, PowerShell IPC, and LAN probing.',
    licenseText: MIT_BODY_TEMPLATE('Copyright Node.js contributors. All rights reserved.'),
  },
  {
    id: 'react',
    name: 'React & React DOM',
    version: '19.3.1',
    categoryKo: 'UI 프레임워크',
    categoryEn: 'UI Framework',
    license: 'MIT',
    copyrightHolder: 'Meta Platforms, Inc. and affiliates',
    homepageUrl: 'https://react.dev/',
    summaryKo: '선언형 사용자 인터페이스 렌더링 및 상태 관리 라이브러리',
    summaryEn: 'Declarative component rendering and state management runtime.',
    licenseText: MIT_BODY_TEMPLATE('Copyright (c) Meta Platforms, Inc. and affiliates.'),
  },
  {
    id: 'lucide-react',
    name: 'lucide-react',
    version: '1.79.0',
    categoryKo: '아이콘 라이브러리',
    categoryEn: 'Iconography',
    license: 'ISC',
    copyrightHolder: 'Lucide Icons and Contributors',
    homepageUrl: 'https://lucide.dev/',
    summaryKo: '앱 전반의 기능 어포던스 벡터 아이콘 세트',
    summaryEn: 'Crisp vector affordance icon components used across panels and modals.',
    licenseText: ISC_BODY_TEMPLATE('Copyright (c) 2026 Lucide Icons and Contributors'),
  },
  {
    id: 'qrcode-react',
    name: 'qrcode.react',
    version: '4.2.0',
    categoryKo: 'QR 코드 생성',
    categoryEn: 'QR Code Utility',
    license: 'ISC',
    copyrightHolder: "Paul O'Shannessy",
    homepageUrl: 'https://github.com/zpao/qrcode.react',
    summaryKo: '접속 코드(ABSHARE://) 오프라인 QR 코드 SVG 렌더링 유틸리티',
    summaryEn: 'Offline SVG QR code generator for ABSHARE:// connection codes.',
    licenseText: ISC_BODY_TEMPLATE("Copyright (c) 2015, Paul O'Shannessy"),
  },
  {
    id: 'tailwindcss',
    name: 'Tailwind CSS',
    version: '4.3.5',
    categoryKo: '스타일링 엔진',
    categoryEn: 'Styling Engine',
    license: 'MIT',
    copyrightHolder: 'Tailwind Labs, Inc.',
    homepageUrl: 'https://tailwindcss.com/',
    summaryKo: '라이트/다크 듀얼 테마 유틸리티 CSS 컴파일러',
    summaryEn: 'Utility-first styling compiler supporting light and dark interface themes.',
    licenseText: MIT_BODY_TEMPLATE('Copyright (c) Tailwind Labs, Inc.'),
  },
  {
    id: 'vite',
    name: 'Vite',
    version: '7.3.8',
    categoryKo: '빌드 번들러',
    categoryEn: 'Build Bundler',
    license: 'MIT',
    copyrightHolder: 'VoidZero Inc. and Vite contributors',
    homepageUrl: 'https://vite.dev/',
    summaryKo: 'Windows 7 Chrome 106 하위 호환 CSS/JS 프로덕션 번들러',
    summaryEn: 'Frontend module bundler targeting cross-Windows Chromium compatibility.',
    licenseText: MIT_BODY_TEMPLATE('Copyright (c) VoidZero Inc. and Vite contributors'),
  },
  {
    id: 'electron-builder',
    name: 'electron-builder',
    version: '26.18.0',
    categoryKo: '배포 패키징',
    categoryEn: 'Packaging Tool',
    license: 'MIT',
    copyrightHolder: 'electron-builder contributors',
    homepageUrl: 'https://www.electron.build/',
    summaryKo: 'Standard · Lite · Windows 7 포터블 EXE 및 NSIS 패키징 도구',
    summaryEn: 'Packaging toolchain for Standard, Lite, and Windows 7 portable executables.',
    licenseText: MIT_BODY_TEMPLATE('Copyright (c) 2015-present electron-builder contributors'),
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    version: '5.9.3',
    categoryKo: '언어 · 정적 타입',
    categoryEn: 'Type Checker',
    license: 'Apache-2.0',
    copyrightHolder: 'Microsoft Corporation',
    homepageUrl: 'https://www.typescriptlang.org/',
    summaryKo: '정적 타입 검증 및 안전한 코드 컴파일 도구',
    summaryEn: 'Static type system and compiler toolchain.',
    licenseText: `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,
  },
];

export function formatCombinedNoticesText(locale: AppLocale): string {
  const header =
    locale === 'en'
      ? `${PROJECT_LICENSE_INFO.productName} v${PROJECT_LICENSE_INFO.version}\n${PROJECT_LICENSE_INFO.copyrightLine}\nLicense: ${PROJECT_LICENSE_INFO.spdx}\n\n=== PROJECT LICENSE (MIT) ===\n\n${PROJECT_LICENSE_INFO.mitFullText}\n\n=== THIRD-PARTY OPEN-SOURCE NOTICES ===`
      : `${PROJECT_LICENSE_INFO.productName} v${PROJECT_LICENSE_INFO.version}\n${PROJECT_LICENSE_INFO.copyrightLine}\n라이선스: ${PROJECT_LICENSE_INFO.spdx}\n\n=== 프로젝트 기본 라이선스 (MIT) ===\n\n${PROJECT_LICENSE_INFO.mitFullText}\n\n=== 서드파티 오픈소스 고지 (THIRD-PARTY NOTICES) ===`;

  const blocks = THIRD_PARTY_NOTICES.map(
    (item, idx) =>
      `\n[${idx + 1}] ${item.name} (${item.version}) — ${item.license}\nCopyright: ${item.copyrightHolder}\nURL: ${item.homepageUrl}\n\n${item.licenseText}`
  ).join('\n\n------------------------------------------------------------');

  return `${header}\n${blocks}\n`;
}
