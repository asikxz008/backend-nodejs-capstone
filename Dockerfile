FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY secondChance-frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY secondChance-frontend/ ./
RUN CI=false npm run build

FROM node:22-alpine
WORKDIR /app/secondChance-backend
COPY secondChance-backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY secondChance-backend/ ./
COPY secondChance-frontend/public/ /app/secondChance-frontend/public/
COPY --from=frontend /frontend/build /app/secondChance-frontend/build
RUN chown -R node:node /app
USER node
EXPOSE 3060
CMD ["node", "app.js"]
