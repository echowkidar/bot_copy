# frontend/Dockerfile
FROM node:18 AS build

WORKDIR /app

COPY . .

RUN npm install && npm run build

# Serve the build using Nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
