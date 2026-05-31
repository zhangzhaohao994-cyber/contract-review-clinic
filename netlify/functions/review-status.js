const { createReviewStore, jsonResponse } = require("./review-utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "只支持 GET 查询。" });
  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) return jsonResponse(400, { error: "缺少任务编号。" });

  try {
    const store = createReviewStore();
    const status = await store.get(`${jobId}:status`, { type: "json" });
    if (!status) return jsonResponse(404, { error: "没有找到这个审查任务。" });
    return jsonResponse(200, status);
  } catch (error) {
    return jsonResponse(500, { error: error.message || "查询失败。" });
  }
};
