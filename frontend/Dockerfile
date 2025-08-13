FROM node:20

WORKDIR /app

COPY package*.json ./
# キャッシュや壊れた依存を削除し、クリーンインストール
RUN rm -rf node_modules package-lock.json ~/.npm
RUN npm cache clean --force
RUN npm install
# 銘柄サジェスト機能のためのFuse.jsを明示的にインストール
RUN npm install fuse.js
# esbuildバージョン問題を解決するため強制再インストール
RUN rm -rf node_modules/.cache
# viteとesbuildを完全に削除して再インストール
RUN npm uninstall vite esbuild @vitejs/plugin-react webpack webpack-cli webpack-dev-server ts-loader html-webpack-plugin style-loader css-loader postcss-loader terser
# 不要なファイルを削除
RUN find /app/node_modules -name "*esbuild*" -type f -delete 2>/dev/null || true
RUN find /app/node_modules -name "*webpack*" -type f -delete 2>/dev/null || true
RUN find ~/.npm -name "*esbuild*" -type f -delete 2>/dev/null || true
# Create React Appをインストール
RUN npm install react-scripts@5.0.1 --save-dev --force
# react-scriptsが正しくインストールされているか確認
RUN npx react-scripts --version

COPY . .

EXPOSE 3000

# WebSocket環境変数を設定
ENV WDS_SOCKET_PORT=0
ENV CHOKIDAR_USEPOLLING=true

CMD ["npm", "start"]