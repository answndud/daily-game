"use strict";

const fs = require("fs");
const path = require("path");

const skillsRoot = path.resolve(__dirname, "..", ".agents", "skills");

function parseFrontmatter(contents) {
  const match = contents.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error("Missing YAML frontmatter");
  }

  const fields = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid frontmatter line: ${trimmed}`);
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!key || !value) {
      throw new Error(`Invalid frontmatter field: ${trimmed}`);
    }
    fields[key] = value.replace(/^["']|["']$/g, "");
  }

  return fields;
}

function main() {
  const errors = [];

  if (!fs.existsSync(skillsRoot)) {
    console.log("No local skills directory found");
    return;
  }

  const skillDirs = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsRoot, entry.name))
    .sort();

  for (const skillDir of skillDirs) {
    const skillFile = path.join(skillDir, "SKILL.md");
    const label = path.relative(path.resolve(__dirname, ".."), skillDir);

    if (!fs.existsSync(skillFile)) {
      errors.push(`${label}: missing SKILL.md`);
      continue;
    }

    const contents = fs.readFileSync(skillFile, "utf8");

    try {
      const frontmatter = parseFrontmatter(contents);
      if (!frontmatter.name) {
        errors.push(`${label}: frontmatter missing name`);
      }
      if (!frontmatter.description) {
        errors.push(`${label}: frontmatter missing description`);
      }
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }

    if (!/^---\n[\s\S]*?\n---\n\s*# /m.test(contents)) {
      errors.push(`${label}: expected frontmatter followed by a top-level markdown heading`);
    }
  }

  if (errors.length > 0) {
    console.error("Skill verification failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Skill verification passed (${skillDirs.length} skill(s))`);
}

main();
