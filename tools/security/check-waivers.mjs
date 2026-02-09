import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

const REQUIRED_FIELDS = ["id", "ecosystem", "package", "justification", "owner", "expires_on"];

function parseArgs(argv) {
  const reportsIndex = argv.indexOf("--reports");
  if (reportsIndex === -1) {
    return [];
  }

  return argv.slice(reportsIndex + 1).filter(Boolean);
}

function loadWaivers(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Waiver file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(content) ?? {};

  if (!Array.isArray(parsed.waivers)) {
    throw new Error("Waiver file must contain a top-level 'waivers' array");
  }

  const now = new Date();
  const waivers = parsed.waivers.map((entry, index) => {
    for (const field of REQUIRED_FIELDS) {
      if (!entry[field]) {
        throw new Error(`Waiver at index ${index} is missing required field '${field}'`);
      }
    }

    const expiresOn = new Date(entry.expires_on);
    if (Number.isNaN(expiresOn.getTime())) {
      throw new Error(`Waiver '${entry.id}' has invalid expires_on date`);
    }

    if (expiresOn < now) {
      throw new Error(`Waiver '${entry.id}' is expired (${entry.expires_on})`);
    }

    return {
      id: String(entry.id),
      ecosystem: String(entry.ecosystem).toLowerCase(),
      package: String(entry.package),
      justification: String(entry.justification),
      owner: String(entry.owner),
      expiresOn
    };
  });

  return waivers;
}

function parseNpmAudit(reportPath) {
  const json = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const vulnerabilities = [];

  if (json.vulnerabilities && typeof json.vulnerabilities === "object") {
    for (const [pkgName, details] of Object.entries(json.vulnerabilities)) {
      const via = Array.isArray(details.via) ? details.via : [];
      for (const viaItem of via) {
        if (typeof viaItem === "string") {
          vulnerabilities.push({ ecosystem: "npm", id: `NPM-${pkgName}:${viaItem}`, packageName: pkgName });
        } else if (viaItem && typeof viaItem === "object") {
          const id = viaItem.source
            ? `NPM-${viaItem.source}`
            : `NPM-${pkgName}:${viaItem.title ?? "unknown"}`;
          vulnerabilities.push({ ecosystem: "npm", id, packageName: pkgName });
        }
      }
    }
  }

  if (json.advisories && typeof json.advisories === "object") {
    for (const advisory of Object.values(json.advisories)) {
      if (!advisory || typeof advisory !== "object") {
        continue;
      }
      const packageName = advisory.module_name ?? advisory.name ?? "unknown";
      const advisoryId =
        typeof advisory.id === "number" || typeof advisory.id === "string"
          ? `NPM-${advisory.id}`
          : `NPM-${packageName}:unknown`;
      vulnerabilities.push({ ecosystem: "npm", id: advisoryId, packageName });
    }
  }

  return dedupe(vulnerabilities);
}

function parsePipAudit(reportPath) {
  const json = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const vulnerabilities = [];

  const dependencies = Array.isArray(json.dependencies)
    ? json.dependencies
    : Array.isArray(json)
      ? json
      : [];

  for (const dep of dependencies) {
    const packageName = dep.name || dep.package || "unknown";
    const vulns = Array.isArray(dep.vulns) ? dep.vulns : [];
    for (const vuln of vulns) {
      const id = vuln.id ? `PYPI-${vuln.id}` : `PYPI-${packageName}:unknown`;
      vulnerabilities.push({ ecosystem: "pypi", id, packageName });
    }
  }

  return dedupe(vulnerabilities);
}

function parseTrivy(reportPath) {
  const json = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const vulnerabilities = [];

  const results = Array.isArray(json.Results) ? json.Results : [];
  for (const result of results) {
    const vulns = Array.isArray(result.Vulnerabilities) ? result.Vulnerabilities : [];
    for (const vuln of vulns) {
      const id = vuln.VulnerabilityID ? `TRIVY-${vuln.VulnerabilityID}` : "TRIVY-UNKNOWN";
      vulnerabilities.push({
        ecosystem: "container",
        id,
        packageName: vuln.PkgName || result.Target || "unknown"
      });
    }
  }

  return dedupe(vulnerabilities);
}

function parseReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return [];
  }

  if (reportPath.includes("npm-audit")) {
    return parseNpmAudit(reportPath);
  }

  if (reportPath.includes("pip-audit")) {
    return parsePipAudit(reportPath);
  }

  if (reportPath.includes("trivy")) {
    return parseTrivy(reportPath);
  }

  return [];
}

function dedupe(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = `${item.ecosystem}:${item.id}:${item.packageName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function hasMatchingWaiver(vulnerability, waivers) {
  return waivers.some((waiver) => {
    if (waiver.ecosystem !== vulnerability.ecosystem) {
      return false;
    }
    if (waiver.id !== vulnerability.id) {
      return false;
    }

    return waiver.package === "*" || waiver.package === vulnerability.packageName;
  });
}

function main() {
  const reportPaths = parseArgs(process.argv);
  const waiverPath = path.join(process.cwd(), ".security/waivers.yaml");
  const waivers = loadWaivers(waiverPath);

  const vulnerabilities = reportPaths.flatMap((reportPath) => parseReport(reportPath));

  if (vulnerabilities.length === 0) {
    console.log("No vulnerabilities found in security reports.");
    process.exit(0);
  }

  const unwaived = vulnerabilities.filter((vulnerability) => !hasMatchingWaiver(vulnerability, waivers));

  if (unwaived.length > 0) {
    console.error("Unwaived vulnerabilities detected:");
    for (const vulnerability of unwaived) {
      console.error(
        `- ecosystem=${vulnerability.ecosystem} id=${vulnerability.id} package=${vulnerability.packageName}`
      );
    }
    process.exit(1);
  }

  console.log(`All ${vulnerabilities.length} vulnerabilities are covered by active waivers.`);
}

main();
