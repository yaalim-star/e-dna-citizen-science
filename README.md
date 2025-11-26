This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 배포 (Deployment)

웹사이트로 배포하는 방법은 [DEPLOYMENT.md](./DEPLOYMENT.md) 파일을 참고하세요.

### 빠른 배포 (Vercel 추천)

1. GitHub에 코드 푸시
2. [Vercel](https://vercel.com)에 가입하고 프로젝트 연결
3. 환경 변수 설정: `NEXT_PUBLIC_GOOGLE_MAP_API_KEY`
4. 배포 완료!

자세한 내용은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 확인하세요.

## 환경 변수

프로젝트를 실행하기 전에 다음 환경 변수를 설정해야 합니다:

- `NEXT_PUBLIC_GOOGLE_MAP_API_KEY`: Google Maps API 키 ([Google Cloud Console](https://console.cloud.google.com/)에서 발급)

`.env.local` 파일을 생성하여 설정할 수 있습니다:

```bash
NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your_api_key_here
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
