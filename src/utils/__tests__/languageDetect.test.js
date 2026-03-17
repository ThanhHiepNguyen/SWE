import { describe, expect, it } from "vitest";
import { detectLanguageFromSource, validateLanguageMatch } from "../languageDetect.js";

describe("languageDetect", () => {
    it("detectLanguageFromSource: detects python", () => {
        expect(detectLanguageFromSource("import time\nprint('hello')\n")).toBe("python");
    });

    it("validateLanguageMatch: normalizes js -> javascript", () => {
        const res = validateLanguageMatch({
            language: "js",
            sourceCode: "console.log('ok')",
        });
        expect(res.ok).toBe(true);
        expect(res.normalizedLanguage).toBe("javascript");
    });

    it("validateLanguageMatch: rejects missing language", () => {
        const res = validateLanguageMatch({ language: undefined, sourceCode: "print('x')" });
        expect(res.ok).toBe(false);
        expect(res.message).toContain("Thiếu trường language");
    });

    it("validateLanguageMatch: rejects unsupported language", () => {
        const res = validateLanguageMatch({ language: "java", sourceCode: "class A {}" });
        expect(res.ok).toBe(false);
        expect(res.message).toContain("không tồn tại / không được hỗ trợ");
    });

    it("validateLanguageMatch: rejects mismatch when detectable", () => {
        const res = validateLanguageMatch({
            language: "javascript",
            sourceCode: "print('hello from python')",
        });
        expect(res.ok).toBe(false);
        expect(res.message).toContain("Sai ngôn ngữ");
    });

    it("validateLanguageMatch: allows unknown code (no strong signal)", () => {
        const res = validateLanguageMatch({ language: "python", sourceCode: "hello world" });
        expect(res.ok).toBe(true);
    });
});

