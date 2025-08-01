FROM node:18-slim

# Install dependencies for Chromium
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    chromium \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Puppeteer needs this environment variable
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy your backend code
COPY . .

# Install Node dependencies
RUN npm install

# Expose port
EXPOSE 3002

# Start the server
CMD ["npm", "start"]
