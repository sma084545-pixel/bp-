#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || "sma084545-pixel";
const REPO_NAME = process.env.GITHUB_REPOSITORY_NAME || "bp-";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const SOURCE_DIR = process.env.RESOURCES_SOURCE_DIR || "/Users/maxiao/Desktop/resources base";
const REPO_ROOT = path.resolve(__dirname, "..");
const RESOURCES_DIR = path.join(REPO_ROOT, "resources");
const RAW_BASE = process.env.REPO_RAW_BASE || `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const DOWNLOAD_BASE = process.env.REPO_DOWNLOAD_BASE || `https://github.com/${REPO_OWNER}/${REPO_NAME}/raw/${BRANCH}`;
const BLOB_BASE = process.env.REPO_BLOB_BASE || `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${BRANCH}`;
const PAGES_URL = process.env.PAGES_URL || `https://${REPO_OWNER}.github.io/${REPO_NAME}/`;
const MAX_GITHUB_FILE_SIZE = 100 * 1024 * 1024;
const LARGE_FILE_SIZE = 50 * 1024 * 1024;

const categoryMap = new Map([
  ["bio", {
    id: "biology",
    folder: "Biology",
    title: "Biology",
    shortLabel: "BIO",
    accent: "#178464",
    description: "Biology lessons, plans, homework, and exam resources."
  }],
  ["biology", {
    id: "biology",
    folder: "Biology",
    title: "Biology",
    shortLabel: "BIO",
    accent: "#178464",
    description: "Biology lessons, plans, homework, and exam resources."
  }],
  ["chem", {
    id: "chemistry",
    folder: "Chemistry",
    title: "Chemistry",
    shortLabel: "CHEM",
    accent: "#b65215",
    description: "Chemistry presentations, reaction topics, and lab resources."
  }],
  ["chemistry", {
    id: "chemistry",
    folder: "Chemistry",
    title: "Chemistry",
    shortLabel: "CHEM",
    accent: "#b65215",
    description: "Chemistry presentations, reaction topics, and lab resources."
  }],
  ["eco", {
    id: "economics",
    folder: "Economics",
    title: "Economics",
    shortLabel: "ECO",
    accent: "#2265d8",
    description: "Economics notes covering markets, macroeconomics, and policy."
  }],
  ["economics", {
    id: "economics",
    folder: "Economics",
    title: "Economics",
    shortLabel: "ECO",
    accent: "#2265d8",
    description: "Economics notes covering markets, macroeconomics, and policy."
  }],
  ["physics", {
    id: "physics",
    folder: "Physics",
    title: "Physics",
    shortLabel: "PHY",
    accent: "#7c3bb5",
    description: "Physics lessons, motion, gravitation, electricity, and magnetism."
  }]
]);

const fallbackCategory = {
  id: "other-resources",
  folder: "Other Resources",
  title: "Other Resources",
  shortLabel: "OTHER",
  accent: "#53606f",
  description: "Resources that do not fit the primary subject folders."
};

const typeMap = new Map([
  [".pdf", ["pdf", "PDF", "pdf"]],
  [".doc", ["document", "Word", "none"]],
  [".docx", ["document", "Word", "none"]],
  [".ppt", ["presentation", "PowerPoint", "none"]],
  [".pptx", ["presentation", "PowerPoint", "none"]],
  [".pptm", ["presentation", "PowerPoint", "none"]],
  [".xls", ["spreadsheet", "Spreadsheet", "none"]],
  [".xlsx", ["spreadsheet", "Spreadsheet", "none"]],
  [".csv", ["spreadsheet", "Spreadsheet", "text"]],
  [".png", ["image", "Image", "image"]],
  [".jpg", ["image", "Image", "image"]],
  [".jpeg", ["image", "Image", "image"]],
  [".gif", ["image", "Image", "image"]],
  [".webp", ["image", "Image", "image"]],
  [".svg", ["image", "Image", "image"]],
  [".txt", ["text", "Text", "text"]],
  [".md", ["text", "Markdown", "text"]],
  [".json", ["text", "JSON", "text"]],
  [".zip", ["archive", "Archive", "none"]],
  [".rar", ["archive", "Archive", "none"]],
  [".7z", ["archive", "Archive", "none"]],
  [".mp4", ["video", "Video", "video"]],
  [".mov", ["video", "Video", "video"]],
  [".webm", ["video", "Video", "video"]],
  [".pages", ["other", "Pages", "none"]]
]);

const skipSegmentPatterns = [
  /^\.DS_Store$/i,
  /^Thumbs\.db$/i,
  /^__MACOSX$/i,
  /^node_modules$/i,
  /^\.git$/i,
  /^\.cache$/i,
  /^\.tmp$/i
];

const tempFilePatterns = [
  /^~\$/,
  /\.tmp$/i,
  /\.swp$/i
];

const sensitivePatterns = [
  /password/i,
  /passwd/i,
  /secret/i,
  /api[-_\s]?key/i,
  /access[-_\s]?token/i,
  /credential/i,
  /private[-_\s]?key/i,
  /id[-_\s]?card/i,
  /passport/i,
  /身份证/,
  /护照/,
  /\.env$/i,
  /\.pem$/i,
  /\.key$/i
];

main();

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Source folder not found: ${SOURCE_DIR}`);
  }

  resetDirectory(RESOURCES_DIR);

  const skipped = [];
  const sensitiveSkipped = [];
  const largeFiles = [];
  const blockedFiles = [];
  const usedNames = new Map();
  const resources = [];

  for (const sourcePath of walk(SOURCE_DIR)) {
    const relativeOriginal = path.relative(SOURCE_DIR, sourcePath);
    const segments = relativeOriginal.split(path.sep);
    const filename = path.basename(sourcePath);

    if (shouldSkip(segments, filename)) {
      skipped.push({ path: relativeOriginal, reason: "Hidden, system, temporary, or dependency file." });
      continue;
    }

    if (looksSensitive(relativeOriginal)) {
      sensitiveSkipped.push({ path: relativeOriginal, reason: "Filename appears to contain sensitive data." });
      continue;
    }

    const stat = fs.statSync(sourcePath);
    if (stat.size > MAX_GITHUB_FILE_SIZE) {
      blockedFiles.push({ path: relativeOriginal, size: stat.size, reason: "Single file exceeds GitHub 100 MB repository limit." });
      continue;
    }

    if (stat.size > LARGE_FILE_SIZE) {
      largeFiles.push({ path: relativeOriginal, size: stat.size });
    }

    const sourceTopFolder = segments[0] || "";
    const category = categoryMap.get(sourceTopFolder.toLowerCase()) || fallbackCategory;
    const targetFolder = path.join(RESOURCES_DIR, category.folder);
    ensureDir(targetFolder);

    const safeName = uniqueSafeName(category.folder, filename, usedNames);
    const targetPath = path.join(targetFolder, safeName);
    fs.copyFileSync(sourcePath, targetPath);

    const repositoryPath = toPosix(path.relative(REPO_ROOT, targetPath));
    const encodedPath = encodeRepoPath(repositoryPath);
    const extension = path.extname(filename).toLowerCase();
    const [fileType, fileTypeLabel, previewMode] = typeMap.get(extension) || ["other", extension ? extension.slice(1).toUpperCase() : "File", "none"];
    const title = titleFromFilename(filename);

    resources.push({
      id: stableId(repositoryPath),
      title,
      category: category.title,
      categoryId: category.id,
      fileType,
      fileTypeLabel,
      extension: extension || "",
      fileSize: stat.size,
      fileSizeLabel: formatSize(stat.size),
      originalFilename: filename,
      originalPath: toPosix(relativeOriginal),
      repositoryPath,
      downloadUrl: `${DOWNLOAD_BASE}/${encodedPath}`,
      previewUrl: `${RAW_BASE}/${encodedPath}`,
      githubUrl: `${BLOB_BASE}/${encodedPath}`,
      previewMode,
      description: describeResource(title, category.title, fileTypeLabel)
    });
  }

  resources.sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);
    return categoryCompare || a.title.localeCompare(b.title);
  });

  const categories = buildCategories(resources);
  const manifest = {
    generatedAt: new Date().toISOString(),
    repository: {
      owner: REPO_OWNER,
      name: REPO_NAME,
      branch: BRANCH,
      pagesUrl: PAGES_URL,
      rawBaseUrl: RAW_BASE,
      downloadBaseUrl: DOWNLOAD_BASE
    },
    source: {
      originalRoot: SOURCE_DIR,
      copiedFiles: resources.length,
      skippedFiles: skipped.length + sensitiveSkipped.length + blockedFiles.length
    },
    categories,
    resources
  };

  fs.writeFileSync(path.join(REPO_ROOT, "resources.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(REPO_ROOT, "upload-report.md"), renderUploadReport({
    resources,
    categories,
    skipped,
    sensitiveSkipped,
    largeFiles,
    blockedFiles
  }));

  console.log(`Generated ${resources.length} resources across ${categories.length} categories.`);
  console.log(`Manifest: ${path.join(REPO_ROOT, "resources.json")}`);
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function resetDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function shouldSkip(segments, filename) {
  if (segments.some((segment) => skipSegmentPatterns.some((pattern) => pattern.test(segment)))) {
    return true;
  }
  return tempFilePatterns.some((pattern) => pattern.test(filename));
}

function looksSensitive(value) {
  return sensitivePatterns.some((pattern) => pattern.test(value));
}

function uniqueSafeName(categoryFolder, filename, usedNames) {
  const key = categoryFolder;
  const names = usedNames.get(key) || new Set();
  usedNames.set(key, names);

  const parsed = path.parse(filename);
  const extension = parsed.ext.toLowerCase();
  const base = slugify(parsed.name) || "resource";
  let candidate = `${base}${extension}`;
  let index = 2;

  while (names.has(candidate.toLowerCase())) {
    candidate = `${base}-${index}${extension}`;
    index += 1;
  }

  names.add(candidate.toLowerCase());
  return candidate;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

function titleFromFilename(filename) {
  const parsed = path.parse(filename);
  return parsed.name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bppt\b/ig, "PPT")
    .replace(/\bchd\b/ig, "CHD")
    .replace(/\bcpi\b/ig, "CPI")
    .replace(/\bppc\b/ig, "PPC")
    .trim();
}

function describeResource(title, category, fileTypeLabel) {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (/exam|paper|q\d|ms\b|mark scheme/i.test(normalized)) {
    return `${category} exam or assessment resource: ${normalized}.`;
  }
  if (/lesson|ppt|unit|chapter|plan/i.test(normalized)) {
    return `${category} learning material: ${normalized}.`;
  }
  return `${category} ${fileTypeLabel} resource: ${normalized}.`;
}

function buildCategories(resources) {
  const templates = new Map([...categoryMap.values(), fallbackCategory].map((category) => [category.id, category]));
  const categoryStats = new Map();

  for (const resource of resources) {
    const current = categoryStats.get(resource.categoryId) || { count: 0, totalSize: 0 };
    current.count += 1;
    current.totalSize += Number(resource.fileSize) || 0;
    categoryStats.set(resource.categoryId, current);
  }

  return Array.from(categoryStats.entries())
    .map(([id, stats]) => {
      const template = templates.get(id);
      return {
        id,
        title: template.title,
        folder: template.folder,
        shortLabel: template.shortLabel,
        accent: template.accent,
        description: template.description,
        count: stats.count,
        totalSize: stats.totalSize,
        totalSizeLabel: formatSize(stats.totalSize)
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function renderUploadReport(context) {
  const totalSize = context.resources.reduce((sum, resource) => sum + resource.fileSize, 0);
  const lines = [
    "# Upload Report",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Source folder: \`${SOURCE_DIR}\``,
    `- Target repository: \`${REPO_OWNER}/${REPO_NAME}\``,
    `- Files prepared for upload: ${context.resources.length}`,
    `- Total prepared size: ${formatSize(totalSize)}`,
    `- Files skipped: ${context.skipped.length + context.sensitiveSkipped.length + context.blockedFiles.length}`,
    `- GitHub Pages target: ${PAGES_URL}`,
    "",
    "## Category Breakdown",
    "",
    "| Category | Files | Size |",
    "| --- | ---: | ---: |",
    ...context.categories.map((category) => `| ${category.title} | ${category.count} | ${category.totalSizeLabel} |`),
    "",
    "## Large File Check",
    ""
  ];

  if (context.largeFiles.length) {
    lines.push("Files over 50 MB were prepared because they are still below GitHub's 100 MB single-file hard limit. GitHub may warn about these files during push. Git LFS is recommended if this repository will grow further.", "");
    lines.push("| File | Size | Status |", "| --- | ---: | --- |");
    for (const file of context.largeFiles) {
      lines.push(`| \`${toPosix(file.path)}\` | ${formatSize(file.size)} | Prepared; below 100 MB |`);
    }
    lines.push("");
  } else {
    lines.push("No files over 50 MB were found.", "");
  }

  lines.push("## Files Blocked From Upload", "");
  if (context.blockedFiles.length) {
    lines.push("| File | Size | Reason |", "| --- | ---: | --- |");
    for (const file of context.blockedFiles) {
      lines.push(`| \`${toPosix(file.path)}\` | ${formatSize(file.size)} | ${file.reason} |`);
    }
    lines.push("");
  } else {
    lines.push("No files exceeded the 100 MB single-file GitHub repository limit.", "");
  }

  lines.push("## Skipped System or Temporary Files", "");
  if (context.skipped.length) {
    lines.push("| File | Reason |", "| --- | --- |");
    for (const file of context.skipped) {
      lines.push(`| \`${toPosix(file.path)}\` | ${file.reason} |`);
    }
    lines.push("");
  } else {
    lines.push("No system or temporary files were skipped.", "");
  }

  lines.push("## Sensitive Filename Check", "");
  if (context.sensitiveSkipped.length) {
    lines.push("The following files were not copied because their filenames match sensitive-data patterns:", "");
    lines.push("| File | Reason |", "| --- | --- |");
    for (const file of context.sensitiveSkipped) {
      lines.push(`| \`${toPosix(file.path)}\` | ${file.reason} |`);
    }
    lines.push("");
  } else {
    lines.push("No obvious sensitive filenames were found.", "");
  }

  lines.push("## Upload Status", "");
  lines.push("Prepared locally. After pushing, confirm GitHub Actions completes and GitHub Pages serves the site.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function stableId(value) {
  return slugify(value).slice(0, 80);
}

function encodeRepoPath(repositoryPath) {
  return repositoryPath.split("/").map(encodeURIComponent).join("/");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function formatSize(bytes) {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? size : size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}
