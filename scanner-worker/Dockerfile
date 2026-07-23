# Headless-render worker for the Comply-Quick compliance scanner.
# Uses the official Playwright image so Chromium + all system deps are present.
FROM mcr.microsoft.com/playwright:v1.55.1-noble

ENV NODE_ENV=production
WORKDIR /app

# Install deps first for better layer caching. Skip the postinstall browser
# download — the base image already ships the matching Chromium build.
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY server.mjs ./

EXPOSE 8080
CMD ["node", "server.mjs"]
