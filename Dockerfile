FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
COPY server ./server
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
