const fs = require("node:fs");
const { buildGdsViewModel, parseGds } = require("../src/gdsviewer/gds_parser.js");

const [command, inputPath, optionsJson = "{}"] = process.argv.slice(2);
const bytes = fs.readFileSync(inputPath);
const library = parseGds(bytes);

if (command === "parse") {
  process.stdout.write(JSON.stringify(library));
} else if (command === "view-model") {
  process.stdout.write(JSON.stringify(buildGdsViewModel(library, JSON.parse(optionsJson))));
} else {
  throw new Error(`Unknown command: ${command}`);
}
