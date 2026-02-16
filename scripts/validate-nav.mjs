#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = process.cwd();
const APP_ROOT = path.join(ROOT, "app", "(app)");

function resolveTsFile(specifier, dirname) {
  let resolved;

  if (specifier.startsWith("@/")) {
    resolved = path.join(ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    resolved = path.resolve(dirname, specifier);
  } else {
    return null;
  }

  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function loadTsModule(entryPath, cache = new Map()) {
  const absolutePath = path.resolve(entryPath);
  if (cache.has(absolutePath)) {
    return cache.get(absolutePath).exports;
  }

  const source = fs.readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  cache.set(absolutePath, module);

  const dirname = path.dirname(absolutePath);
  const localRequire = (specifier) => {
    const maybeTsFile = resolveTsFile(specifier, dirname);
    if (maybeTsFile) {
      return loadTsModule(maybeTsFile, cache);
    }
    return require(specifier);
  };

  const script = new vm.Script(output, { filename: absolutePath });
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: localRequire,
    __dirname: dirname,
    __filename: absolutePath,
    process,
    console,
    global,
  });

  script.runInContext(context);
  return module.exports;
}

function routeExists(href) {
  if (href === "/") {
    return fs.existsSync(path.join(APP_ROOT, "page.tsx"));
  }

  const fullPath = path.join(APP_ROOT, ...href.split("/").filter(Boolean), "page.tsx");
  return fs.existsSync(fullPath);
}

function hasRoleAccess(item, role) {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(role);
}

function hasAwardAccess(item, role) {
  if (!item.requiresAward) return true;
  return role === "ADMIN";
}

const catalogModule = loadTsModule(path.join(ROOT, "lib", "navigation", "catalog.ts"));
const coreMapModule = loadTsModule(path.join(ROOT, "lib", "navigation", "core-map.ts"));
const resolveNavModule = loadTsModule(path.join(ROOT, "lib", "navigation", "resolve-nav.ts"));

const catalog = catalogModule.NAV_CATALOG;
const coreMap = coreMapModule.CORE_NAV_MAP;
const resolveNavModel = resolveNavModule.resolveNavModel;

const errors = [];

if (!Array.isArray(catalog)) {
  errors.push("NAV_CATALOG is missing or not an array.");
}

if (!coreMap || typeof coreMap !== "object") {
  errors.push("CORE_NAV_MAP is missing or not an object.");
}

if (typeof resolveNavModel !== "function") {
  errors.push("resolveNavModel is missing or not a function.");
}

if (errors.length === 0) {
  const hrefCounts = new Map();
  for (const item of catalog) {
    hrefCounts.set(item.href, (hrefCounts.get(item.href) ?? 0) + 1);
  }

  for (const [href, count] of hrefCounts) {
    if (count > 1) {
      errors.push(`Duplicate href in NAV_CATALOG: ${href} (${count} entries)`);
    }
  }

  const catalogHrefSet = new Set(catalog.map((item) => item.href));

  for (const href of catalogHrefSet) {
    if (!routeExists(href)) {
      errors.push(`Catalog href does not resolve to an app route: ${href}`);
    }
  }

  for (const [role, hrefs] of Object.entries(coreMap)) {
    if (!Array.isArray(hrefs)) {
      errors.push(`Core map for role ${role} is not an array.`);
      continue;
    }

    if (hrefs.length > 8) {
      errors.push(`Core map for role ${role} has ${hrefs.length} links (max is 8).`);
    }

    if (new Set(hrefs).size !== hrefs.length) {
      errors.push(`Core map for role ${role} contains duplicate hrefs.`);
    }

    for (const href of hrefs) {
      if (!catalogHrefSet.has(href)) {
        errors.push(`Core map for role ${role} references missing catalog href: ${href}`);
      }
    }

    const available = catalog.filter((item) => hasRoleAccess(item, role) && hasAwardAccess(item, role));
    const minRequired = Math.min(5, available.length);
    if (hrefs.length < minRequired) {
      errors.push(
        `Core map for role ${role} has ${hrefs.length} links but requires at least ${minRequired} based on available routes.`,
      );
    }
  }

  for (const role of Object.keys(coreMap)) {
    const navAtRoot = resolveNavModel({
      roles: [role],
      primaryRole: role,
      pathname: "/",
    });

    const labelToHrefs = new Map();
    for (const item of navAtRoot.visible) {
      const existing = labelToHrefs.get(item.label) ?? [];
      existing.push(item.href);
      labelToHrefs.set(item.label, existing);
    }

    for (const [label, hrefs] of labelToHrefs.entries()) {
      if (hrefs.length > 1) {
        errors.push(
          `Role ${role} has duplicate visible label "${label}" for routes: ${hrefs.join(", ")}`,
        );
      }
    }

    const baselineCore = navAtRoot.core.map((item) => item.href);
    const samplePathnames = [
      "/",
      ...navAtRoot.visible.slice(0, 12).map((item) => item.href),
    ];

    for (const pathname of samplePathnames) {
      const navAtPath = resolveNavModel({
        roles: [role],
        primaryRole: role,
        pathname,
      });
      const candidateCore = navAtPath.core.map((item) => item.href);

      if (candidateCore.join(" | ") !== baselineCore.join(" | ")) {
        errors.push(
          `Core links are not stable for role ${role}. Baseline: [${baselineCore.join(", ")}], at pathname ${pathname}: [${candidateCore.join(", ")}]`,
        );
        break;
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Navigation validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Navigation validation passed. Catalog routes: ${catalog.length}. Roles checked: ${Object.keys(coreMap).length}.`);
