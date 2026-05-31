const { createReviewStore, jsonResponse, normalizeFilename } = require("./review-utils");

function adminError(event) {
  const expected = String(process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return jsonResponse(503, { error: "后台还没有设置 ADMIN_TOKEN。" });
  const token = String(event.queryStringParameters?.token || event.headers["x-admin-token"] || event.headers["X-Admin-Token"] || "").trim();
  if (token !== expected) return jsonResponse(401, { error: "后台口令不对。" });
  return null;
}

function publicSubmission(submission, status) {
  return {
    jobId: submission.jobId,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    completedAt: status?.completedAt || submission.completedAt || "",
    status: status?.status || submission.status || "queued",
    stage: status?.stage || submission.stage || "",
    progress: status?.progress ?? submission.progress ?? 0,
    error: status?.error || submission.error || "",
    summary: status?.summary || submission.summary || "",
    note: status?.note || submission.note || "",
    keyRisks: submission.keyRisks || [],
    changeCount: submission.changeCount || 0,
    filename: normalizeFilename(submission.filename),
    mimeType: submission.mimeType,
    fileSize: submission.fileSize,
    fields: submission.fields || {},
    hasOriginal: Boolean(submission.fileBase64),
    hasReviewFiles: Boolean(status?.files?.length)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "只支持 GET。" });
  const blocked = adminError(event);
  if (blocked) return blocked;

  try {
    const store = createReviewStore(event);
    const jobId = event.queryStringParameters?.jobId;
    if (jobId) {
      const submission = await store.get(`submission:${jobId}`, { type: "json" });
      if (!submission) return jsonResponse(404, { error: "没有找到这条提交。" });
      const status = await store.get(`${jobId}:status`, { type: "json" });
      return jsonResponse(200, { submission: publicSubmission(submission, status) });
    }

    const listed = await store.list({ prefix: "submission:" });
    const submissions = [];
    for (const blob of listed.blobs || []) {
      const key = blob.key || blob.name;
      if (!key) continue;
      const submission = await store.get(key, { type: "json" });
      if (!submission?.jobId) continue;
      const status = await store.get(`${submission.jobId}:status`, { type: "json" });
      submissions.push(publicSubmission(submission, status));
    }

    submissions.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return jsonResponse(200, { submissions });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "读取后台提交失败。" });
  }
};
