/* build.js - inline css + js into dist/index.html (single file, so over-the-air updates can swap it) */
const fs = require("fs"), path = require("path");
const root = __dirname, dist = path.join(root, "dist");
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) =>
  "<style>\n" + fs.readFileSync(path.join(root, href), "utf8") + "\n</style>");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
  "<script>\n" + fs.readFileSync(path.join(root, src), "utf8").replace(/<\/script/gi, "<\\/script") + "\n</script>");
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "index.html"), html);
console.log("Built dist/index.html (" + Math.round(html.length / 1024) + " KB)");
