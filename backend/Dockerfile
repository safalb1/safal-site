# --- SAFAL backend: small, production image ---
FROM node:20-alpine

# Run as the built-in non-root user that the node image ships with.
WORKDIR /app

# Install only production deps first (better layer caching).
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# App source
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node

# Container-level healthcheck hits the readiness endpoint.
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
