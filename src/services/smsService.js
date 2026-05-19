import axios from "axios";

const DEFAULT_SMS_BASE_URL = "https://smsapi.edumarcsms.com/api/v1/sendsms";
const DEFAULT_OTP_MESSAGE =
  "Dear User, your OTP for login to SHRAMIK JOBING SOLUTIONS is {#var#}. Do not share this OTP with anyone.";
// Change this  value directly in code when needed: "demo" | "dlt"
const SMS_MODE = "dlt";

const getSmsMode = () => {
  const mode = String(SMS_MODE || "demo").toLowerCase().trim();
  return mode === "dlt" ? "dlt" : "demo";
};

const normalizeNumbers = (number) => {
  if (Array.isArray(number)) {
    return number.map((item) => String(item).trim()).filter(Boolean);
  }

  return [String(number).trim()].filter(Boolean);
};

const buildOtpMessage = (template, otp) => {
  const otpValue = String(otp ?? "").trim();

  return String(template || "")
    .replace(/\{\{otp\}\}/g, otpValue)
    .replace(/\$\{otp\}/g, otpValue)
    .replace(/\{\#var\#\}/g, otpValue);
};

/**
 * Send SMS via DLT provider (Edumarc-compatible payload).
 * - demo mode: logs and skips provider call.
 * - dlt mode: calls provider and throws on failure.
 */
export const sendSMS = async ({
  number,
  message,
  senderId = process.env.SENDER_ID || "",
  templateId = process.env.TEMPLATE_ID || "",
}) => {
  if (!number || !message) {
    throw new Error("Number and message are required for SMS");
  }

  const numberList = normalizeNumbers(number);
  if (!numberList.length) {
    throw new Error("At least one valid phone number is required for SMS");
  }

  const mode = getSmsMode();
  if (mode === "demo") {
    console.log(`[SMS DEMO] Skipped provider call for: ${numberList.join(", ")}`);
    return {
      ok: true,
      mode: "demo",
      skipped: true,
    };
  }

   const smsApiKey = process.env.SMS_API_KEY || "";
  const smsBaseUrl = process.env.SMS_BASE_URL || DEFAULT_SMS_BASE_URL;
  const resolvedSenderId = senderId || process.env.SENDER_ID || "";
  const resolvedTemplateId = templateId || process.env.TEMPLATE_ID || "";

  if (!smsApiKey || !resolvedSenderId || !resolvedTemplateId || !smsBaseUrl) {
    throw new Error(
      "SMS DLT config missing. Required: SMS_API_KEY, SENDER_ID, TEMPLATE_ID, SMS_BASE_URL"
    );
  }

  const payload = {
    message,
    senderId: resolvedSenderId,
    number: numberList,
    templateId: resolvedTemplateId,
  };

  try {
    console.log("[SMS DLT] Sending SMS:", {
      to: numberList,
      message,
      senderId: resolvedSenderId,
      templateId: resolvedTemplateId,
      baseUrl: smsBaseUrl,
    });

    const response = await axios.post(smsBaseUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        apikey: smsApiKey,
      },
      timeout: 15000,
    });

    console.log("[SMS DLT] Provider success response:", {
      status: response.status,
      data: response.data,
    });

    const transactionId = response.data?.data?.transactionId;
    const providerMsg = response.data?.data?.msg;
    console.log("[SMS DLT] Submission status:", {
      submitted: !!response.data?.success,
      transactionId: transactionId || null,
      providerMessage: providerMsg || null,
    });

    return {
      ok: true,
      mode: "dlt",
      data: response.data,
    };
  } catch (error) {
    const providerMessage = error.response?.data || error.message;
    console.error("[SMS DLT] Provider error response:", {
      status: error.response?.status || null,
      data: providerMessage,
    });
    throw new Error("Failed to send OTP SMS via DLT provider");
  }
};

/**
 * Build OTP message from template and send SMS.
 * Supports placeholders: {{otp}}, ${otp}, {#var#}
 */
export const sendOtpSMS = async ({ number, otp }) => {
  if (!otp) {
    throw new Error("OTP is required to send OTP SMS");
  }

  const template = "Dear User, your OTP for login to SHRAMIK JOBING SOLUTIONS is {#var#}. Do not share this OTP with anyone.";
  const message = buildOtpMessage(template, otp);
  return sendSMS({ number, message });
};

export const getCurrentSmsMode = () => {
  // Temporary section to allow OTP verification in DLT and also 1234(demo)
  return "demo";
};
