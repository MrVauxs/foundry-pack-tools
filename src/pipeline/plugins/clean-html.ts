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
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const spans = document.querySelectorAll("span");
    for (const span of spans) {
        const el = span as HTMLElement;
        if (el.dataset.aonCopypasta) {
            const replacement = document.createElement("span");
            replacement.textContent = el.textContent || "";
            el.replaceWith(replacement);
        }
    }

    let body = document.body.innerHTML;

    body = body.replace(/<br\s*\/?>/gi, "\n");
    body = body.replace(/<p[^>]*>/gi, "\n");
    body = body.replace(/<\/p>/gi, "\n");
    body = body.replace(/<div[^>]*>/gi, "");
    body = body.replace(/<\/div>/gi, "");
    body = body.replace(/<li[^>]*>/gi, "  - ");
    body = body.replace(/<\/li>/gi, "\n");
    body = body.replace(/<ul[^>]*>/gi, "");
    body = body.replace(/<\/ul>/gi, "\n");
    body = body.replace(/<ol[^>]*>/gi, "");
    body = body.replace(/<\/ol>/gi, "\n");
    body = body.replace(/<h[1-6][^>]*>/gi, "\n## ");
    body = body.replace(/<\/h[1-6]>/gi, "\n");
    body = body.replace(/<strong[^>]*>/gi, "**");
    body = body.replace(/<\/strong>/gi, "**");
    body = body.replace(/<b[^>]*>/gi, "**");
    body = body.replace(/<\/b>/gi, "**");
    body = body.replace(/<em[^>]*>/gi, "*");
    body = body.replace(/<\/em>/gi, "*");
    body = body.replace(/<i[^>]*>/gi, "*");
    body = body.replace(/<\/i>/gi, "*");
    body = body.replace(/<a[^>]*href="([^"]*)"[^>]*>/gi, "[link]($1)");
    body = body.replace(/<\/a>/gi, "");
    body = body.replace(/<[^>]+>/g, "");
    body = body.replace(/&nbsp;/g, " ");
    body = body.replace(/&amp;/g, "&");
    body = body.replace(/&lt;/g, "<");
    body = body.replace(/&gt;/g, ">");
    body = body.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

    body = body.replace(/\n{3,}/g, "\n\n");
    body = body.replace(/[ \t]+/g, " ");
    body = body.replace(/ ?\n ?/g, "\n");
    body = body.trim();

    return body;
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
