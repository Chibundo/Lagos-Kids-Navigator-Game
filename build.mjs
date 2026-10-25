import { cp, mkdir } from "node:fs/promises";
const dest = new URL("./dist/", import.meta.url);
await mkdir(dest, { recursive: true });
for (const file of ["index.html", "styles.css", "app.js", "geo.mjs", "config.js"]) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(file, dest));
}
console.log("Lagos Kids Project built to dist/");
