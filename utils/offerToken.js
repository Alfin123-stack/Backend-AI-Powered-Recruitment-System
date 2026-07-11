const crypto = require("crypto");

function getSecret() {
  const secret = process.env.OFFER_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "OFFER_TOKEN_SECRET belum di-set di environment variables",
    );
  }
  return secret;
}

function sign(applicationId, expiresAt) {
  const secret = getSecret();
  const payload = JSON.stringify({
    aid: applicationId,
    exp: new Date(expiresAt).getTime(),
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * @param {string} token
 * @param {string} applicationId - id dari route param, dicocokkan ke payload
 * @returns {{ valid: true, payload: { aid: string, exp: number } } | { valid: false, reason: string }}
 */
function verify(token, applicationId) {
  const secret = getSecret();

  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "malformed" };
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return { valid: false, reason: "malformed" };
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { valid: false, reason: "bad_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "bad_payload" };
  }

  if (payload.aid !== applicationId) {
    return { valid: false, reason: "application_mismatch" };
  }

  if (Date.now() > payload.exp) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}

module.exports = { sign, verify };
