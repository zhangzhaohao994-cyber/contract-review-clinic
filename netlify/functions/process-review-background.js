const {
  buildReviewFiles,
  createReviewStore,
  extractContractText,
  getAiConfigStatus,
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

async function updateSubmission(store, jobId, patch) {
  const current = await store.get(`submission:${jobId}`, { type: "json" });
  if (!current) return;
  await store.setJSON(`submission:${jobId}`, {
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
  const submission = await store.get(`submission:${jobId}`, { type: "json" });
  if (!submission?.fileBase64) return null;
  return {
    filename: submission.filename,
    mimeType: submission.mimeType,
    fileBase64: submission.fileBase64,
    fields: submission.fields || {},
    estimatedSeconds: submission.estimatedSeconds || 60
  };
}

async function reviewWithAi({ contractText, fields, filename, truncated }) {
  const config = getAiConfigStatus();
  if (!config.ok) throw new Error(config.publicMessage || "日本博士后审查通道暂时不可用。");
  if (config.provider === "deepseek") return reviewWithDeepSeek({ config, contractText, fields, filename, truncated });
  if (config.provider === "gemini") return reviewWithGemini({ config, contractText, fields, filename, truncated });
  if (config.provider !== "openai") throw new Error("日本博士后审查通道配置错误。");

  const model = config.model;
  const prompt = buildReviewPrompt({ contractText, fields, filename, truncated });

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
    const rawMessage = payload.error?.message || "审查通道返回失败。";
    let message = rawMessage;
    if (response.status === 401) {
      message = "审查通道验证失败，请稍后再试。";
    } else if (response.status === 429 || /quota|billing|额度|余额/i.test(rawMessage)) {
      message = "审查通道额度暂时不可用，请稍后再试。";
    }
    throw new Error(message);
  }
  return safeJsonParse(responseText(payload));
}

function buildReviewPrompt({ contractText, fields, filename, truncated }) {
  return [
    `文件名：${filename}`,
    `用户角色：${fields.role || "未说明"}`,
    `用户担心：${fields.concern || "未说明"}`,
    truncated ? "注意：合同文本过长，本次只审查了前半部分。" : "",
    "请站在用户利益一侧审查合同，重点看付款前提、个人/连带责任、空白补写、违约金、争议管辖、证据闭环、解除/退还机制。",
    "请不要编造不存在的条款。修改版应尽量保留原合同结构和交易目的，但把明显风险句改成更保护用户的写法。",
    "revised_contract_text 必须输出完整修改后合同正文，不允许为空；如果某些建议无法直接替换进原文，也要在合同末尾追加“补充修改条款”。",
    "输出必须符合 JSON schema。",
    "",
    "合同正文：",
    contractText
  ].filter(Boolean).join("\n");
}

function cleanClause(value) {
  return String(value || "")
    .replace(/^[\s"'“”‘’《》【】]+|[\s"'“”‘’《》【】]+$/g, "")
    .replace(/^(原文|建议|修改为|改为|条款)[:：]\s*/g, "")
    .trim();
}

function hasUsefulText(value) {
  const text = String(value || "").trim();
  if (text.length < 20) return false;
  if (/^(已完成合同审查|未生成内容|无|暂无|N\/A)$/i.test(text)) return false;
  return /[\u3400-\u9FFF]/.test(text);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAllLiteral(text, original, revised) {
  if (!original || !revised || !text.includes(original)) return { text, count: 0 };
  const count = text.split(original).length - 1;
  return { text: text.split(original).join(revised), count };
}

function replaceWithLooseWhitespace(text, original, revised) {
  const parts = cleanClause(original).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { text, count: 0 };
  const pattern = parts.map(escapeRegExp).join("\\s+");
  const regex = new RegExp(pattern, "g");
  let count = 0;
  const replaced = text.replace(regex, () => {
    count += 1;
    return revised;
  });
  return { text: replaced, count };
}

function normalizeChangeLog(changeLog) {
  if (!Array.isArray(changeLog)) return [];
  return changeLog
    .map((item) => ({
      location: cleanClause(item?.location) || "相关条款",
      original: cleanClause(item?.original),
      problem: cleanClause(item?.problem) || "该条款可能对用户不利。",
      revised: cleanClause(item?.revised),
      reason: cleanClause(item?.reason) || "降低签约后的履约和举证风险。"
    }))
    .filter((item) => item.revised && !/^(未列明|无|暂无|N\/A)$/i.test(item.revised));
}

function applyChangeLogToContract(contractText, changeLog) {
  let revisedText = String(contractText || "");
  const unapplied = [];
  let appliedCount = 0;

  for (const item of changeLog) {
    const original = cleanClause(item.original);
    const revised = cleanClause(item.revised);
    if (!original || !revised || /^(未列明|相关条款)$/i.test(original)) {
      unapplied.push(item);
      continue;
    }

    let result = replaceAllLiteral(revisedText, original, revised);
    if (!result.count) result = replaceWithLooseWhitespace(revisedText, original, revised);
    if (result.count) {
      revisedText = result.text;
      appliedCount += result.count;
    } else {
      unapplied.push(item);
    }
  }

  if (unapplied.length) {
    revisedText += [
      "",
      "",
      "【日本博士后补充修改条款】",
      ...unapplied.map((item, index) => [
        `${index + 1}. ${item.location}`,
        item.original ? `原条款：${item.original}` : "",
        `建议改为：${item.revised}`,
        `修改理由：${item.reason}`
      ].filter(Boolean).join("\n"))
    ].join("\n");
  }

  return { revisedText: revisedText.trim(), appliedCount };
}

const FALLBACK_RULES = [
  {
    location: "付款前提",
    pattern: /不可撤销|不可更改|无条件|见索即付|放弃.{0,8}抗辩|永久放弃/g,
    problem: "这类表述会削弱付款方的条件抗辩和协商空间。",
    revised: "付款及履行应以合同生效、对应服务完成、资料齐全并经我方书面确认为前提；我方保留依法及依约享有的全部抗辩权。",
    reason: "把无条件付款改成条件成就后付款，避免签字后被动付款。"
  },
  {
    location: "空白和涂改",
    pattern: /空白处.{0,16}填写有效|下划线.{0,16}填写有效|自行填写有效|补写有效|涂改.{0,12}有效/g,
    problem: "空白授权可能导致金额、日期、账户或责任被单方补写。",
    revised: "任何空白、补充、涂改、账户变更、金额变更或日期变更，均须经双方另行签字或盖章确认，否则对我方不发生效力。",
    reason: "堵住签后补写和单方变更空间。"
  },
  {
    location: "个人担保",
    pattern: /全体股东.{0,30}连带.{0,20}责任|个人连带.{0,20}责任|连带担保|个人担保|本人所有银行账户|法定代表人.{0,20}承担/g,
    problem: "公司合同里混入个人责任，会把风险从公司层面扩大到个人财产。",
    revised: "本协议不构成法定代表人、股东、员工、关联方或任何自然人的个人担保、连带保证或个人清偿责任。",
    reason: "避免公司交易风险扩张到个人口袋。"
  },
  {
    location: "违约金",
    pattern: /每日千分之[一二三四五六七八九十0-9]+|千分之三|滞纳金|违约金.{0,18}每日|罚金/g,
    problem: "每日千分级违约金过高，容易快速滚大。",
    revised: "逾期付款经守约方书面催告后仍未支付的，按逾期未付款金额每日万分之二计算违约金，且违约金总额最高不超过逾期未付款金额的10%。",
    reason: "降低违约金过高导致的失控风险。"
  },
  {
    location: "收款凭证",
    pattern: /无需.{0,10}收据|无需.{0,10}凭证|不.{0,4}出具.{0,8}凭证|现金支付/g,
    problem: "没有收据、发票或银行回单，会导致付款事实和金额难以证明。",
    revised: "付款应通过双方确认的银行账户进行；收款方应在收款前提供合法收款凭证或发票，并在收款后出具收款确认，银行回单可作为付款证明。",
    reason: "建立付款证据闭环，避免付了钱但说不清。"
  },
  {
    location: "争议管辖",
    pattern: /项目所在地人民法院|乙方住所地人民法院|对方所在地人民法院|任意一方所在地人民法院/g,
    problem: "不利管辖会提高维权成本。",
    revised: "因本协议产生的争议，双方应先友好协商；协商不成的，由甲方住所地有管辖权的人民法院管辖。",
    reason: "尽量把争议解决地点放在更有利、成本更低的位置。"
  },
  {
    location: "冻结账户",
    pattern: /冻结.{0,12}账户|申请冻结|财产保全|执行费/g,
    problem: "合同不能把对方单方主张直接写成冻结账户的通行证。",
    revised: "任何保全、冻结、执行措施均应以法律规定及有权机关依法作出的文书为准，双方均保留依法提出异议、抗辩和救济的权利。",
    reason: "避免合同文本制造不必要的单方压迫。"
  }
];

const FALLBACK_MISSING_CLAUSES = [
  {
    location: "解除和返还",
    needed: /解除|终止|退还|返还|抵扣/,
    problem: "缺少条件不成就时的退出和返还机制。",
    revised: "补充条款：如因对方信息不实、资质不全、服务未完成、付款条件未成就或合同目的无法实现，我方有权暂停付款、解除协议，并要求返还已付款项及赔偿因此产生的合理损失。",
    reason: "给甲方或付款方保留退出通道。"
  },
  {
    location: "证据闭环",
    needed: /发票|收据|收款确认|银行回单|完税/,
    problem: "缺少付款、交付、验收和收款凭证安排。",
    revised: "补充条款：双方应保存合同、聊天记录、交付记录、验收记录、发票、收据、银行回单及收款确认等材料，作为履约和付款依据。",
    reason: "减少事后举证困难。"
  }
];

function buildFallbackReview(contractText, fields = {}) {
  let revisedText = String(contractText || "");
  const changeLog = [];
  const seen = new Set();

  for (const rule of FALLBACK_RULES) {
    revisedText = revisedText.replace(rule.pattern, (match) => {
      const key = `${rule.location}:${match}`;
      if (!seen.has(key)) {
        seen.add(key);
        changeLog.push({
          location: rule.location,
          original: match,
          problem: rule.problem,
          revised: rule.revised,
          reason: rule.reason
        });
      }
      return rule.revised;
    });
  }

  const concern = String(fields.concern || "");
  for (const clause of FALLBACK_MISSING_CLAUSES) {
    if (!clause.needed.test(contractText) || /空白|付款|担责|连带|违约|居间|甲方|乙方/.test(concern)) {
      changeLog.push({
        location: clause.location,
        original: "原合同未明确约定",
        problem: clause.problem,
        revised: clause.revised,
        reason: clause.reason
      });
      revisedText += `\n\n${clause.revised}`;
    }
  }

  return {
    overall_summary: changeLog.length
      ? `已按用户立场生成修改版，重点处理 ${changeLog.length} 处付款、责任、证据或退出风险。`
      : "未发现可自动替换的典型高风险表述，修改版保留原合同正文。",
    key_risks: changeLog.slice(0, 8).map((item) => `${item.location}：${item.problem}`),
    change_log: changeLog,
    revised_contract_text: revisedText.trim() || contractText,
    review_note: "本次结果用于签前初审和谈判准备，不替代律师正式法律意见。"
  };
}

function normalizeReviewResult(review, contractText, fields) {
  const fallback = buildFallbackReview(contractText, fields);
  const source = review && typeof review === "object" ? review : {};
  const sourceChangeLog = normalizeChangeLog(source.change_log);
  const changeLog = sourceChangeLog.length ? sourceChangeLog : fallback.change_log;

  const aliases = [
    source.revised_contract_text,
    source.revisedContractText,
    source.modified_contract_text,
    source.modifiedContractText,
    source.revised_text,
    source.contract_text
  ];
  let revisedText = aliases.find(hasUsefulText) || "";
  const compactOriginal = String(contractText || "").replace(/\s+/g, "");
  const compactRevised = String(revisedText || "").replace(/\s+/g, "");

  if (!hasUsefulText(revisedText) || compactRevised === compactOriginal) {
    if (changeLog.length) {
      revisedText = applyChangeLogToContract(contractText, changeLog).revisedText;
    } else {
      revisedText = fallback.revised_contract_text;
    }
  }

  if (!hasUsefulText(revisedText)) revisedText = fallback.revised_contract_text || contractText;

  return {
    overall_summary: hasUsefulText(source.overall_summary) ? source.overall_summary : fallback.overall_summary,
    key_risks: Array.isArray(source.key_risks) && source.key_risks.length ? source.key_risks : fallback.key_risks,
    change_log: changeLog,
    revised_contract_text: revisedText,
    review_note: hasUsefulText(source.review_note) ? source.review_note : fallback.review_note
  };
}

function geminiSchemaFromReviewSchema() {
  return {
    type: "OBJECT",
    required: REVIEW_SCHEMA.required,
    properties: {
      overall_summary: { type: "STRING" },
      key_risks: { type: "ARRAY", items: { type: "STRING" } },
      change_log: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: ["location", "original", "problem", "revised", "reason"],
          properties: {
            location: { type: "STRING" },
            original: { type: "STRING" },
            problem: { type: "STRING" },
            revised: { type: "STRING" },
            reason: { type: "STRING" }
          }
        }
      },
      revised_contract_text: { type: "STRING" },
      review_note: { type: "STRING" }
    }
  };
}

function geminiText(payload) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

async function reviewWithGemini({ config, contractText, fields, filename, truncated }) {
  const prompt = [
    "你是严谨的中文合同审查助手。你不是律师替代品，但要给出可执行、可谈判的合同修改建议。只输出 JSON。",
    buildReviewPrompt({ contractText, fields, filename, truncated })
  ].join("\n\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: geminiSchemaFromReviewSchema()
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const rawMessage = payload.error?.message || "审查通道返回失败。";
    let message = rawMessage;
    if (response.status === 400 && /API key/i.test(rawMessage)) {
      message = "审查通道验证失败，请稍后再试。";
    } else if (response.status === 403) {
      message = "审查通道暂时没有权限，请稍后再试。";
    } else if (response.status === 429 || /quota|rate/i.test(rawMessage)) {
      message = "审查通道现在有点忙，请稍后再试。";
    }
    throw new Error(message);
  }

  return safeJsonParse(geminiText(payload));
}

async function reviewWithDeepSeek({ config, contractText, fields, filename, truncated }) {
  const prompt = buildReviewPrompt({ contractText, fields, filename, truncated });
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "你是严谨的中文合同审查助手。你不是律师替代品，但要给出可执行、可谈判的合同修改建议。只输出一个合法 JSON 对象，不要输出 markdown。revised_contract_text 必须是完整修改后合同正文，不允许为空。"
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const rawMessage = payload.error?.message || "审查通道返回失败。";
    let message = rawMessage;
    if (response.status === 401 || response.status === 403) {
      message = "审查通道验证失败，请稍后再试。";
    } else if (response.status === 402 || /balance|quota|insufficient|余额|额度/i.test(rawMessage)) {
      message = "审查通道额度暂时不可用，请稍后再试。";
    } else if (response.status === 429 || /rate/i.test(rawMessage)) {
      message = "日本博士后现在被合同埋住了，请稍后再试。";
    }
    throw new Error(message);
  }

  return safeJsonParse(payload.choices?.[0]?.message?.content || "");
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
    await updateSubmission(store, jobId, { status: "processing", stage: "正在读取合同文件。", progress: 22 });

    const file = {
      filename: input.filename,
      mimeType: input.mimeType,
      content: Buffer.from(input.fileBase64, "base64")
    };
    const extracted = await extractContractText(file);
    const { text: contractText, truncated } = trimContractText(extracted);
    if (contractText.length < 30) throw new Error("没有读到足够的合同正文，请换成文字版 docx/pdf/txt。");

    await updateStatus(store, jobId, { stage: "日本博士后正在给你改合同。", progress: 48 });
    await updateSubmission(store, jobId, {
      status: "processing",
      stage: "日本博士后正在给你改合同。",
      progress: 48,
      extractedChars: contractText.length,
      truncated
    });
    const review = normalizeReviewResult(await reviewWithAi({
      contractText,
      fields: input.fields || {},
      filename: input.filename,
      truncated
    }), contractText, input.fields || {});

    await updateStatus(store, jobId, { stage: "日本博士后正在整理修改版和修改说明。", progress: 82 });
    await updateSubmission(store, jobId, { stage: "日本博士后正在整理修改版和修改说明。", progress: 82 });
    const files = await buildReviewFiles(review, input.filename);

    const completedAt = new Date().toISOString();
    const completedStatus = {
      jobId,
      status: "completed",
      stage: "审查完成。",
      progress: 100,
      estimatedSeconds: input.estimatedSeconds,
      summary: review.overall_summary,
      note: review.review_note,
      files,
      completedAt
    };
    await store.setJSON(`${jobId}:status`, completedStatus);
    await updateSubmission(store, jobId, {
      status: "completed",
      stage: "审查完成。",
      progress: 100,
      summary: review.overall_summary,
      note: review.review_note,
      keyRisks: review.key_risks || [],
      changeCount: Array.isArray(review.change_log) ? review.change_log.length : 0,
      completedAt
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
      await updateSubmission(store, jobId, {
        status: "error",
        stage: "审查失败。",
        progress: 100,
        error: error.message || "审查失败，请稍后再试。"
      }).catch(() => undefined);
    }
    return jsonResponse(500, { error: error.message || "审查失败。" });
  }
};
