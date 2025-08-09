const fs = require("fs");
const path = require("path");

const componentsDir = path.join(__dirname, "components");
const targets = ["Login.tsx", "Onboarding.tsx", "Dashboard.tsx", "Trade.tsx", "Settings.tsx", "Support.tsx", "Header.tsx"];

targets.forEach(file => {
  const filePath = path.join(componentsDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    console.log(`\n=== ${file} ===`);
    console.log("・使用しているimport:");
    (content.match(/import\s+.*?from\s+['"].*?['"]/g) || []).forEach(line => console.log("   ", line));
    console.log("・含まれるコンポーネント:");
    (content.match(/<([A-Z][A-Za-z0-9]*)/g) || []).forEach(comp => console.log("   ", comp));
  } else {
    console.log(`\n${file} が見つかりませんでした`);
  }
});