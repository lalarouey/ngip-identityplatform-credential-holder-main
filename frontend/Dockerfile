# -------- Build Stage --------
  FROM node:20.17-bullseye-slim AS builder

  WORKDIR /app
  
  COPY package.json package-lock.json ./
  
  RUN npm ci
  
  COPY . .
  
  # Build the frontend
  RUN npm run build
  
  
  # -------- Production Stage --------
  FROM nginx:stable-alpine
  
  # Remove default nginx static files
  RUN rm -rf /usr/share/nginx/html/*
  
  # Copy custom nginx config
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  
  # Copy only built frontend
  COPY --from=builder /app/dist /usr/share/nginx/html
  
  EXPOSE 80
  
  # Start nginx
  CMD ["nginx", "-g", "daemon off;"]
  