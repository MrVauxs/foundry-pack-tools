import { JSDOM } from "jsdom";
import type { PackEntry, TransformContext, TransformPlugin } from "../../types.js";

export interface CleanHTMLOptions {
    classRenames?: Record<string, string>;
}

const DEFAULT_CLASS_RENAMES: Record<string, string> = {
    "pf2e-action": "action",
    "pf2e-reaction": "reaction",
    "pf2e-free-action": "free-action",
};

export function cleanHTML(html: string, _docName?: string): string {
    if (!html) {
        return "";
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const container = document.body;

    // Strip out span tags from AoN copypasta
    const aonSpans = container.querySelectorAll("span[data-aon-copypasta]");
    for (const span of aonSpans) {
        const el = span as HTMLElement;
        const replacement = document.createElement("span");
        replacement.textContent = el.textContent || "";
        el.replaceWith(replacement);
    }

    // Also strip specific AoN selectors
    const selectors = ["span#ctl00_MainContent_DetailedOutput", "span.fontstyle0"];
    for (const selector of selectors) {
        container.querySelectorAll(selector).forEach((span) => {
            span.replaceWith(span.innerHTML);
        });
    }

    let result = container.innerHTML;

    // Prefer self-closing tags for br and hr
    result = result.replace(/<([hb]r)>/g, "<$1 />");

    // Clean up whitespace around paragraph tags
    result = result.replace(/<\/p> ?<p>/g, "</p>\n<p>");
    result = result.replace(/<p>[ \r\n]+/g, "<p>");
    result = result.replace(/[ \r\n]+<\/p>/g, "</p>");

    // Normalize bold tags
    result = result.replace(/<(?:b|strong)>\s*/g, "<strong>");
    result = result.replace(/\s*<\/(?:b|strong)>/g, "</strong>");
    result = result.replace(/(<\/strong>)(\w)/g, "$1 $2");

    // Rename pf2e icon class
    result = result.replace(/\bpf2-icon\b/g, "action-glyph");

    // Remove empty paragraphs and divs
    result = result.replace(/<p> *<\/p>/g, "");
    result = result.replace(/<div> *<\/div>/g, "");

    // Clean up whitespace and special characters
    result = result.replace(/&nbsp;/g, " ");
    result = result.replace(/\u2011/g, "-");
    result = result.replace(/\s*\u2014\s*/g, "\u2014"); // em dash
    result = result.replace(/ {2,}/g, " ");

    return result.trim().replace(/^<hr \/>/, "").trim();
}

export function createCleanDescriptionHTMLPlugin(options: CleanHTMLOptions = {}): TransformPlugin {
    const classRenames = { ...DEFAULT_CLASS_RENAMES, ...options.classRenames };
    return {
        name: "cleanDescriptionHTML",
        async transform(doc: PackEntry, _context: TransformContext) {
            const system = doc.system as Record<string, unknown> | undefined;
            if (!system) return;
            const description = system.description as Record<string, string | undefined> | undefined;
            if (!description) return;
            if (description.value) {
                description.value = cleanHTML(description.value, doc.name);
            }
            if (description.chat) {
                description.chat = cleanHTML(description.chat, doc.name);
            }
            if (description.unidentified) {
                description.unidentified = cleanHTML(description.unidentified, doc.name);
            }
        },
    };
}
