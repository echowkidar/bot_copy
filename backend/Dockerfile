FROM node:18

# Puppeteer dependencies
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  wget \
  --no-install-recommends \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Puppeteer (also installs Chromium)
RUN npm install \
  && npx puppeteer browsers install chrome

# Copy project files
COPY . .

# Set environment for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome

# Create required folders (optional)
RUN mkdir -p /app/tokens

# Run the server
CMD ["node", "server.js"]
