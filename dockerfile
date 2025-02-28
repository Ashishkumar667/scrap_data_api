FROM node:18-bullseye
WORKDIR /app
COPY package.json ./
RUN npm install
RUN apt-get update && apt-get install -y \
wget \
curl \
unzip \
fonts-liberation \
libasound2 \
libatk1.0-0 \
libcairo2 \
libcups2 \
libfontconfig1 \
libgbm-dev \
libgtk-3-0 \
libnspr4 \
libnss3 \
libx11-xcb1 \
libxcomposite1 \
libxcursor1 \
libxdamage1 \
libxfixes3 \
libxi6 \
libxrandr2 \
libxrender1 \
libxss1 \
libxtst6 \
ca-certificates \
--no-install-recommends && \
rm -rf /var/lib/apt/lists/*
COPY . .
EXPOSE 3000
CMD ["node", "Server.js"]