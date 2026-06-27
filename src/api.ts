import type { Ad, JobResponse, UpdateAdInput } from "../shared/types.ts";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data);
  }
  return data as T;
}

export function createJob(
  url: string,
  count: number,
  language: string,
): Promise<JobResponse> {
  return request<JobResponse>("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ url, count, language }),
  });
}

export function updateAd(input: UpdateAdInput): Promise<{ ad: Ad }> {
  return request<{ ad: Ad }>("/api/ads/update", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function regenerateAd(id: string, version: number): Promise<JobResponse> {
  return request<JobResponse>("/api/ads/regenerate", {
    method: "POST",
    body: JSON.stringify({ id, version }),
  });
}
