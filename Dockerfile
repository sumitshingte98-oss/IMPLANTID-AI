# ---- Build Stage ----
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json ./
# Install all dependencies (including devDependencies for build)
RUN npm install --legacy-peer-deps

COPY . .

# Build the Vite frontend
RUN npm run build

# Compile server.ts to server.js using esbuild (already in devDependencies)
RUN npx esbuild server.ts --bundle --platform=node --format=esm --outfile=server.js \
    --external:express --external:dotenv --external:@google/genai --external:vite \
    --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

# ---- Production Stage ----
FROM node:22-slim

WORKDIR /app

COPY package.json ./
# Install only production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Copy built frontend and compiled server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
