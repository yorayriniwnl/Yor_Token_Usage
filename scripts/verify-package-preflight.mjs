import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tempRoot = await mkdtemp(path.join(tmpdir(), "yor-package-preflight-"));
const outputPath = path.join(tempRoot, "incomplete.zip");
const outsidePath = `${tempRoot}-outside.js`;
const powershellExecutable = process.platform === "win32" ? "powershell.exe" : "pwsh";
try {
  for (const directory of ["scripts", "assets/icons", "background", "content", "dashboard", "popup", "settings"]) {
    await mkdir(path.join(tempRoot, directory), { recursive: true });
  }
  await copyFile(fileURLToPath(new URL("./package-extension.ps1", import.meta.url)), path.join(tempRoot, "scripts/package-extension.ps1"));
  const manifest = {
    manifest_version: 3,
    action: { default_popup: "popup/popup.html" },
    background: { service_worker: "background/service-worker.js" },
    content_scripts: [{ js: ["content/index.js"], css: ["content/index.css"] }],
    icons: { 16: "assets/icons/icon.png" },
    options_page: "settings/settings.html",
    web_accessible_resources: [{ resources: ["assets/icons/*"], matches: ["<all_urls>"] }]
  };
  await writeFile(path.join(tempRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(tempRoot, "popup/popup.html"), "<html></html>");
  await writeFile(path.join(tempRoot, "settings/settings.html"), "<html></html>");
  await writeFile(path.join(tempRoot, "assets/icons/icon.png"), "fixture icon");

  const result = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", outputPath
  ], { encoding: "utf8" });
  assert.notEqual(result.status, 0,
    `Packaging silently accepted missing manifest files. stdout=${result.stdout}\nstderr=${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /background\/service-worker\.js|content\/index\.js/i,
    "the package error must name the missing manifest resource");
  assert.equal(existsSync(outputPath), false, "an invalid package must not be written");

  await writeFile(path.join(tempRoot, "background/service-worker.js"), "// worker");
  await writeFile(path.join(tempRoot, "content/index.js"), 'const embeddedLabel = "sourceMappingURL";\n');
  await writeFile(path.join(tempRoot, "content/index.css"), "/* content */");
  manifest.web_accessible_resources[0].resources.push("assets/fonts/*.woff2");
  await writeFile(path.join(tempRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  const wildcardOutput = path.join(tempRoot, "wildcard-incomplete.zip");
  const wildcardResult = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", wildcardOutput
  ], { encoding: "utf8" });
  assert.notEqual(wildcardResult.status, 0,
    `Packaging silently accepted an unmatched web-accessible-resource pattern. stdout=${wildcardResult.stdout}\nstderr=${wildcardResult.stderr}`);
  assert.match(`${wildcardResult.stdout}\n${wildcardResult.stderr}`, /assets\/fonts\/\*\.woff2/i,
    "the package error must name the unmatched resource glob");
  assert.equal(existsSync(wildcardOutput), false, "an unmatched resource glob must not produce an archive");

  await mkdir(path.join(tempRoot, "assets/fonts"), { recursive: true });
  await writeFile(path.join(tempRoot, "assets/fonts/font.woff2"), "fixture font");
  const validOutput = path.join(tempRoot, "complete.zip");
  const validResult = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", validOutput
  ], { encoding: "utf8" });
  assert.equal(validResult.status, 0, `A complete extension must package successfully. stdout=${validResult.stdout}\nstderr=${validResult.stderr}`);
  assert.equal(existsSync(validOutput), true, "a valid extension archive must be created");

  const listCommand = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${validOutput}'); try { $zip.Entries | ForEach-Object { $_.FullName } } finally { $zip.Dispose() }`;
  const archiveListing = spawnSync(powershellExecutable, ["-NoProfile", "-Command", listCommand], { encoding: "utf8" });
  assert.equal(archiveListing.status, 0, `The archive must be readable. ${archiveListing.stderr}`);
  const entries = archiveListing.stdout.split(/\r?\n/).filter(Boolean);
  for (const requiredEntry of ["background/service-worker.js", "content/index.js", "content/index.css", "assets/fonts/font.woff2", "assets/icons/icon.png"]) {
    assert.ok(entries.includes(requiredEntry), `the archive must contain manifest entry ${requiredEntry}`);
  }

  const originalArchive = await readFile(validOutput);
  const reproducibleResult = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", validOutput
  ], { encoding: "utf8" });
  assert.equal(reproducibleResult.status, 0, `A valid package must remain reproducible. ${reproducibleResult.stderr}`);
  assert.deepEqual(await readFile(validOutput), originalArchive, "identical source must produce identical ZIP bytes");

  const contentScriptPath = path.join(tempRoot, "content/index.js");
  const contentScript = await readFile(contentScriptPath);
  await writeFile(contentScriptPath, "//# sourceMappingURL=index.js.map\n");
  const sourceMapResult = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", validOutput
  ], { encoding: "utf8" });
  assert.notEqual(sourceMapResult.status, 0, "an actual sourceMappingURL directive must be rejected");
  assert.match(`${sourceMapResult.stdout}\n${sourceMapResult.stderr}`, /source map references/i);
  assert.deepEqual(await readFile(validOutput), originalArchive, "a rejected source map directive must not replace the archive");
  await writeFile(contentScriptPath, contentScript);

  const workerPath = path.join(tempRoot, "background/service-worker.js");
  const originalWorker = await readFile(workerPath);
  const collisionResult = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", workerPath
  ], { encoding: "utf8" });
  assert.notEqual(collisionResult.status, 0, "packaging must not overwrite a required extension file");
  assert.deepEqual(await readFile(workerPath), originalWorker, "a rejected output path must leave the worker unchanged");

  const nestedOutput = path.join(tempRoot, "content/nested.zip");
  const nestedResult = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", nestedOutput
  ], { encoding: "utf8" });
  assert.notEqual(nestedResult.status, 0, "packaging output must not be written into an included source directory");
  assert.equal(existsSync(nestedOutput), false);

  manifest.background.service_worker = `../${path.basename(outsidePath)}`;
  await writeFile(path.join(tempRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(outsidePath, "outside the extension root");
  const traversalResult = spawnSync(powershellExecutable, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(tempRoot, "scripts/package-extension.ps1"), "-Output", validOutput
  ], { encoding: "utf8" });
  assert.notEqual(traversalResult.status, 0, "manifest traversal must be rejected");
  assert.match(`${traversalResult.stdout}\n${traversalResult.stderr}`, /outside the extension root/i);
  assert.deepEqual(await readFile(validOutput), originalArchive, "invalid input must not replace an existing valid archive");
  console.log("package-preflight-check=pass");
} finally {
  const resolvedRoot = path.resolve(tempRoot);
  const resolvedTemp = path.resolve(tmpdir());
  if (!resolvedRoot.startsWith(`${resolvedTemp}${path.sep}`)) throw new Error("Refusing to clean a path outside the temp directory.");
  await rm(resolvedRoot, { recursive: true, force: true });
  const resolvedOutside = path.resolve(outsidePath);
  if (!resolvedOutside.startsWith(`${resolvedTemp}${path.sep}`)) throw new Error("Refusing to clean a path outside the temp directory.");
  await rm(resolvedOutside, { force: true });
}
