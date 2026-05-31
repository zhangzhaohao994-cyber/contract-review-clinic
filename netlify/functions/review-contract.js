const crypto = require("crypto");
const { createReviewStore, estimateSeconds, getAiConfigStatus, jsonResponse, parseMultipart } = require("./review-utils");

function baseUrlFromEvent(event) {
  if (process.env.URL) return process.env.URL;
  const host = event.headers.host || event.headers.Host;
  const proto = event.headers["x-forwarded-proto"] || "https";
  return host ? `${proto}://${host}` : "";
}

async function triggerBackground(event, jobId) {
  const baseUrl = baseUrlFromEvent(event);
  if (!baseUrl) return;
  await fetch(`${baseUrl}/.netlify/functions/process-review-background`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId })
  }).catch(() => undefined);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "只支持 POST 上传。" });

  try {
    const config = getAiConfigStatus();
    if (!config.ok) return jsonResponse(503, { error: config.publicMessage, ownerMessage: config.ownerMessage });

    const { fields, files } = await parseMultipart(event);
    const file = files.find((item) => item.fieldName === "contract-file") || files[0];
    if (!file || !file.content.length) return jsonResponse(400, { error: "没有收到合同文件。" });

    const estimatedSeconds = estimateSeconds(file.content.length);
    const jobId = crypto.randomUUID();
    const store = createReviewStore(event);
    const createdAt = new Date().toISOString();
    const fileBase64 = file.content.toString("base64");
    const userFields = {
      name: fields.name || "",
      contact: fields.contact || "",
      role: fields.role || "",
      concern: fields.concern || ""
    };

    await store.setJSON(`${jobId}:status`, {
      jobId,
      status: "queued",
      stage: "文件已收到，正在排队。",
      progress: 8,
      estimatedSeconds,
      createdAt
    });

    await store.setJSON(`${jobId}:input`, {
      filename: file.filename,
      mimeType: file.mimeType,
      fileBase64,
      fields: userFields,
      estimatedSeconds
    });

    await store.setJSON(`submission:${jobId}`, {
      jobId,
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSize: file.content.length,
      fileBase64,
      fields: userFields,
      estimatedSeconds
    });

    await triggerBackground(event, jobId);
    return jsonResponse(202, { jobId, estimatedSeconds, status: "queued" });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "上传失败，请稍后再试。" });
  }
};
