const { getOpenAiConfigStatus, jsonResponse } = require("./review-utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "只支持 GET 查询。" });

  const config = getOpenAiConfigStatus();
  return jsonResponse(200, {
    ok: config.ok,
    code: config.code,
    model: config.model,
    message: config.ok ? "AI 审查通道已接通。" : config.publicMessage
  });
};
