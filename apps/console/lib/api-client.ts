export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

const REFRESH_PATH = '/v1/auth/refresh';
const PATHS_WITHOUT_RETRY = new Set([
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/auth/logout',
  REFRESH_PATH,
]);

type ValidationErrorBody = {
  message: string;
  errors?: { field: string; message: string }[];
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const toFieldErrors = (body: ValidationErrorBody): Record<string, string> =>
  Object.fromEntries(
    (body.errors ?? []).map((issue) => [issue.field, issue.message]),
  );

const parseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.length === 0) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

/**
 * Chỉ khai `content-type: application/json` khi thật sự có body JSON.
 *
 * FormData tự đặt content-type kèm boundary, ghi đè là hỏng phần tách file. Còn
 * request không body (GET, DELETE) mà khai JSON thì Fastify từ chối thẳng với
 * "Body cannot be empty when content-type is set to 'application/json'".
 */
const sendRequest = (path: string, init: RequestInit): Promise<Response> => {
  const hasJsonBody =
    init.body !== undefined &&
    init.body !== null &&
    !(init.body instanceof FormData);

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: hasJsonBody
      ? { 'content-type': 'application/json', ...init.headers }
      : { ...init.headers },
  });
};

let pendingRefresh: Promise<boolean> | null = null;

export const refreshSession = (): Promise<boolean> => {
  pendingRefresh ??= sendRequest(REFRESH_PATH, { method: 'POST' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
};

export const apiRequest = async <TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> => {
  let response = await sendRequest(path, init);

  if (response.status === 401 && !PATHS_WITHOUT_RETRY.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed) response = await sendRequest(path, init);
  }

  const body = await parseBody(response);

  if (!response.ok) {
    const errorBody = (body ?? {}) as ValidationErrorBody;
    throw new ApiError(
      response.status,
      errorBody.message ?? 'Đã có lỗi xảy ra',
      toFieldErrors(errorBody),
    );
  }

  return body as TResponse;
};

export const postJson = <TResponse>(
  path: string,
  payload: unknown,
): Promise<TResponse> =>
  apiRequest<TResponse>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const patchJson = <TResponse>(
  path: string,
  payload: unknown,
): Promise<TResponse> =>
  apiRequest<TResponse>(path, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteRequest = <TResponse>(path: string): Promise<TResponse> =>
  apiRequest<TResponse>(path, { method: 'DELETE' });

export const postForm = <TResponse>(
  path: string,
  form: FormData,
): Promise<TResponse> =>
  apiRequest<TResponse>(path, { method: 'POST', body: form });
