FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "examples/dashboard-server.js"]
