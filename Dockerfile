FROM node:20-slim

# 작업 디렉토리 설정
WORKDIR /workspace

# 시스템 패키지 업데이트 및 필요한 도구 설치
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

# node_modules와 .next 디렉토리를 미리 생성하고 node 사용자 소유로 설정
# (docker-compose의 익명 볼륨과 충돌 방지)
RUN mkdir -p /workspace/node_modules /workspace/.next && \
    chown -R node:node /workspace/node_modules /workspace/.next

# 사용자 설정 (root가 아닌 node 사용자로 실행)
USER node

# 포트 노출
EXPOSE 3000

# 기본 명령어는 devcontainer.json에서 제어
CMD ["sleep", "infinity"]

