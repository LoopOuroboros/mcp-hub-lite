export interface ApiResponse<T = unknown> {
  code?: number;
  message?: string;
  data?: T;
  error?: string;
}

export class HttpError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'HttpError';
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  // 只有在有请求体时才设置 Content-Type 头部
  const headers: Record<string, string> = {};
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new HttpError(
        response.status,
        data.error || data.message || `Request failed with status ${response.status}`,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    // Network error or JSON parse error
    throw new HttpError(0, error instanceof Error ? error.message : 'Network error');
  }
}

export const http = {
  get: <T>(url: string, headers?: HeadersInit) => request<T>(url, { method: 'GET', headers }),

  post: <T>(url: string, body: unknown, headers?: HeadersInit) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body), headers }),

  put: <T>(url: string, body: unknown, headers?: HeadersInit) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body), headers }),

  delete: <T>(url: string, headers?: HeadersInit) => request<T>(url, { method: 'DELETE', headers })
};
