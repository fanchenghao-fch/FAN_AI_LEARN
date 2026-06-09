FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose H5 dev server port
EXPOSE 10086

# Start H5 dev server
CMD ["npm", "run", "dev:h5"]
