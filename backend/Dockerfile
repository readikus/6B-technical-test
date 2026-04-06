FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm install

# Development
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENTRYPOINT ["sh", "entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS prod
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["node", "dist/main"]
