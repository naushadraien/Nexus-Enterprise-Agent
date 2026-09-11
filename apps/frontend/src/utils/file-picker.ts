export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "text"
  | "other";

export const generateRandomId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export type ImageResult = {
  photoId: string;
  photoUrl?: string;
  file?: File;
};

export interface SelectedWebFile {
  id: string;
  file: File;
  name: string;
  mimeType: string;
  extension: string;
  size: number;
  sizeFormatted: string;
  lastModified: number;
  category: FileCategory;
}

export interface BaseWebFilePickerOptions {
  accept?: string | string[];
  capture?: "user" | "environment";
  maxFiles?: number;
  maxSizeInBytes?: number;
}

const DOCUMENT_ACCEPT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/json",
];

const TEXT_MIME_TYPES = [
  "text/plain",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/xml",
];

const ARCHIVE_MIME_TYPES = [
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
];

const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
};

const normalizeAccept = (accept?: string | string[]): string => {
  if (!accept) return "";
  return Array.isArray(accept) ? accept.join(",") : accept;
};

const getExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
};

const getFileCategory = (mimeType: string): FileCategory => {
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime.startsWith("image/")) return "image";
  if (lowerMime.startsWith("video/")) return "video";
  if (lowerMime.startsWith("audio/")) return "audio";
  if (DOCUMENT_ACCEPT_TYPES.includes(lowerMime)) return "document";
  if (TEXT_MIME_TYPES.includes(lowerMime)) return "text";
  if (ARCHIVE_MIME_TYPES.includes(lowerMime)) return "archive";

  return "other";
};

const buildSelectedFile = (file: File, index: number): SelectedWebFile => {
  const id = `local_${Date.now()}_${index}`;

  return {
    id,
    file,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    extension: getExtension(file.name),
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    lastModified: file.lastModified,
    category: getFileCategory(file.type || "application/octet-stream"),
  };
};

const pickFilesFromBrowser = async ({
  accept,
  multiple,
  capture,
}: {
  accept?: string | string[];
  multiple: boolean;
  capture?: "user" | "environment";
}): Promise<File[] | null> => {
  if (typeof document === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = normalizeAccept(accept);

    if (capture) {
      input.setAttribute("capture", capture);
    }

    input.style.position = "fixed";
    input.style.left = "-9999px";

    let settled = false;

    const cleanup = () => {
      window.removeEventListener("focus", handleWindowFocus);
      input.removeEventListener("change", handleChange);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const settle = (files: File[] | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(files);
    };

    const handleChange = () => {
      const selected = input.files ? Array.from(input.files) : [];
      settle(selected.length > 0 ? selected : null);
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled) {
          settle(null);
        }
      }, 300);
    };

    input.addEventListener("change", handleChange);
    window.addEventListener("focus", handleWindowFocus, { once: true });

    document.body.appendChild(input);
    input.click();
  });
};

const validateAndMapFiles = (
  files: File[],
  options?: BaseWebFilePickerOptions,
): SelectedWebFile[] => {
  const maxFiles = options?.maxFiles;
  const maxSizeInBytes = options?.maxSizeInBytes;

  const sliced =
    typeof maxFiles === "number" && maxFiles > 0
      ? files.slice(0, maxFiles)
      : files;

  if (typeof maxSizeInBytes === "number" && maxSizeInBytes > 0) {
    const tooLargeFile = sliced.find((file) => file.size > maxSizeInBytes);

    if (tooLargeFile) {
      throw new Error(
        `${tooLargeFile.name} exceeds the maximum allowed size of ${formatFileSize(maxSizeInBytes)}.`,
      );
    }
  }

  return sliced.map((file, index) => buildSelectedFile(file, index));
};

export const selectSingleFile = async (
  options?: BaseWebFilePickerOptions,
): Promise<SelectedWebFile | null> => {
  const files = await pickFilesFromBrowser({
    accept: options?.accept,
    capture: options?.capture,
    multiple: false,
  });

  if (!files || files.length === 0) {
    return null;
  }

  return validateAndMapFiles([files[0]], options)[0] ?? null;
};

export const selectMultipleFiles = async (
  options?: BaseWebFilePickerOptions,
): Promise<SelectedWebFile[] | null> => {
  const files = await pickFilesFromBrowser({
    accept: options?.accept,
    capture: options?.capture,
    multiple: true,
  });

  if (!files || files.length === 0) {
    return null;
  }

  const mapped = validateAndMapFiles(files, options);
  return mapped.length > 0 ? mapped : null;
};

export const selectSingleImage = async (
  options?: Omit<BaseWebFilePickerOptions, "maxFiles">,
): Promise<SelectedWebFile | null> => {
  return selectSingleFile({
    ...options,
    accept: options?.accept || "image/*",
    maxFiles: 1,
  });
};

export const selectMultipleImages = async (
  options?: Omit<BaseWebFilePickerOptions, "accept">,
): Promise<SelectedWebFile[] | null> => {
  return selectMultipleFiles({
    ...options,
    accept: "image/*",
  });
};

export const selectSingleVideo = async (
  options?: Omit<BaseWebFilePickerOptions, "accept" | "maxFiles">,
): Promise<SelectedWebFile | null> => {
  return selectSingleFile({
    ...options,
    accept: "video/*",
    maxFiles: 1,
  });
};

export const selectMultipleVideos = async (
  options?: Omit<BaseWebFilePickerOptions, "accept">,
): Promise<SelectedWebFile[] | null> => {
  return selectMultipleFiles({
    ...options,
    accept: "video/*",
  });
};

export const selectSingleDocument = async (
  options?: Omit<BaseWebFilePickerOptions, "accept" | "maxFiles">,
): Promise<SelectedWebFile | null> => {
  return selectSingleFile({
    ...options,
    accept: DOCUMENT_ACCEPT_TYPES,
    maxFiles: 1,
  });
};

export const selectMultipleDocuments = async (
  options?: Omit<BaseWebFilePickerOptions, "accept">,
): Promise<SelectedWebFile[] | null> => {
  return selectMultipleFiles({
    ...options,
    accept: DOCUMENT_ACCEPT_TYPES,
  });
};

export const createObjectUrl = (file: File | Blob): string => {
  return URL.createObjectURL(file);
};

export const revokeObjectUrl = (url: string): void => {
  URL.revokeObjectURL(url);
};

export const downloadWebFile = (url: string, fileName: string): void => {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ── File-info helper (works for both local File objects and remote URLs) ──

export interface WebFileInfo {
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  sizeFormatted: string;
  isLocal: boolean;
}

/**
 * Extract file metadata from a local `File` object **or** a remote URL.
 *
 * - **Local**: reads name / size / type directly from the `File`.
 * - **Remote**: sends a lightweight `HEAD` request to pull
 *   `content-length`, `content-type`, and derives the file name from the URL path.
 */
export async function getWebFileInfo(
  source: File | string,
): Promise<WebFileInfo> {
  // ── Local File ──
  if (source instanceof File) {
    const ext = getExtension(source.name);
    return {
      name: source.name,
      extension: ext,
      mimeType: source.type || "application/octet-stream",
      size: source.size,
      sizeFormatted: formatFileSize(source.size),
      isLocal: true,
    };
  }

  // ── Remote URL ──
  const url = source;
  const extractNameFromUrl = (rawUrl: string): string => {
    try {
      const { pathname } = new URL(rawUrl);
      const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(lastSegment.split("?")[0]) || "unknown";
    } catch {
      const parts = rawUrl.split("/").pop()?.split("?")[0] || "unknown";
      return decodeURIComponent(parts);
    }
  };

  let name = extractNameFromUrl(url);
  let mimeType = "";
  let size = 0;

  try {
    const res = await fetch(url, { method: "HEAD" });

    const contentLength =
      res.headers.get("content-length") ??
      res.headers.get("Content-Length") ??
      "";
    const contentType =
      res.headers.get("content-type") ?? res.headers.get("Content-Type") ?? "";

    // Some CDNs return a content-disposition header with the real filename
    const disposition =
      res.headers.get("content-disposition") ??
      res.headers.get("Content-Disposition") ??
      "";
    const filenameMatch = disposition.match(
      /filename\*?=(?:UTF-8''|")?([^";]+)"?/i,
    );
    if (filenameMatch?.[1]) {
      name = decodeURIComponent(filenameMatch[1].trim());
    }

    size = contentLength ? parseInt(contentLength, 10) : 0;
    mimeType = contentType.split(";")[0].trim();
  } catch {
    // Network failure – fall back to what we can derive from the URL itself
  }

  // Derive extension from name, or fall back to mimeType
  let extension = getExtension(name);
  if (!extension && mimeType) {
    const subType = mimeType.split("/")[1];
    extension = subType ? `.${subType}` : "";
  }

  // If we still have no mimeType, try to guess from the extension
  if (!mimeType && extension) {
    const guessKey = extension.replace(".", "").toLowerCase();
    const match = Object.entries(
      Object.fromEntries([
        ["jpg", "image/jpeg"],
        ["jpeg", "image/jpeg"],
        ["png", "image/png"],
        ["gif", "image/gif"],
        ["webp", "image/webp"],
        ["svg", "image/svg+xml"],
        ["heic", "image/heic"],
        ["avif", "image/avif"],
        ["bmp", "image/bmp"],
        ["mp4", "video/mp4"],
        ["pdf", "application/pdf"],
      ]),
    ).find(([key]) => key === guessKey);

    mimeType = match?.[1] ?? "application/octet-stream";
  }

  if (!mimeType) {
    mimeType = "application/octet-stream";
  }

  return {
    name,
    extension,
    mimeType,
    size,
    sizeFormatted: size > 0 ? formatFileSize(size) : "",
    isLocal: false,
  };
}
