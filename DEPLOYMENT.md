# 배포 가이드

이 Next.js 프로젝트를 웹사이트로 배포하는 방법입니다.

## 🚀 배포 옵션

### 1. Vercel (추천 - 가장 쉬움)

Vercel은 Next.js를 만든 회사에서 제공하는 플랫폼으로, 가장 간단하게 배포할 수 있습니다.

#### 단계별 가이드:

1. **GitHub에 코드 푸시**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Vercel 가입 및 연결**
   - [vercel.com](https://vercel.com)에 가입
   - "New Project" 클릭
   - GitHub 저장소 선택
   - 프로젝트 import

3. **환경 변수 설정**
   - Vercel 대시보드에서 프로젝트 설정으로 이동
   - "Environment Variables" 섹션에서 추가:
     ```
     NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your_google_map_api_key_here
     ```

4. **배포**
   - "Deploy" 버튼 클릭
   - 자동으로 빌드 및 배포 완료
   - 배포된 URL 확인 (예: `https://your-project.vercel.app`)

#### Vercel CLI 사용 (선택사항):
```bash
npm i -g vercel
vercel login
vercel
```

---

### 2. Netlify

Netlify도 Next.js 배포를 잘 지원합니다.

1. **Netlify 가입**
   - [netlify.com](https://www.netlify.com)에 가입

2. **배포 설정**
   - "Add new site" → "Import an existing project"
   - GitHub 저장소 연결
   - 빌드 설정:
     - Build command: `pnpm build` 또는 `npm run build`
     - Publish directory: `.next`
   - 환경 변수 추가:
     ```
     NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your_google_map_api_key_here
     ```

3. **배포**
   - "Deploy site" 클릭

---

### 3. 자체 서버 (Docker 사용)

프로젝트에 Dockerfile이 있다면 자체 서버에 배포할 수 있습니다.

#### 빌드 및 실행:

```bash
# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

#### Docker 사용:

```bash
# 프로덕션 이미지 빌드
docker build -f Dockerfile.prod --build-arg NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your_api_key -t e-dna-app .

# 컨테이너 실행
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your_api_key \
  e-dna-app
```

또는 환경 변수만 런타임에 설정:

```bash
# 이미지 빌드 (API 키 없이)
docker build -f Dockerfile.prod -t e-dna-app .

# 컨테이너 실행 (환경 변수 포함)
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your_api_key \
  e-dna-app
```

---

## ⚙️ 필수 환경 변수

배포 전에 다음 환경 변수를 설정해야 합니다:

### `NEXT_PUBLIC_GOOGLE_MAP_API_KEY`
- Google Maps API 키
- [Google Cloud Console](https://console.cloud.google.com/)에서 발급
- Maps JavaScript API 활성화 필요

**설정 방법:**
- Vercel/Netlify: 대시보드의 Environment Variables에서 설정
- 자체 서버: `.env.local` 파일 또는 서버 환경 변수로 설정

---

## 📝 배포 전 체크리스트

- [ ] Google Maps API 키 발급 및 환경 변수 설정
- [ ] 코드가 Git에 푸시됨 (Vercel/Netlify 사용 시)
- [ ] `pnpm build` 명령어가 성공적으로 실행됨
- [ ] 프로덕션 모드에서 테스트 (`pnpm start`)

---

## 🔧 로컬에서 프로덕션 빌드 테스트

배포 전에 로컬에서 프로덕션 빌드를 테스트할 수 있습니다:

```bash
# 의존성 설치
pnpm install

# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

그 후 [http://localhost:3000](http://localhost:3000)에서 확인하세요.

---

## 🌐 도메인 연결 (선택사항)

Vercel이나 Netlify에서 무료 도메인을 제공하지만, 커스텀 도메인을 연결할 수도 있습니다:

1. 도메인 구매 (예: Namecheap, GoDaddy)
2. Vercel/Netlify 대시보드에서 "Domains" 설정
3. DNS 레코드 설정 (자동 가이드 제공)

---

## 💡 문제 해결

### 빌드 에러가 발생하는 경우:
- `pnpm install`로 의존성 재설치
- `.next` 폴더 삭제 후 재빌드
- 환경 변수가 올바르게 설정되었는지 확인

### Google Maps가 표시되지 않는 경우:
- API 키가 올바른지 확인
- Google Cloud Console에서 Maps JavaScript API가 활성화되었는지 확인
- API 키의 제한사항(도메인 제한 등) 확인

---

## 📚 추가 리소스

- [Next.js 배포 문서](https://nextjs.org/docs/app/building-your-application/deploying)
- [Vercel 배포 가이드](https://vercel.com/docs)
- [Netlify Next.js 가이드](https://docs.netlify.com/integrations/frameworks/nextjs/)

