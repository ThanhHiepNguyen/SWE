function normalizeLanguage(lang) {
    if (typeof lang !== "string") return null;
    const v = lang.trim().toLowerCase();
    if (v === "js") return "javascript";
    return v;
}


export function detectLanguageFromSource(sourceCode) {
    if (typeof sourceCode !== "string") return "unknown";
    const s = sourceCode.trim();
    if (!s) return "unknown";

    const hasPython =
        /\bdef\s+\w+\s*\(/.test(s) ||
        /\bimport\s+\w+/.test(s) ||
        /\bprint\s*\(/.test(s) ||
        /:\s*(#.*)?(\r?\n|$)/.test(s);

    const hasJs =
        /\bconsole\.log\s*\(/.test(s) ||
        /\bfunction\s+\w+\s*\(/.test(s) ||
        /=>/.test(s) ||
        /\b(let|const|var)\s+\w+/.test(s) ||
        /;\s*(\r?\n|$)/.test(s);

    if (hasPython && !hasJs) return "python";
    if (hasJs && !hasPython) return "javascript";
    return "unknown";
}

export function validateLanguageMatch({ language, sourceCode }) {
    const normalized = normalizeLanguage(language);
    if (!normalized) {
        return {
            ok: false,
            message: "Thiếu trường language",
        };
    }

    const allowed = new Set(["python", "javascript"]);
    if (!allowed.has(normalized)) {
        return {
            ok: false,
            message: `Ngôn ngữ '${language}' không tồn tại / không được hỗ trợ. Cho phép: python, javascript`,
        };
    }

    if (typeof sourceCode === "string" && sourceCode.trim() !== "") {
        const detected = detectLanguageFromSource(sourceCode);
        if (detected !== "unknown" && detected !== normalized) {
            return {
                ok: false,
                message: `Sai ngôn ngữ: bạn chọn '${normalized}' nhưng code có vẻ là '${detected}'.`,
            };
        }
    }

    return { ok: true, normalizedLanguage: normalized };
}

