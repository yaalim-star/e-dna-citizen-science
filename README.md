# e-DNA Citizen Science

Next.js 기반의 e-DNA 시민 과학 프로젝트입니다.

## 개발 환경 설정

이 프로젝트는 Dev Container를 사용하여 일관된 개발 환경을 제공합니다.

### 필수 요구사항

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 또는 Docker Engine
- [Visual Studio Code](https://code.visualstudio.com/)
- [Dev Containers 확장](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### 시작하기

1. **프로젝트 클론**
   ```bash
   git clone <repository-url>
   cd e-dna-citizen-science
   ```

2. **VS Code에서 Dev Container 열기**
   - VS Code에서 프로젝트 폴더를 엽니다
   - 명령 팔레트(Cmd/Ctrl + Shift + P)를 엽니다
   - "Dev Containers: Reopen in Container"를 선택합니다
   - 컨테이너가 빌드되고 시작될 때까지 기다립니다

3. **개발 서버 실행**
   - 컨테이너가 시작되면 자동으로 `pnpm install`이 실행됩니다
   - 컨테이너 내부의 터미널에서 `pnpm run dev`를 실행합니다
   - 브라우저에서 `http://localhost:3000`을 엽니다

### 사용 가능한 스크립트

- `pnpm run dev` - 개발 서버 시작
- `pnpm run build` - 프로덕션 빌드 생성
- `pnpm run start` - 프로덕션 서버 시작
- `pnpm run lint` - ESLint 실행

### 패키지 매니저

이 프로젝트는 **pnpm**을 패키지 매니저로 사용합니다. Dev Container 내에서 자동으로 설정되며, 로컬에서 개발하는 경우에도 pnpm을 사용해주세요.

### 프로젝트 구조

```
.
├── app/              # Next.js App Router 디렉토리
├── .devcontainer/    # Dev Container 설정
├── Dockerfile        # Docker 이미지 정의
├── docker-compose.yml # Docker Compose 설정
└── package.json      # 프로젝트 의존성
```

### 협업

Dev Container를 사용하면 모든 팀원이 동일한 개발 환경을 가지게 됩니다:
- 동일한 Node.js 버전
- 동일한 시스템 패키지
- 동일한 VS Code 확장 프로그램
- 자동으로 설정되는 개발 환경

### 문제 해결

**컨테이너가 시작되지 않는 경우:**
- Docker Desktop이 실행 중인지 확인하세요
- `docker-compose up -d`를 직접 실행하여 오류를 확인하세요
- 컨테이너 로그를 확인: `docker-compose logs`

**포트가 이미 사용 중인 경우:**
- `docker-compose.yml`에서 포트 번호를 변경하세요

**컨테이너가 즉시 종료되는 경우:**
- 이는 정상입니다. Dev Container가 연결되면 컨테이너가 계속 실행됩니다
- VS Code에서 "Dev Containers: Reopen in Container"를 다시 시도하세요

