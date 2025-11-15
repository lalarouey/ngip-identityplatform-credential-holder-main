# --------- Build Stage ---------
  FROM node:20.17-bullseye-slim AS builder

  WORKDIR /app

  RUN apt-get update && apt-get install -y git python3 make g++ && rm -rf /var/lib/apt/lists/*
  
  COPY package.json yarn.lock ./
  
  # RUN yarn install --frozen-lockfile
  RUN yarn cache clean && yarn install --frozen-lockfile --ignore-scripts --ignore-engines
  
  COPY . .
  
  RUN yarn tsc
  
  
  # --------- Production Stage ---------
  FROM node:20.17-bullseye-slim AS runner
  
  WORKDIR /app
  
  RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
  
  # Copy only what is needed
  COPY --from=builder /app/package.json ./
  COPY --from=builder /app/yarn.lock ./
  COPY --from=builder /app/dist ./dist
  
  # Install production deps only and clean cache
  RUN yarn install --production --frozen-lockfile && yarn cache clean
  
  # Expose app port
  EXPOSE 3002
  
  # Start app
  CMD ["node", "dist/src/server/server.js"]
  