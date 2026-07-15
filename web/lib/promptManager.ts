import path from "path";
import fs from "fs";

export type PromptModule = "employee" | "brand" | "certificate" | "lor";

/**
 * Loads the raw prompt template from the disk (web/lib/prompts/)
 * and replaces placeholders of the form {{key}} with values from data object.
 */
export function buildPrompt(module: PromptModule, data: Record<string, any>): string {
  try {
    const filePath = path.join(process.cwd(), "lib", "prompts", `${module}.txt`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Template prompt file not found at path: ${filePath}`);
    }

    let content = fs.readFileSync(filePath, "utf8");

    // Replace every placeholder key present in the data record
    for (const key of Object.keys(data)) {
      const value = data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
      content = content.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    return content;
  } catch (err: any) {
    throw new Error(`Failed to build prompt template for "${module}": ${err.message || String(err)}`);
  }
}
