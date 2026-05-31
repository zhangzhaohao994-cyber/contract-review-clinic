    const riskRules = [
      { id: "unconditional", title: "无条件付款 / 见索即付", level: "high", weight: 18, patterns: [/不可撤销|不可更改|无条件|见索即付|放弃.{0,8}抗辩|永久放弃/g], explain: "这类表述会把你从“按条件付款”推到“对方一要就给”的位置。", suggestion: "改成：付款以合同生效、服务完成、节点成就、资料齐全并经我方书面确认为前提。保留全部事实和法律抗辩权。" },
      { id: "blank", title: "空白处可被单方补写", level: "high", weight: 16, patterns: [/空白处.{0,12}填写有效|下划线.{0,12}填写有效|自行填写|补写|涂改/g], explain: "空白授权像把签字笔交给对方，后面多出来什么很难说清。", suggestion: "改成：任何空白、补充、涂改、账户变更和金额变更，须经双方签字盖章确认，否则无效。" },
      { id: "guarantee", title: "个人担保 / 连带责任", level: "high", weight: 18, patterns: [/全体股东|个人连带|连带担保|个人担保|本人所有银行账户|法定代表人.{0,12}承担/g], explain: "公司合同里混进个人责任，会把风险从公司账本拖到个人口袋。", suggestion: "改成：本协议不构成法定代表人、股东、员工或关联方的个人担保或连带责任。" },
      { id: "penalty", title: "违约金过高", level: "high", weight: 14, patterns: [/每日千分之|千分之三|滞纳金|违约金.{0,16}每日|罚金/g], explain: "每日千分之三折成年化很夸张，谈判时应当降下来并设置上限。", suggestion: "改成：逾期付款经书面催告后仍未支付的，按每日万分之二计算，且总额不超过未付款的10%。" },
      { id: "cash", title: "现金付款或无凭证收款", level: "medium", weight: 10, patterns: [/现金|无需.{0,8}收据|无需.{0,8}凭证|背面备注|微信截图|转方式支付/g], explain: "现金和无凭证容易让付款事实、金额、时间点都变成争议。", suggestion: "改成：全部通过银行转账至约定账户，付款前提供发票或合法收款凭证，收款后出具确认书。" },
      { id: "freeze", title: "冻结账户 / 单方保全威胁", level: "high", weight: 12, patterns: [/冻结.{0,8}账户|申请冻结|财产保全|执行费/g], explain: "合同不能直接变成随时冻结账户的通行证，这类话术会制造不必要压力。", suggestion: "改成：保全和执行以法律规定及生效法律文书为准，双方均保留合法抗辩权。" },
      { id: "jurisdiction", title: "争议管辖不利", level: "medium", weight: 8, patterns: [/项目所在地人民法院|乙方住所地|对方所在地|任意一方所在地/g], explain: "打官司的地点会影响成本和主动权，甲方最好争取甲方住所地。", suggestion: "改成：争议由甲方住所地有管辖权的人民法院管辖。" },
      { id: "people", title: "“等人”主体不清", level: "medium", weight: 8, patterns: [/等人|团队成员|合作人员|介绍人员/g], explain: "合同主体写不清，后面可能冒出更多人来要钱。", suggestion: "改成：除本协议列明乙方外，任何第三人不得另行向我方主张费用；相关争议由乙方自行处理。" },
      { id: "tax", title: "税费责任一边倒", level: "medium", weight: 8, patterns: [/税金.{0,18}全权负担|代缴代扣税费3%|税后居间/g], explain: "税费要按真实身份和法律适用处理，不宜用固定话术把责任全塞给一方。", suggestion: "改成：含税价；依法需开票的由收款方提供发票，依法代扣代缴的按实际税率扣缴并出具凭证。" }
    ];

    const missingChecks = [
      { id: "invoice-missing", title: "缺少发票 / 收款凭证闭环", level: "medium", weight: 8, needed: /发票|收据|收款确认|银行回单|完税/g, explain: "没有证据闭环，付款以后很容易陷入“付了但说不清”的尴尬。", suggestion: "补充：付款前提供发票或合法收款凭证，付款后出具收款确认书，银行回单作为付款证明。" },
      { id: "refund-missing", title: "缺少解除 / 退还机制", level: "medium", weight: 9, needed: /解除|终止|退还|返还|抵扣/g, explain: "如果对方信息不实、项目失败、条件没成就，合同里应当有暂停、解除和返还出口。", suggestion: "补充：因对方原因导致合同无法履行或付款条件未成就的，我方有权暂停付款、解除协议、要求返还并抵扣损失。" },
      { id: "confidentiality-missing", title: "缺少保密义务", level: "low", weight: 5, needed: /保密|商业秘密|不得披露/g, explain: "报价、成本、客户和项目资料都值得加一把锁。", suggestion: "补充：未经书面同意，不得披露或用于本项目以外目的，违约应停止侵害并赔偿损失。" }
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

    const intro = document.querySelector("[data-intro]");
    if (intro) {
      document.body.classList.add("has-intro");
      const introTrigger = document.querySelector("[data-intro-trigger]");
      let isEntering = false;
      const enterHome = (event) => {
        if (isEntering) return;
        isEntering = true;
        const source = event && event.currentTarget && event.currentTarget.getBoundingClientRect ? event.currentTarget : introTrigger;
        const rect = source ? source.getBoundingClientRect() : null;
        const tapX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const tapY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        intro.style.setProperty("--tap-x", `${tapX}px`);
        intro.style.setProperty("--tap-y", `${tapY}px`);
        document.body.classList.remove("has-intro");
        document.body.classList.add("is-ready");
        window.scrollTo(0, 0);
        intro.classList.add("is-leaving");
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.setTimeout(() => {
          intro.setAttribute("hidden", "");
        }, prefersReduced ? 60 : 760);
      };
      if (introTrigger) introTrigger.addEventListener("click", enterHome);
    } else {
      document.body.classList.add("is-ready");
    }

    const menuButton = document.querySelector("[data-menu-button]");
    const nav = document.querySelector("[data-nav]");
    if (menuButton && nav) menuButton.addEventListener("click", () => nav.classList.toggle("is-open"));

    const progress = document.querySelector("[data-progress]");
    window.addEventListener("scroll", () => {
      if (!progress) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
    }, { passive: true });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    document.querySelectorAll("[data-filter-row] button").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-filter-row] button").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        const filter = button.dataset.filter;
        document.querySelectorAll("[data-article-grid] .article-card").forEach((card) => {
          card.hidden = filter !== "all" && card.dataset.topic !== filter;
        });
      });
    });

    document.querySelectorAll(".check-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("is-done");
        const total = document.querySelectorAll(".check-toggle").length;
        const done = document.querySelectorAll(".check-toggle.is-done").length;
        const count = document.querySelector("[data-check-count]");
        if (count) count.textContent = `${done} / ${total}`;
      });
    });

    const fileInput = document.querySelector("[data-file-input]");
    const filePicked = document.querySelector("[data-file-picked]");
    if (fileInput && filePicked) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        filePicked.textContent = file ? `已选择：${file.name}` : "还没选文件。支持 docx、pdf、txt、md、rtf。";
        filePicked.classList.toggle("file-picked", Boolean(file));
      });
    }

    const aiReviewForm = document.querySelector("[data-ai-review-form]");
    if (aiReviewForm) {
      const statusPanel = document.querySelector("[data-review-status]");
      const statusTitle = document.querySelector("[data-review-title]");
      const statusEta = document.querySelector("[data-review-eta]");
      const statusMessage = document.querySelector("[data-review-message]");
      const progressBar = document.querySelector("[data-review-progress]");
      const downloads = document.querySelector("[data-review-downloads]");
      const submitButton = aiReviewForm.querySelector('button[type="submit"]');
      let countdownTimer = null;
      let pollTimer = null;
      let openAiReady = true;

      function formatSeconds(seconds) {
        const safe = Math.max(0, Math.ceil(seconds));
        if (safe < 60) return `${safe} 秒`;
        return `${Math.floor(safe / 60)} 分 ${String(safe % 60).padStart(2, "0")} 秒`;
      }

      function setReviewStatus({ title, eta, message, progress }) {
        if (statusPanel) statusPanel.hidden = false;
        if (statusTitle && title) statusTitle.textContent = title;
        if (statusEta && typeof eta === "string") statusEta.textContent = eta;
        if (statusMessage && message) statusMessage.textContent = message;
        if (progressBar && typeof progress === "number") progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
      }

      function blobFromBase64(base64, mimeType) {
        const binary = atob(base64);
        const chunks = [];
        for (let index = 0; index < binary.length; index += 8192) {
          const slice = binary.slice(index, index + 8192);
          const bytes = new Uint8Array(slice.length);
          for (let offset = 0; offset < slice.length; offset += 1) bytes[offset] = slice.charCodeAt(offset);
          chunks.push(bytes);
        }
        return new Blob(chunks, { type: mimeType });
      }

      function renderDownloads(files) {
        if (!downloads) return;
        downloads.innerHTML = "";
        files.forEach((file) => {
          const link = document.createElement("a");
          link.className = "download-pill";
          link.href = URL.createObjectURL(blobFromBase64(file.data, file.mimeType));
          link.download = file.filename;
          link.textContent = `下载${file.filename}`;
          downloads.appendChild(link);
        });
      }

      function clearReviewTimers() {
        if (countdownTimer) window.clearInterval(countdownTimer);
        if (pollTimer) window.clearInterval(pollTimer);
        countdownTimer = null;
        pollTimer = null;
      }

      async function checkOpenAiConfig() {
        try {
          const response = await fetch("/.netlify/functions/openai-config-status");
          const payload = await response.json();
          openAiReady = Boolean(payload.ok);
          if (!openAiReady) {
            setReviewStatus({
              title: "AI 通道未接通",
              eta: "先别传合同",
              message: payload.message || "后台还没有配置 AI 密钥。",
              progress: 100
            });
            if (submitButton) submitButton.disabled = true;
          }
        } catch {
          openAiReady = false;
          setReviewStatus({
            title: "AI 通道自检失败",
            eta: "先别传合同",
            message: "暂时没有连上审查通道，请稍后再试。",
            progress: 100
          });
          if (submitButton) submitButton.disabled = true;
        }
      }

      async function pollReview(jobId) {
        const response = await fetch(`/.netlify/functions/review-status?jobId=${encodeURIComponent(jobId)}`);
        const payload = await response.json();
        if (response.status === 404) {
          setReviewStatus({
            title: "审查中",
            eta: undefined,
            message: "正在同步审查进度，别急，文件还在路上。",
            progress: 18
          });
          return false;
        }
        if (!response.ok) throw new Error(payload.error || "没有查到审查进度。");
        const isError = payload.status === "error";
        setReviewStatus({
          title: payload.status === "completed" ? "审查完成" : isError ? "审查失败" : "审查中",
          eta: isError ? "先别急，问题已经抓到" : undefined,
          message: payload.error || payload.stage || "正在处理。",
          progress: payload.progress || 16
        });
        if (payload.status === "completed") {
          clearReviewTimers();
          if (submitButton) submitButton.disabled = false;
          setReviewStatus({
            title: "审查完成",
            eta: "可以下载文件了",
            message: payload.summary || "修改版和修改说明已经生成。",
            progress: 100
          });
          renderDownloads(payload.files || []);
          return true;
        }
        if (payload.status === "error") {
          clearReviewTimers();
          if (submitButton) submitButton.disabled = false;
          return true;
        }
        return false;
      }

      aiReviewForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!openAiReady) {
          setReviewStatus({
            title: "AI 通道未接通",
            eta: "先别传合同",
            message: "后台 AI 密钥配好后，这里会自动恢复上传。",
            progress: 100
          });
          return;
        }
        clearReviewTimers();
        if (downloads) downloads.innerHTML = "";
        if (submitButton) submitButton.disabled = true;
        setReviewStatus({
          title: "正在上传",
          eta: "预计等待时间计算中",
          message: "文件正在进入审查室。",
          progress: 8
        });
        statusPanel?.scrollIntoView({ behavior: "smooth", block: "nearest" });

        try {
          const response = await fetch("/.netlify/functions/review-contract", {
            method: "POST",
            body: new FormData(aiReviewForm)
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "上传失败。");

          let remaining = payload.estimatedSeconds || 60;
          setReviewStatus({
            title: "审查中",
            eta: `预计还要 ${formatSeconds(remaining)}`,
            message: "AI 正在读合同，先抓付款、担责、违约金和空白补写。",
            progress: 14
          });
          countdownTimer = window.setInterval(() => {
            remaining -= 1;
            if (statusEta) statusEta.textContent = remaining > 0 ? `预计还要 ${formatSeconds(remaining)}` : "马上出结果";
          }, 1000);

          pollTimer = window.setInterval(() => {
            pollReview(payload.jobId).catch((error) => {
              clearReviewTimers();
              if (submitButton) submitButton.disabled = false;
              setReviewStatus({ title: "审查失败", eta: "请稍后再试", message: error.message, progress: 100 });
            });
          }, 3500);
          window.setTimeout(() => pollReview(payload.jobId).catch(() => undefined), 1000);
        } catch (error) {
          clearReviewTimers();
          if (submitButton) submitButton.disabled = false;
          setReviewStatus({
            title: "提交失败",
            eta: "没有开始审查",
            message: error.message || "请稍后再试。",
            progress: 100
          });
        }
      });
      checkOpenAiConfig();
    }

    document.querySelectorAll("[data-copy-text]").forEach((button) => {
      button.addEventListener("click", () => {
        const original = button.textContent;
        const text = button.dataset.copyText || "";
        const fallbackCopy = () => {
          const helper = document.createElement("textarea");
          helper.value = text;
          helper.setAttribute("readonly", "");
          helper.style.position = "fixed";
          helper.style.left = "-999px";
          document.body.appendChild(helper);
          helper.select();
          try {
            document.execCommand("copy");
          } catch {
            // Best-effort copy; the text remains visible in the clause card.
          }
          helper.remove();
        };
        button.textContent = "已复制";
        window.setTimeout(() => {
          button.textContent = original;
        }, 1200);
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).catch(fallbackCopy);
        else fallbackCopy();
      });
    });

    const demoItems = [
      {
        source: "本承诺书不可撤销、不可更改、无条件见索即付。",
        risk: "高风险：你可能失去付款抗辩权。",
        fix: "改成“付款以服务完成、资料齐全、我方书面确认为前提”。"
      },
      {
        source: "表格空白处由乙方自行填写有效。",
        risk: "高风险：金额、账号、日期可能被补写。",
        fix: "改成“任何补充、涂改、账户变更须双方签字盖章确认”。"
      },
      {
        source: "逾期付款按每日千分之三追加滞纳金。",
        risk: "高风险：违约金滚得太快，谈判空间被压缩。",
        fix: "改成“书面催告后按每日万分之二，最高不超过未付款10%”。"
      },
      {
        source: "全体股东承担个人连带担保责任。",
        risk: "高风险：公司合同可能拖到个人口袋。",
        fix: "改成“本协议不构成股东、法定代表人或员工个人担保”。"
      }
    ];
    const demoSource = document.querySelector("[data-demo-source]");
    const demoRisk = document.querySelector("[data-demo-risk]");
    const demoFix = document.querySelector("[data-demo-fix]");
    const demoMeter = document.querySelector("[data-demo-meter]");
    const demoCards = document.querySelectorAll(".demo-flow article");
    const demoPrev = document.querySelector("[data-demo-prev]");
    const demoNext = document.querySelector("[data-demo-next]");
    let demoIndex = 0;
    function renderDemo() {
      if (!demoSource || !demoRisk || !demoFix || !demoMeter) return;
      const item = demoItems[demoIndex % demoItems.length];
      demoSource.textContent = item.source;
      demoRisk.textContent = item.risk;
      demoFix.textContent = item.fix;
      demoCards.forEach((card, index) => card.classList.toggle("is-hot", index === 1));
      demoMeter.style.width = `${((demoIndex % demoItems.length) + 1) / demoItems.length * 100}%`;
    }
    renderDemo();
    demoPrev?.addEventListener("click", () => {
      demoIndex = (demoIndex - 1 + demoItems.length) % demoItems.length;
      renderDemo();
    });
    demoNext?.addEventListener("click", () => {
      demoIndex = (demoIndex + 1) % demoItems.length;
      renderDemo();
    });

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
        if (matches.length) findings.push({ ...rule, matches });
      });
      missingChecks.forEach((check) => {
        if (text.length > 80 && !check.needed.test(text)) findings.push({ ...check, matches: ["未发现相关保护条款"] });
      });
      const type = document.querySelector("#contractType")?.value;
      const role = document.querySelector("#roleSelect")?.value;
      if (type === "brokerage" && !/促成|直接|实质|居间成功|付款条件/g.test(text)) {
        findings.push({ id: "brokerage-success", title: "居间成功标准不清", level: "high", weight: 13, matches: ["未发现居间成功/直接促成标准"], explain: "居间协议最怕只写金额，不写什么叫完成服务。", suggestion: "补充：乙方须直接、真实、有效促成项目合同成立并实际履行至对应节点，方可请求对应费用。" });
      }
      if (role === "partyA" && /签.{0,4}合同.{0,10}支付|合同当天支付|签定合同当天/g.test(text)) {
        findings.push({ id: "pay-before-benefit", title: "甲方先付钱、收益后置", level: "high", weight: 12, matches: ["签约即付款"], explain: "甲方还没进场、没出货、没收钱就先付款，主动权会明显下降。", suggestion: "改成：以进场确认、节点完成、甲方实际收到对应款项或收益后再支付。" });
      }
      return findings;
    }

    function escapeHtml(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    function renderScan() {
      const textEl = document.querySelector("#contractText");
      if (!textEl) return;
      const text = textEl.value.trim();
      const resultTitle = document.querySelector("#result-title");
      const scoreValue = document.querySelector("#scoreValue");
      const scoreRing = document.querySelector("#scoreRing");
      const scoreSummary = document.querySelector("#scoreSummary");
      const resultList = document.querySelector("#resultList");
      const clauseSuggestions = document.querySelector("#clauseSuggestions");
      if (!text) {
        if (resultTitle) resultTitle.textContent = "先粘贴合同";
        if (scoreValue) scoreValue.textContent = "--";
        if (scoreSummary) scoreSummary.textContent = "没有合同文本，我只能安静地坐着。";
        if (resultList) resultList.innerHTML = `<article class="empty-state"><h3>还没有可分析内容</h3><p>粘贴合同正文，或者点“载入居间协议示例”试一下。</p></article>`;
        if (clauseSuggestions) clauseSuggestions.innerHTML = "<p>合同进来，建议才会出来。</p>";
        if (scoreRing) scoreRing.style.background = "radial-gradient(circle at center, #fff 58%, transparent 59%), conic-gradient(var(--line) 0 100%)";
        return;
      }
      const findings = analyzeContract(text);
      const raw = findings.reduce((sum, item) => sum + item.weight, 0);
      const score = Math.max(8, Math.min(98, 100 - raw));
      const color = score >= 82 ? "#235f4f" : score >= 62 ? "#b88720" : "#d85f4f";
      const highCount = findings.filter((item) => item.level === "high").length;
      if (scoreValue) scoreValue.textContent = score;
      if (scoreRing) scoreRing.style.background = `radial-gradient(circle at center, #fff 58%, transparent 59%), conic-gradient(${color} 0 ${score}%, var(--line) ${score}% 100%)`;
      if (resultTitle) resultTitle.textContent = findings.length ? (highCount ? "发现高风险条款" : "发现可谈风险") : "看起来比较清爽";
      const role = document.querySelector("#roleSelect")?.value || "partyA";
      if (scoreSummary) scoreSummary.textContent = findings.length ? `${roleTips[role]} 抓到 ${findings.length} 个风险点，其中高风险 ${highCount} 个。先别急着签，先把红灯逐个谈掉。` : `${roleTips[role]} 目前没有抓到明显高危词，但仍建议人工复核金额、主体和附件。`;
      if (resultList) {
        resultList.innerHTML = findings.length ? findings.map((item) => {
          const levelText = item.level === "high" ? "高风险" : item.level === "medium" ? "中风险" : "提醒";
          const matched = item.matches.map((match) => `<code>${escapeHtml(match)}</code>`).join("、");
          return `<article class="risk-item"><div class="risk-topline"><h3>${escapeHtml(item.title)}</h3><span class="risk-level risk-${item.level}">${levelText}</span></div><p>${escapeHtml(item.explain)}</p><p>命中：${matched}</p><div class="risk-suggestion">${escapeHtml(item.suggestion)}</div></article>`;
        }).join("") : `<article class="empty-state"><h3>没有抓到明显硬伤</h3><p>这不代表合同完全没风险，只代表常见高危话术暂时没出现。</p></article>`;
      }
      if (clauseSuggestions) {
        const defaults = [
          "付款条件：对应节点完成、我方实际收到项目收益、对方提交完整服务证明和合法票据后，我方在五个工作日内付款。",
          "授权边界：未经我方加盖公章的书面授权，对方不得以我方名义签署文件、承诺付款、收付款或承担任何责任。",
          "空白及变更：任何空白填写、涂改、补充、账户变更和金额变更，须经双方签字盖章确认，否则无效。"
        ];
        const clauses = [...new Set([...findings.slice(0, 4).map((item) => item.suggestion), ...defaults])].slice(0, 6);
        clauseSuggestions.innerHTML = `<ul>${clauses.map((clause) => `<li>${escapeHtml(clause)}</li>`).join("")}</ul>`;
      }
    }

    document.querySelector("#scanButton")?.addEventListener("click", renderScan);
    document.querySelector("#demoButton")?.addEventListener("click", () => {
      const textEl = document.querySelector("#contractText");
      const typeEl = document.querySelector("#contractType");
      const roleEl = document.querySelector("#roleSelect");
      if (textEl) textEl.value = sampleText;
      if (typeEl) typeEl.value = "brokerage";
      if (roleEl) roleEl.value = "partyA";
      renderScan();
    });
    document.querySelector("#clearButton")?.addEventListener("click", () => {
      const textEl = document.querySelector("#contractText");
      if (textEl) textEl.value = "";
      renderScan();
      textEl?.focus();
    });
    document.querySelector("#contractText")?.addEventListener("input", (event) => {
      if (event.target.value.length > 180) renderScan();
    });
