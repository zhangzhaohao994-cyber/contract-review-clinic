const { connectLambda, getStore } = require("@netlify/blobs");
const { jsonResponse } = require("./review-utils");

exports.handler = async (event) => {
  const result = {
    hasBlobsPayload: Boolean(event.blobs),
    hasSiteHeader: Boolean(event.headers["x-nf-site-id"]),
    hasDeployHeader: Boolean(event.headers["x-nf-deploy-id"]),
    hasNetlifyEnv: Boolean(process.env.NETLIFY),
    hasSiteIdEnv: Boolean(process.env.SITE_ID || process.env.NETLIFY_SITE_ID),
    connectLambda: "not-run",
    getStore: "not-run",
    write: "not-run",
    read: "not-run"
  };

  try {
    connectLambda(event);
    result.connectLambda = "ok";
    const store = getStore("contract-reviews");
    result.getStore = "ok";
    await store.setJSON("diagnostic", { ok: true, at: new Date().toISOString() });
    result.write = "ok";
    result.read = (await store.get("diagnostic", { type: "json" }))?.ok ? "ok" : "empty";
  } catch (error) {
    result.error = error.message;
  }

  return jsonResponse(200, result);
};
