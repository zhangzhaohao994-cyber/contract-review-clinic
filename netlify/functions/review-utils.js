const Busboy = require("busboy");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { connectLambda, getStore } = require("@netlify/blobs");
const JSZip = require("jszip");
const pdfParse = require("pdf-parse");
const { Document, HeadingLevel, Packer, Paragraph, TextRun } = require("docx");

const MAX_FILE_BYTES = 7 * 1024 * 1024;
const MAX_CONTRACT_CHARS = 90000;

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function localStorePath(key) {
  const safeKey = Buffer.from(key).toString("base64url");
  return path.join(os.tmpdir(), "bubeiken-contract-reviews", `${safeKey}.json`);
}

function createReviewStore(event) {
  let blobStore = null;
  try {
    if (event) connectLambda(event);
    blobStore = getStore("contract-reviews");
  } catch {
    blobStore = null;
  }

  async function withFallback(key, action, fallback) {
    if (blobStore) {
      try {
        return await action(blobStore);
      } catch (error) {
        if (process.env.NETLIFY) throw error;
        if (!String(error.message || "").includes("Netlify Blobs")) throw error;
      }
    }
    await fs.mkdir(path.dirname(localStorePath(key)), { recursive: true });
    return fallback();
  }

  return {
    async get(key, options = {}) {
      return withFallback(
        key,
        (store) => store.get(key, options),
        async () => {
          try {
            const text = await fs.readFile(localStorePath(key), "utf8");
            return options.type === "json" ? JSON.parse(text) : text;
          } catch (error) {
            if (error.code === "ENOENT") return null;
            throw error;
          }
        }
      );
    },
    async setJSON(key, value) {
      return withFallback(
        key,
        (store) => store.setJSON(key, value),
        () => fs.writeFile(localStorePath(key), JSON.stringify(value), "utf8")
      );
    },
    async delete(key) {
      return withFallback(
        key,
        (store) => store.delete(key),
        async () => {
          await fs.unlink(localStorePath(key)).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      );
    }
  };
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers["content-type"] || event.headers["Content-Type"];
    if (!contentType) {
      reject(new Error("缺少上传类型。"));
      return;
    }

    const fields = {};
    const files = [];
    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { files: 1, fileSize: MAX_FILE_BYTES }
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, file, info) => {
      const chunks = [];
      let limited = false;
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("limit", () => {
        limited = true;
      });
      file.on("end", () => {
        files.push({
          fieldName: name,
          filename: info.filename || "contract",
          mimeType: info.mimeType || "application/octet-stream",
          limited,
          content: Buffer.concat(chunks)
        });
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => resolve({ fields, files }));
    busboy.end(Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8"));
  });
}

function estimateSeconds(fileSize) {
  const sizeMb = Math.max(1, Math.ceil(fileSize / 1024 / 1024));
  return Math.min(150, 35 + sizeMb * 12);
}

function getOpenAiConfigStatus() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || "gpt-4.1").trim();
  if (!apiKey) {
    return {
      ok: false,
      code: "missing_key",
      model,
      publicMessage: "AI 审查通道还没接上，先别把合同递进来。",
      ownerMessage: "Netlify 生产环境没有配置 OPENAI_API_KEY。请添加 OpenAI 后台生成的 sk- 开头密钥。"
    };
  }
  if (!apiKey.startsWith("sk-")) {
    return {
      ok: false,
      code: "invalid_key_format",
      model,
      publicMessage: "AI 审查通道接线不对，先暂停上传。",
      ownerMessage: "Netlify 里的 OPENAI_API_KEY 格式不对。请使用 OpenAI 后台生成的 sk- 开头密钥。"
    };
  }
  return { ok: true, code: "ready", apiKey, model };
}

function cleanFilename(filename) {
  return String(filename || "contract").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "contract";
}

function baseName(filename) {
  return cleanFilename(filename).replace(/\.[^.]+$/, "") || "contract";
}

function extensionOf(filename) {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractDocxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("没有读到 Word 正文。");
  return decodeXmlEntities(
    documentXml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

async function extractPdfText(buffer) {
  const parsed = await pdfParse(buffer);
  return (parsed.text || "").replace(/\n{3,}/g, "\n\n").trim();
}

function stripRtf(value) {
  return value
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractContractText(file) {
  const ext = extensionOf(file.filename);
  if (file.limited || file.content.length > MAX_FILE_BYTES) {
    throw new Error("文件太大了。请上传 7MB 以内的 docx、pdf 或 txt 文件。");
  }
  if (ext === "docx") return extractDocxText(file.content);
  if (ext === "pdf") return extractPdfText(file.content);
  if (["txt", "md"].includes(ext)) return file.content.toString("utf8").trim();
  if (ext === "rtf") return stripRtf(file.content.toString("utf8"));
  throw new Error("暂时支持 docx、pdf、txt、md、rtf。请把 doc 或 wps 另存为 docx 后再上传。");
}

function trimContractText(text) {
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  if (clean.length <= MAX_CONTRACT_CHARS) return { text: clean, truncated: false };
  return {
    text: clean.slice(0, MAX_CONTRACT_CHARS),
    truncated: true
  };
}

function textParagraphs(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : ["未生成内容。"];
}

function p(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    spacing: { after: options.after ?? 180 },
    children: [
      new TextRun({
        text,
        bold: Boolean(options.bold),
        color: options.color,
        size: options.size || 24
      })
    ]
  });
}

async function makeDocxBuffer(title, sections) {
  const children = [
    p(title, { heading: HeadingLevel.TITLE, size: 36, after: 320 }),
    ...sections.flatMap((section) => {
      const block = [];
      if (section.title) block.push(p(section.title, { heading: HeadingLevel.HEADING_2, size: 30, after: 180 }));
      section.paragraphs.forEach((paragraph) => block.push(p(paragraph)));
      return block;
    })
  ];
  const doc = new Document({
    sections: [{ properties: {}, children }]
  });
  return Packer.toBuffer(doc);
}

async function buildReviewFiles(review, filename) {
  const name = baseName(filename);
  const revisedBuffer = await makeDocxBuffer(`修改版-${name}`, [
    {
      title: "修改后的合同文本",
      paragraphs: textParagraphs(review.revised_contract_text)
    }
  ]);

  const changeParagraphs = [
    review.overall_summary || "已完成合同审查。",
    ...(review.change_log || []).flatMap((item, index) => [
      `${index + 1}. ${item.location || "相关条款"}`,
      `原文：${item.original || "未列明"}`,
      `问题：${item.problem || "未列明"}`,
      `建议：${item.revised || "未列明"}`,
      `理由：${item.reason || "未列明"}`
    ]),
    ...(review.key_risks || []).map((risk) => `重点风险：${risk}`)
  ];
  const changesBuffer = await makeDocxBuffer(`修改说明-${name}`, [
    {
      title: "审查摘要",
      paragraphs: changeParagraphs
    }
  ]);

  return [
    {
      filename: `修改版-${name}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      data: revisedBuffer.toString("base64")
    },
    {
      filename: `修改说明-${name}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      data: changesBuffer.toString("base64")
    }
  ];
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 返回内容不是可解析的 JSON。");
    return JSON.parse(match[0]);
  }
}

function responseText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

module.exports = {
  buildReviewFiles,
  createReviewStore,
  estimateSeconds,
  extractContractText,
  getOpenAiConfigStatus,
  jsonResponse,
  parseMultipart,
  safeJsonParse,
  trimContractText,
  responseText
};
