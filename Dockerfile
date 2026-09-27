FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy application source code
COPY . .

# Build frontend production bundle
RUN npm run build

# Default environment configuration
ENV PORT=3000
ENV NODE_ENV=production

# Expose port (Cloud Run, Render, Railway will bind to $PORT dynamically)
EXPOSE 3000

# Start server
CMD ["npm", "start"]
