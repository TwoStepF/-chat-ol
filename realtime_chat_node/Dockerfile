FROM node:16.16.0-alpine
RUN apk add --update --no-cache curl py-pip
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "src/index.ts"]
EXPOSE 3000