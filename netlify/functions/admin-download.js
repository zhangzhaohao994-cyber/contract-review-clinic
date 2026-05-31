const { createReviewStore, jsonResponse, normalizeFilename } = require("./review-utils");

function adminError(event) {
  const expected = String(process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return jsonResponse(503, { error: "后台还没有设置 ADMIN_TOKEN。" });
  const token = String(event.queryStringParameters?.token || event.headers["x-admin-token"] || event.headers["X-Admin-Token"] || "").trim();
  if (token !== expected) return jsonResponse(401, { error: "后台口令不对。" });
  return null;
}

function attachmentName(filename) {
  const clean = normalizeFilename(filename || "download").replace(/[\\/:*?"<>|]+/g, "-").trim() || "download";
  const fallback = clean.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "只支持 GET。" });
  const blocked = adminError(event);
  if (blocked) return blocked;

  try {
    const jobId = event.queryStringParameters?.jobId;
    const type = event.queryStringParameters?.type || "original";
    if (!jobId) return jsonResponse(400, { error: "缺少任务编号。" });

    const store = createReviewStore(event);
    if (type === "original") {
      const submission = await store.get(`submission:${jobId}`, { type: "json" });
      if (!submission?.fileBase64) return jsonResponse(404, { error: "没有找到原始合同。" });
      return {
        statusCode: 200,
        headers: {
          "content-type": submission.mimeType || "application/octet-stream",
          "content-disposition": attachmentName(submission.filename || "contract"),
          "cache-control": "no-store"
        },
        isBase64Encoded: true,
        body: submission.fileBase64
      };
    }

    const status = await store.get(`${jobId}:status`, { type: "json" });
    const files = status?.files || [];
    const index = type === "changes" ? 1 : 0;
    const file = files[index];
    if (!file?.data) return jsonResponse(404, { error: "审查文件还没有生成。" });

    return {
      statusCode: 200,
      headers: {
        "content-type": file.mimeType || "application/octet-stream",
        "content-disposition": attachmentName(file.filename || "review.docx"),
        "cache-control": "no-store"
      },
      isBase64Encoded: true,
      body: file.data
    };
  } catch (error) {
    return jsonResponse(500, { error: error.message || "下载失败。" });
  }
};
