FROM node:20

WORKDIR /app

COPY package*.json ./
# キャッシュや壊れた依存を削除し、クリーンインストール
RUN rm -rf node_modules package-lock.json
RUN npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]