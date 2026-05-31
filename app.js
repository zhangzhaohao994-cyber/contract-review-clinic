const riskRules = [
  {
    id: "unconditional",
    title: "无条件付款 / 见索即付",
    level: "high",
    weight: 18,
    patterns: [/不可撤销|不可更改|无条件|见索即付|放弃.{0,8}抗辩|永久放弃/g],
    explain: "这类表述会把你从“按条件付款”推到“对方一要就给”的位置。",
    suggestion: "改成：付款以合同生效、服务完成、节点成就、资料齐全并经我方书面确认为前提。保留全部事实和法律抗辩权。"
  },
  {
    id: "blank",
    title: "空白处可被单方补写",
    level: "high",
    weight: 16,
    patterns: [/空白处.{0,12}填写有效|下划线.{0,12}填写有效|自行填写|补写|涂改/g],
    explain: "空白授权像把签字笔交给对方，后面多出来什么很难说清。",
    suggestion: "改成：任何空白、补充、涂改、账户变更和金额变更，须经双方签字盖章确认，否则无效。"
  },
  {
    id: "guarantee",
    title: "个人担保 / 连带责任",
    level: "high",
    weight: 18,
    patterns: [/全体股东|个人连带|连带担保|个人担保|本人所有银行账户|法定代表人.{0,12}承担/g],
    explain: "公司合同里混进个人责任，会把风险从公司账本拖到个人口袋。",
    suggestion: "改成：本协议不构成法定代表人、股东、员工或关联方的个人担保或连带责任。"
  },
  {
    id: "penalty",
    title: "违约金过高",
    level: "high",
    weight: 14,
    patterns: [/每日千分之|千分之三|滞纳金|违约金.{0,16}每日|罚金/g],
    explain: "每日千分之三折成年化很夸张，谈判时应当降下来并设置上限。",
    suggestion: "改成：逾期付款经书面催告后仍未支付的，按每日万分之二计算，且总额不超过未付款的10%。"
  },
  {
    id: "cash",
    title: "现金付款或无凭证收款",
    level: "medium",
    weight: 10,
    patterns: [/现金|无需.{0,8}收据|无需.{0,8}凭证|背面备注|微信截图|转方式支付/g],
    explain: "现金和无凭证容易让付款事实、金额、时间点都变成争议。",
    suggestion: "改成：全部通过银行转账至约定账户，付款前提供发票或合法收款凭证，收款后出具确认书。"
  },
  {
    id: "freeze",
    title: "冻结账户 / 单方保全威胁",
    level: "high",
    weight: 12,
    patterns: [/冻结.{0,8}账户|申请冻结|财产保全|执行费/g],
    explain: "合同不能直接变成随时冻结账户的通行证，这类话术会制造不必要压力。",
    suggestion: "改成：保全和执行以法律规定及生效法律文书为准，双方均保留合法抗辩权。"
  },
  {
    id: "jurisdiction",
    title: "争议管辖不利",
    level: "medium",
    weight: 8,
    patterns: [/项目所在地人民法院|乙方住所地|对方所在地|任意一方所在地/g],
    explain: "打官司的地点会影响成本和主动权，甲方最好争取甲方住所地。",
    suggestion: "改成：争议由甲方住所地有管辖权的人民法院管辖。"
  },
  {
    id: "people",
    title: "“等人”主体不清",
    level: "medium",
    weight: 8,
    patterns: [/等人|团队成员|合作人员|介绍人员/g],
    explain: "合同主体写不清，后面可能冒出更多人来要钱。",
    suggestion: "改成：除本协议列明乙方外，任何第三人不得另行向我方主张费用；相关争议由乙方自行处理。"
  },
  {
    id: "tax",
    title: "税费责任一边倒",
    level: "medium",
    weight: 8,
    patterns: [/税金.{0,18}全权负担|代缴代扣税费3%|税后居间/g],
    explain: "税费要按真实身份和法律适用处理，不宜用固定话术把责任全塞给一方。",
    suggestion: "改成：含税价；依法需开票的由收款方提供发票，依法代扣代缴的按实际税率扣缴并出具凭证。"
  }
];

const missingChecks = [
  {
    id: "invoice-missing",
    title: "缺少发票 / 收款凭证闭环",
    level: "medium",
    weight: 8,
    needed: /发票|收据|收款确认|银行回单|完税/g,
    explain: "没有证据闭环，付款以后很容易陷入“付了但说不清”的尴尬。",
    suggestion: "补充：付款前提供发票或合法收款凭证，付款后出具收款确认书，银行回单作为付款证明。"
  },
  {
    id: "refund-missing",
    title: "缺少解除 / 退还机制",
    level: "medium",
    weight: 9,
    needed: /解除|终止|退还|返还|抵扣/g,
    explain: "如果对方信息不实、项目失败、条件没成就，合同里应当有暂停、解除和返还出口。",
    suggestion: "补充：因对方原因导致合同无法履行或付款条件未成就的，我方有权暂停付款、解除协议、要求返还并抵扣损失。"
  },
  {
    id: "confidentiality-missing",
    title: "缺少保密义务",
    level: "low",
    weight: 5,
    needed: /保密|商业秘密|不得披露/g,
    explain: "报价、成本、客户和项目资料都值得加一把锁。",
    suggestion: "补充：未经书面同意，不得披露或用于本项目以外目的，违约应停止侵害并赔偿损失。"
  }
];

const roleTips = {
  partyA: "你选的是甲方/付款方，我会更关注付款前提、个人责任和验收收款节点。",
  partyB: "你选的是乙方/收款方，我会更关注付款期限、验收标准和对方拖延空间。",
  employee: "你选的是劳动者，我会更关注竞业限制、赔偿、试用期、加班和解除条款。",
  tenant: "你选的是承租方，我会更关注押金、提前退租、维修、涨租和违约金。",
  investor: "你选的是投资方，我会更关注回购、担保、退出、信息披露和控制权。"
};

const sampleText = `授权委托及不可撤销的居间劳务报酬支付承诺书。
甲方承诺以132000元作为居间费给乙方。签定合同当天支付20%，进场施工三天内支付20%，第一次出货当天支付30%，第二次出货当天支付30%。
本承诺书为不可撤销、不可更改、无条件保证兑现的见索即付凭证，可替代合同。
受托人收取该笔居间劳务报酬时无需办理任何收据或凭证。下划线及表格内空白处由居间受托人自行填写有效。
如甲方拖延支付，受托人可申请冻结甲方及本人所有银行账户，并按每日千分之三追加滞纳金。全体股东承担个人连带担保责任。
争议由项目所在地人民法院管辖。`;

const contractText = document.querySelector("#contractText");
const scanButton = document.querySelector("#scanButton");
const demoButton = document.querySelector("#demoButton");
const clearButton = document.querySelector("#clearButton");
const roleSelect = document.querySelector("#roleSelect");
const contractType = document.querySelector("#contractType");
const resultList = document.querySelector("#resultList");
const scoreValue = document.querySelector("#scoreValue");
const scoreRing = document.querySelector("#scoreRing");
const scoreSummary = document.querySelector("#scoreSummary");
const resultTitle = document.querySelector("#result-title");
const clauseSuggestions = document.querySelector("#clauseSuggestions");
const year = document.querySelector("#year");

year.textContent = new Date().getFullYear();

function getMatches(text, rule) {
  const matches = [];
  rule.patterns.forEach((pattern) => {
    const found = text.match(pattern);
    if (found) matches.push(...found);
  });
  return [...new Set(matches)].slice(0, 6);
}

function analyzeContract(text) {
  const findings = [];

  riskRules.forEach((rule) => {
    const matches = getMatches(text, rule);
    if (matches.length) {
      findings.push({
        ...rule,
        matches
      });
    }
  });

  missingChecks.forEach((check) => {
    if (text.length > 80 && !check.needed.test(text)) {
      findings.push({
        ...check,
        matches: ["未发现相关保护条款"]
      });
    }
  });

  if (contractType.value === "brokerage" && !/促成|直接|实质|居间成功|付款条件/g.test(text)) {
    findings.push({
      id: "brokerage-success",
      title: "居间成功标准不清",
      level: "high",
      weight: 13,
      matches: ["未发现居间成功/直接促成标准"],
      explain: "居间协议最怕只写金额，不写什么叫完成服务。",
      suggestion: "补充：乙方须直接、真实、有效促成项目合同成立并实际履行至对应节点，方可请求对应费用。"
    });
  }

  if (roleSelect.value === "partyA" && /签.{0,4}合同.{0,10}支付|合同当天支付|签定合同当天/g.test(text)) {
    findings.push({
      id: "pay-before-benefit",
      title: "甲方先付钱、收益后置",
      level: "high",
      weight: 12,
      matches: ["签约即付款"],
      explain: "甲方还没进场、没出货、没收钱就先付款，主动权会明显下降。",
      suggestion: "改成：以进场确认、节点完成、甲方实际收到对应款项或收益后再支付。"
    });
  }

  return findings;
}

function scoreFromFindings(findings) {
  const raw = findings.reduce((sum, item) => sum + item.weight, 0);
  return Math.max(8, Math.min(98, 100 - raw));
}

function scoreColor(score) {
  if (score >= 82) return "#235f4f";
  if (score >= 62) return "#b88720";
  return "#d85f4f";
}

function renderScore(score, findings) {
  const color = scoreColor(score);
  scoreValue.textContent = score;
  scoreRing.style.background = `radial-gradient(circle at center, #fff 58%, transparent 59%), conic-gradient(${color} 0 ${score}%, var(--line) ${score}% 100%)`;

  if (!findings.length) {
    resultTitle.textContent = "看起来比较清爽";
    scoreSummary.textContent = `${roleTips[roleSelect.value]} 目前没有抓到明显高危词，但仍建议人工复核金额、主体和附件。`;
    return;
  }

  const highCount = findings.filter((item) => item.level === "high").length;
  resultTitle.textContent = highCount ? "发现高风险条款" : "发现可谈风险";
  scoreSummary.textContent = `${roleTips[roleSelect.value]} 这份合同抓到 ${findings.length} 个风险点，其中高风险 ${highCount} 个。先别急着签，先把红灯逐个谈掉。`;
}

function renderFindings(findings) {
  if (!findings.length) {
    resultList.innerHTML = `
      <article class="empty-state">
        <h3>没有抓到明显硬伤</h3>
        <p>这不代表合同完全没风险，只代表常见高危话术暂时没出现。金额、主体、附件和签章仍要人工核对。</p>
      </article>
    `;
    return;
  }

  resultList.innerHTML = findings
    .map((item) => {
      const levelText = item.level === "high" ? "高风险" : item.level === "medium" ? "中风险" : "提醒";
      const matched = item.matches.map((match) => `<code>${escapeHtml(match)}</code>`).join("、");
      return `
        <article class="risk-item">
          <div class="risk-topline">
            <h3>${escapeHtml(item.title)}</h3>
            <span class="risk-level risk-${item.level}">${levelText}</span>
          </div>
          <p>${escapeHtml(item.explain)}</p>
          <p>命中：${matched}</p>
          <div class="risk-suggestion">${escapeHtml(item.suggestion)}</div>
        </article>
      `;
    })
    .join("");
}

function renderClauses(findings) {
  const defaults = [
    "付款条件：对应节点完成、我方实际收到项目收益、对方提交完整服务证明和合法票据后，我方在五个工作日内付款。",
    "授权边界：未经我方加盖公章的书面授权，对方不得以我方名义签署文件、承诺付款、收付款或承担任何责任。",
    "空白及变更：任何空白填写、涂改、补充、账户变更和金额变更，须经双方签字盖章确认，否则无效。"
  ];

  const targeted = findings.slice(0, 4).map((item) => item.suggestion);
  const clauses = [...new Set([...targeted, ...defaults])].slice(0, 6);

  clauseSuggestions.innerHTML = `
    <ul>
      ${clauses.map((clause) => `<li>${escapeHtml(clause)}</li>`).join("")}
    </ul>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function runScan() {
  const text = contractText.value.trim();
  if (!text) {
    resultTitle.textContent = "先粘贴合同";
    scoreValue.textContent = "--";
    scoreSummary.textContent = "没有合同文本，我只能安静地坐着。";
    resultList.innerHTML = `
      <article class="empty-state">
        <h3>还没有可分析内容</h3>
        <p>粘贴合同正文，或者点“载入居间协议示例”试一下。</p>
      </article>
    `;
    clauseSuggestions.innerHTML = "<p>合同进来，建议才会出来。</p>";
    scoreRing.style.background = "radial-gradient(circle at center, #fff 58%, transparent 59%), conic-gradient(var(--line) 0 100%)";
    return;
  }

  const findings = analyzeContract(text);
  const score = scoreFromFindings(findings);
  renderScore(score, findings);
  renderFindings(findings);
  renderClauses(findings);
}

scanButton.addEventListener("click", runScan);

demoButton.addEventListener("click", () => {
  contractText.value = sampleText;
  contractType.value = "brokerage";
  roleSelect.value = "partyA";
  runScan();
});

clearButton.addEventListener("click", () => {
  contractText.value = "";
  contractText.focus();
  runScan();
});

contractText.addEventListener("input", () => {
  if (contractText.value.length > 180) runScan();
});
