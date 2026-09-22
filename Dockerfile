FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3847
CMD ["node", "server.js"]
