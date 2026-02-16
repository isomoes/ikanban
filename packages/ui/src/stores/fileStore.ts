import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import type { AttachedFile } from "./types/sessionTypes";
import { getSafeStorage } from "./utils/safeStorage";

interface FileState {
    attachedFiles: AttachedFile[];
}

interface FileActions {
    addAttachedFile: (file: File) => Promise<void>;
    addServerFile: (path: string, name: string, content?: string) => Promise<void>;
    removeAttachedFile: (id: string) => void;
    clearAttachedFiles: () => void;
}

type FileStore = FileState & FileActions;

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const guessMimeTypeFromName = (filename: string): string => {
    const name = (filename || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() || "" : "";

    const noExtNames = new Set([
        "license",
        "readme",
        "changelog",
        "notice",
        "authors",
        "copying",
        "makefile",
        "dockerfile",
        "gemfile",
        "rakefile",
        "procfile",
        "vagrantfile",
        "justfile",
        "taskfile",
    ]);

    if (noExtNames.has(name)) return "text/plain";

    switch (ext) {
        // Images
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "gif":
            return "image/gif";
        case "webp":
            return "image/webp";
        case "svg":
            return "image/svg+xml";
        case "bmp":
            return "image/bmp";
        case "ico":
            return "image/x-icon";
        // PDF
        case "pdf":
            return "application/pdf";
        // Markup / data
        case "md":
        case "markdown":
            return "text/markdown";
        case "json":
            return "application/json";
        case "yaml":
        case "yml":
            return "application/x-yaml";
        case "xml":
            return "application/xml";
        case "toml":
            return "application/toml";
        // Text / code — return text/plain so AI providers accept them
        case "txt":
        case "csv":
        case "log":
        case "env":
        case "ini":
        case "cfg":
        case "conf":
        case "properties":
        case "ts":
        case "tsx":
        case "js":
        case "jsx":
        case "mjs":
        case "cjs":
        case "py":
        case "pyi":
        case "rb":
        case "rs":
        case "go":
        case "java":
        case "kt":
        case "kts":
        case "scala":
        case "c":
        case "h":
        case "cpp":
        case "cc":
        case "cxx":
        case "hpp":
        case "hxx":
        case "cs":
        case "swift":
        case "m":
        case "mm":
        case "r":
        case "lua":
        case "pl":
        case "pm":
        case "php":
        case "ex":
        case "exs":
        case "erl":
        case "hrl":
        case "hs":
        case "lhs":
        case "ml":
        case "mli":
        case "fs":
        case "fsx":
        case "clj":
        case "cljs":
        case "cljc":
        case "dart":
        case "zig":
        case "nim":
        case "v":
        case "vhdl":
        case "verilog":
        case "sql":
        case "graphql":
        case "gql":
        case "proto":
        case "thrift":
        case "sh":
        case "bash":
        case "zsh":
        case "fish":
        case "ps1":
        case "bat":
        case "cmd":
        case "html":
        case "htm":
        case "css":
        case "scss":
        case "sass":
        case "less":
        case "vue":
        case "svelte":
        case "astro":
        case "tf":
        case "hcl":
        case "nix":
        case "cmake":
        case "mk":
        case "gradle":
        case "sbt":
        case "lock":
        case "gitignore":
        case "dockerignore":
        case "editorconfig":
        case "eslintrc":
        case "prettierrc":
            return "text/plain";
        default:
            return "application/octet-stream";
    }
};

const guessMimeType = (file: File): string => {
    // If the browser provides a MIME type that isn't the generic octet-stream fallback, use it
    const browserMime = file.type?.trim().toLowerCase() ?? "";
    if (
        browserMime.length > 0 &&
        browserMime !== "application/octet-stream" &&
        !browserMime.startsWith("application/octet-stream;")
    ) {
        return file.type;
    }

    // Fall back to extension-based detection (reuse guessMimeTypeFromName)
    return guessMimeTypeFromName(file.name);
};

const normalizeServerPath = (inputPath: string): string => inputPath.replace(/\\/g, "/").trim();

const toFileUrl = (inputPath: string): string => {
    const normalized = normalizeServerPath(inputPath);
    if (normalized.startsWith("file://")) {
        return normalized;
    }

    const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
    return `file://${encodeURI(withLeadingSlash)}`;
};

const readRawFileAsDataUrl = async (absolutePath: string): Promise<string> => {
    const response = await fetch(`/api/fs/raw?path=${encodeURIComponent(absolutePath)}`);
    if (!response.ok) {
        throw new Error(`Failed to read raw file: ${response.status}`);
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const useFileStore = create<FileStore>()(

    devtools(
        persist(
            (set, get) => ({

                attachedFiles: [],

                addAttachedFile: async (file: File) => {

                        const { attachedFiles } = get();
                        const isDuplicate = attachedFiles.some((f) => f.filename === file.name && f.size === file.size);
                        if (isDuplicate) {
                            console.log(`File "${file.name}" is already attached`);
                            return;
                        }

                        const maxSize = MAX_ATTACHMENT_SIZE;
                        if (file.size > maxSize) {
                            throw new Error(`File "${file.name}" is too large. Maximum size is 50MB.`);
                        }

                        const allowedTypes = [
                            "text/",
                            "application/json",
                            "application/xml",
                            "application/pdf",
                            "image/",
                            "video/",
                            "audio/",
                            "application/javascript",
                            "application/typescript",
                            "application/x-python",
                            "application/x-ruby",
                            "application/x-sh",
                            "application/yaml",
                            "application/octet-stream",
                        ];

                        const mimeType = guessMimeType(file);
                        const isAllowed = allowedTypes.some((type) => mimeType.startsWith(type) || mimeType === type || mimeType === "");

                        if (!isAllowed && mimeType !== "") {
                            console.warn(`File type "${mimeType}" might not be supported`);
                        }

                        const reader = new FileReader();
                        const rawDataUrl = await new Promise<string>((resolve, reject) => {
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });

                        const dataUrl = rawDataUrl.startsWith("data:")
                            ? rawDataUrl.replace(/^data:[^;]*/, `data:${mimeType}`)
                            : rawDataUrl;

                        const extractFilename = (fullPath: string) => {

                            const parts = fullPath.replace(/\\/g, "/").split("/");
                            return parts[parts.length - 1] || fullPath;
                        };

                        const attachedFile: AttachedFile = {
                            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            file,
                            dataUrl,
                            mimeType,
                            filename: extractFilename(file.name),
                            size: file.size,
                            source: "local",
                        };

                        set((state) => ({
                            attachedFiles: [...state.attachedFiles, attachedFile],
                        }));
                },

                addServerFile: async (path: string, name: string, content?: string) => {

                        const normalizedPath = normalizeServerPath(path);
                        const { attachedFiles } = get();
                        const isDuplicate = attachedFiles.some((f) => normalizeServerPath(f.serverPath || "") === normalizedPath && f.source === "server");
                        if (isDuplicate) {
                            console.log(`Server file "${name}" is already attached`);
                            return;
                        }

                        const inferredMime = guessMimeTypeFromName(name);
                        const safeMimeType = inferredMime && inferredMime.trim().length > 0 ? inferredMime : "text/plain";

                        const isDirectory = safeMimeType === "application/x-directory";

                        // Always read file content and create a data URL with the correct MIME type.
                        // Sending file:// URLs causes the backend to re-detect MIME types which can
                        // produce application/octet-stream and trigger AI provider errors.
                        let dataUrl = toFileUrl(normalizedPath);
                        if (!isDirectory) {
                            try {
                                const rawDataUrl = await readRawFileAsDataUrl(normalizedPath);
                                // Replace the MIME in the data URL with our correctly inferred MIME,
                                // since /api/fs/raw may return application/octet-stream for text files
                                const commaIndex = rawDataUrl.indexOf(',');
                                if (commaIndex !== -1) {
                                    const meta = rawDataUrl.substring(5, commaIndex); // after "data:"
                                    const contentPart = rawDataUrl.substring(commaIndex); // includes comma
                                    const newMeta = meta.replace(/^[^;,]+/, safeMimeType);
                                    dataUrl = `data:${newMeta}${contentPart}`;
                                } else {
                                    dataUrl = rawDataUrl;
                                }
                            } catch (error) {
                                console.warn("Failed to read server file, falling back to file://", error);
                            }
                        }

                        const sizeBytes = typeof content === "string"
                            ? new TextEncoder().encode(content).length
                            : 0;

                        const file = new File([], name, { type: safeMimeType });

                        const attachedFile: AttachedFile = {
                            id: `server-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            file,
                            dataUrl,
                            mimeType: safeMimeType,
                            filename: name,
                            size: sizeBytes,
                            source: "server",
                            serverPath: normalizedPath,
                        };

                        set((state) => ({
                            attachedFiles: [...state.attachedFiles, attachedFile],
                        }));
                },

                removeAttachedFile: (id: string) => {
                    set((state) => ({
                        attachedFiles: state.attachedFiles.filter((f) => f.id !== id),
                    }));
                },

                clearAttachedFiles: () => {
                    set({ attachedFiles: [] });
                },
            }),
            {
                name: "file-store",
                storage: createJSONStorage(() => getSafeStorage()),
                version: 3,
                migrate: (persistedState) => {
                    const state = persistedState as { attachedFiles?: AttachedFile[] } | undefined;
                    return { attachedFiles: Array.isArray(state?.attachedFiles) ? state.attachedFiles : [] };
                },
                // Keep unsent draft attachments across restarts.
                partialize: (state) => ({
                    attachedFiles: state.attachedFiles,
                }),
            }
        ),
        {
            name: "file-store",
        }
    )
);
