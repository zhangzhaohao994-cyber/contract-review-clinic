const {
  buildReviewFiles,
  createReviewStore,
  extractContractText,
  getOpenAiConfigStatus,
  jsonResponse,
  responseText,
  safeJsonParse,
  trimContractText
} = require("./review-utils");

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overall_summary", "key_risks", "change_log", "revised_contract_text", "review_note"],
  properties: {
    overall_summary: { type: "string" },
    key_risks: { type: "array", items: { type: "string" }, maxItems: 8 },
    change_log: {
      type: "array",
      maxItems: 18,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["location", "original", "problem", "revised", "reason"],
        properties: {
          location: { type: "string" },
          original: { type: "string" },
          problem: { type: "string" },
          revised: { type: "string" },
          reason: { type: "string" }
        }
      }
    },
    revised_contract_text: { type: "string" },
    review_note: { type: "string" }
  }
};

async function updateStatus(store, jobId, patch) {
  const current = (await store.get(`${jobId}:status`, { type: "json" })) || {};
  await store.setJSON(`${jobId}:status`, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

async function waitForInput(store, jobId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const input = await store.get(`${jobId}:input`, { type: "json" });
    if (input) return input;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function reviewWithOpenAI({ contractText, fields, filename, truncated }) {
  const config = getOpenAiConfigStatus();
  if (!config.ok) throw new Error(config.ownerMessage);

  const model = config.model;
  const prompt = [
    `文件名：${filename}`,
    `用户角色：${fields.role || "未说明"}`,
    `用户担心：${fields.concern || "未说明"}`,
    truncated ? "注意：合同文本过长，本次只审查了前半部分。" : "",
    "请站在用户利益一侧审查合同，重点看付款前提、个人/连带责任、空白补写、违约金、争议管辖、证据闭环、解除/退还机制。",
    "请不要编造不存在的条款。修改版应尽量保留原合同结构和交易目的，但把明显风险句改成更保护用户的写法。",
    "输出必须符合 JSON schema。",
    "",
    "合同正文：",
    contractText
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "你是严谨的中文合同审查助手。你不是律师替代品，但要给出可执行、可谈判的合同修改建议。只输出 JSON。"
            }
          ]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "contract_review_result",
          schema: REVIEW_SCHEMA,
          strict: true
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const rawMessage = payload.error?.message || "OpenAI 审查失败。";
    const message = response.status === 401
      ? "OpenAI 密钥验证失败。请检查 Netlify 里的 OPENAI_API_KEY 是否来自 OpenAI 后台。"
      : rawMessage;
    throw new Error(message);
  }
  return safeJsonParse(responseText(payload));
}

exports.handler = async (event) => {
  const store = createReviewStore(event);
  let jobId = "";
  try {
    jobId = JSON.parse(event.body || "{}").jobId;
    if (!jobId) return jsonResponse(400, { error: "缺少任务编号。" });

    const input = await waitForInput(store, jobId);
    if (!input) throw new Error("没有找到上传文件。");

    await updateStatus(store, jobId, { status: "processing", stage: "正在读取合同文件。", progress: 22 });

    const file = {
      filename: input.filename,
      mimeType: input.mimeType,
      content: Buffer.from(input.fileBase64, "base64")
    };
    const extracted = await extractContractText(file);
    const { text: contractText, truncated } = trimContractText(extracted);
    if (contractText.length < 30) throw new Error("没有读到足够的合同正文，请换成文字版 docx/pdf/txt。");

    await updateStatus(store, jobId, { stage: "正在让 AI 审查风险条款。", progress: 48 });
    const review = await reviewWithOpenAI({
      contractText,
      fields: input.fields || {},
      filename: input.filename,
      truncated
    });

    await updateStatus(store, jobId, { stage: "正在生成修改版和修改说明。", progress: 82 });
    const files = await buildReviewFiles(review, input.filename);

    await store.setJSON(`${jobId}:status`, {
      jobId,
      status: "completed",
      stage: "审查完成。",
      progress: 100,
      estimatedSeconds: input.estimatedSeconds,
      summary: review.overall_summary,
      note: review.review_note,
      files,
      completedAt: new Date().toISOString()
    });
    await store.delete(`${jobId}:input`).catch(() => undefined);
    return jsonResponse(202, { ok: true });
  } catch (error) {
    if (jobId) {
      await updateStatus(store, jobId, {
        status: "error",
        stage: "审查失败。",
        progress: 100,
        error: error.message || "审查失败，请稍后再试。"
      }).catch(() => undefined);
    }
    return jsonResponse(500, { error: error.message || "审查失败。" });
  }
};
