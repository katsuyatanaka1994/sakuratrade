const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "../src");
const targetExt = [".ts", ".tsx"];
let filesWithUIImports = [];

// 再帰的にファイル探索
function searchFiles(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      searchFiles(fullPath);
    } else if (targetExt.includes(path.extname(file))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.match(/from\s+['"].*UI\//)) {
        filesWithUIImports.push(fullPath);
      }
    }
  });
}

// 実行
searchFiles(baseDir);

// 結果出力
if (filesWithUIImports.length === 0) {
  console.log("UIインポートを含むファイルは見つかりませんでした。");
} else {
  console.log("=== UIインポートを含むファイル一覧 ===");
  filesWithUIImports.forEach((f) => console.log(f));
}