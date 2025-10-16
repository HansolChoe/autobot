import * as HandlebarsImport from "handlebars";
import { v4 as uuidv4 } from "uuid";

// Handle both default export and namespace export for esbuild compatibility
const Handlebars = (HandlebarsImport as any).default || HandlebarsImport;

export type HandlebarsType = typeof import("handlebars");

function convertToLetter(num: number): string {
  let result = "";
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

export function registerHelpers(
  handlebars: HandlebarsType,
  helpers: Array<[string, Handlebars.HelperDelegate]>,
): {
  [key: string]: Promise<string>;
} {
  const promises: { [key: string]: Promise<string> } = {};

  // Use the imported Handlebars instead of the passed parameter
  const handlebarsInstance = Handlebars;

  // Debug: Check if handlebars object is valid
  if (!handlebarsInstance) {
    console.error("Handlebars object is null or undefined");
    throw new Error("Handlebars object is null or undefined");
  }

  if (typeof handlebarsInstance.registerHelper !== "function") {
    console.error("Handlebars.registerHelper is not a function", {
      handlebars: handlebarsInstance,
      registerHelperType: typeof handlebarsInstance.registerHelper,
      handlebarsKeys: Object.keys(handlebarsInstance),
    });
    throw new Error("Handlebars.registerHelper is not a function");
  }

  for (const [name, helper] of helpers) {
    handlebarsInstance.registerHelper(name, (...args: any[]) => {
      const id = uuidv4();
      promises[id] = helper(...args);
      return `__${id}__`;
    });
  }

  return promises;
}

export async function prepareTemplatedFilepaths(
  handlebars: HandlebarsType,
  template: string,
  inputData: Record<string, string>,
  ctxProviderNames: string[],
  readFile: (filepath: string) => Promise<string>,
  getUriFromPath: (path: string) => Promise<string | undefined>,
) {
  // Use the imported Handlebars instead of the passed parameter
  const handlebarsInstance = Handlebars;

  // First, replace filepaths with letters to avoid escaping issues
  const ast = handlebarsInstance.parse(template);

  const filepathLetters: Map<string, string> = new Map();
  const requiredContextProviders: Set<string> = new Set();
  let withLetterKeys = template;

  let letterIndex = 1;

  for (const i in ast.body) {
    const node = ast.body[i] as any;

    if (node.type === "MustacheStatement") {
      const originalNodeVal = node.path.original;
      if (originalNodeVal.toLowerCase() === "input") {
        continue;
      }
      const isFilepath = !ctxProviderNames.includes(originalNodeVal);

      if (isFilepath) {
        const letter = convertToLetter(letterIndex);

        filepathLetters.set(letter, originalNodeVal);

        withLetterKeys = withLetterKeys.replace(
          new RegExp(`{{\\s*${originalNodeVal}\\s*}}`),
          `{{${letter}}}`,
        );

        letterIndex++;
      } else {
        requiredContextProviders.add(originalNodeVal);
      }
    }
  }

  // Then, resolve the filepaths to their actual content and add to template data
  // Fallback to simple error string if file read fails
  const templateData = { ...inputData };

  for (const [letter, filepath] of filepathLetters.entries()) {
    try {
      const uri = await getUriFromPath(filepath);
      if (uri) {
        const fileContents = await readFile(uri);
        templateData[letter] = fileContents;
      } else {
        throw new Error(`File not found: ${filepath}`);
      }
    } catch (e) {
      console.error(`Error reading file in prompt file ${filepath}:`, e);
      templateData[letter] = `[Error reading file "${filepath}"]`;
    }
  }

  return { withLetterKeys, templateData, requiredContextProviders };
}

export async function resolveHelperPromises(
  renderedString: string,
  promises: { [key: string]: Promise<string> },
): Promise<string> {
  await Promise.all(Object.values(promises));

  for (const id in promises) {
    renderedString = renderedString.replace(`__${id}__`, await promises[id]);
  }

  return renderedString;
}
