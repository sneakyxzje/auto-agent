const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

/** Lỗi 400 từ pipe zod ở server trả về danh sách trường sai. */
type ValidationErrorBody = {
  message: string;
  errors?: { field: string; message: string }[];
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Ánh xạ tên trường → thông báo, để form tô đỏ đúng ô. */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const toFieldErrors = (body: ValidationErrorBody): Record<string, string> =>
  Object.fromEntries((body.errors ?? []).map((issue) => [issue.field, issue.message]));

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
 * `credentials: 'include'` là điểm bắt buộc: token nằm trong cookie httpOnly, không
 * có dòng này thì trình duyệt không gửi kèm và mọi request đều bị coi là chưa đăng nhập.
 */
export const apiRequest = async <TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  });

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

export const postJson = <TResponse>(path: string, payload: unknown): Promise<TResponse> =>
  apiRequest<TResponse>(path, { method: 'POST', body: JSON.stringify(payload) });
