FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

RUN mkdir -p /app/logs && chown -R node:node /app
USER node

EXPOSE 5000
# dd-trace is loaded first so Express and MongoDB are instrumented; it stays inert when DD_TRACE_ENABLED=false.
CMD ["node", "--import", "dd-trace/initialize.mjs", "src/server.js"]
