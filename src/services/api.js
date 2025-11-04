import AsyncStorage from "@react-native-async-storage/async-storage";
import env from "../config/environment";

const { API_URL } = env ?? {};
const defaultHeaders = {
  "Content-Type": "application/json",
};

export class ApiError extends Error {
  constructor({ status, message, details, cause }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    if (cause) {
      this.cause = cause;
    }
  }
}

const isAbsoluteUrl = (endpoint) => /^https?:\/\//i.test(endpoint);

const resolveUrl = (endpoint) => {
  if (!endpoint) throw new Error("Endpoint is required");
  if (isAbsoluteUrl(endpoint)) return endpoint;
  if (!API_URL) throw new Error("API_URL is not configured");

  if (endpoint.startsWith("/")) return `${API_URL}${endpoint}`;
  return `${API_URL}/${endpoint}`;
};

const serializeBody = (body) => {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
};

const mergeHeaders = async (headers = {}, auth) => {
  const merged = { ...defaultHeaders, ...headers };
  if (auth) {
    const token = await AsyncStorage.getItem("@accessToken");
    if (token) {
      merged.Authorization = `Bearer ${token}`;
    }
  }
  return merged;
};

const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    try {
      return await response.json();
    } catch (error) {
      throw new ApiError({
        status: response.status,
        message: "Não foi possível interpretar a resposta JSON",
        cause: error,
      });
    }
  }

  return response.text();
};

export async function request(endpoint, options = {}) {
  const {
    method = "GET",
    body,
    headers,
    auth = true,
    signal,
  } = options;

  const url = resolveUrl(endpoint);
  const finalHeaders = await mergeHeaders(headers, auth);
  const payload = serializeBody(body);

  try {
    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
      signal,
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      const message =
        (data && (data.message || data.error || data.title)) ||
        `Falha na requisição (${response.status})`;

      throw new ApiError({
        status: response.status,
        message,
        details: data,
      });
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError({
      message: "Não foi possível completar a requisição",
      cause: error,
    });
  }
}

export const api = {
  get: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: "POST", body }),
  put: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: "PUT", body }),
  patch: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: "PATCH", body }),
  delete: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: "DELETE" }),
};
