import * as HandlebarsImport from "handlebars";
import {
  prepareTemplatedFilepaths,
  registerHelpers,
  resolveHelperPromises,
  type HandlebarsType,
} from "./handlebarUtils";

// Handle both default export and namespace export for esbuild compatibility
const Handlebars = (HandlebarsImport as any).default || HandlebarsImport;

export async function renderTemplatedString(
  handlebars: HandlebarsType,
  template: string,
  inputData: Record<string, string>,
  availableHelpers: Array<[string, Handlebars.HelperDelegate]>,
  readFile: (filepath: string) => Promise<string>,
  getUriFromPath: (path: string) => Promise<string | undefined>,
): Promise<string> {
  // Use the imported Handlebars instead of the passed parameter
  const handlebarsInstance = Handlebars;

  // Debug: Check handlebars object before using it
  if (!handlebarsInstance) {
    console.error(
      "Handlebars object is null or undefined in renderTemplatedString",
    );
    throw new Error("Handlebars object is null or undefined");
  }

  if (typeof handlebarsInstance.registerHelper !== "function") {
    console.error(
      "Handlebars.registerHelper is not a function in renderTemplatedString",
      {
        handlebars: handlebarsInstance,
        registerHelperType: typeof handlebarsInstance.registerHelper,
        handlebarsKeys: Object.keys(handlebarsInstance),
      },
    );
    throw new Error("Handlebars.registerHelper is not a function");
  }

  const helperPromises =
    availableHelpers && availableHelpers.length > 0
      ? registerHelpers(handlebarsInstance, availableHelpers)
      : {};

  const ctxProviderNames = availableHelpers?.map((h) => h[0]) ?? [];

  const { withLetterKeys, templateData } = await prepareTemplatedFilepaths(
    handlebarsInstance,
    template,
    inputData,
    ctxProviderNames,
    readFile,
    getUriFromPath,
  );

  const templateFn = handlebarsInstance.compile(withLetterKeys);
  const renderedString = templateFn(templateData);

  return resolveHelperPromises(renderedString, helperPromises);
}
