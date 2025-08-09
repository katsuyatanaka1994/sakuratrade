const fs = require("fs");
const path = require("path");
const __dirnameResolved = __dirname;

const baseDir = path.join(__dirnameResolved, "../src");
const targetExt = [".ts", ".tsx"];
let filesWithUIImports = [];

function searchFiles(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      searchFiles(fullPath);
    } else if (targetExt.includes(path.extname(file))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      // UI または ui ディレクトリをimportしている箇所を検出
      if (content.match(/from\s+['"].*(?:UI|ui)\//)) {
        filesWithUIImports.push(fullPath);
        console.log(`\n=== ${fullPath} ===`);
        const imports = content.match(/import\s+.*?from\s+['"].*?['"]/g) || [];
        if (imports.length > 0) {
          console.log("  使用しているimport:");
          imports.forEach((line) => console.log("   ", line));
        } else {
          console.log("  ⚠️ import 文なし");
        }
      }
    }
  });
}

searchFiles(baseDir);

if (filesWithUIImports.length === 0) {
  console.log("UI/ui インポートを含むファイルは見つかりませんでした。");
} else {
  console.log("\n=== UI/ui インポートを含むファイル数:", filesWithUIImports.length, "===\n");
}