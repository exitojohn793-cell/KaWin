import type { FinishedMatchRecord, Quiz } from '../shared/types.ts';

async function handleJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

export async function fetchVisitorHit(): Promise<{
  count: number;
  formatted: string;
}> {
  const res = await fetch('api/visitors/hit', { method: 'POST' });
  return handleJson(res);
}

export async function fetchVisitors(): Promise<{
  count: number;
  formatted: string;
}> {
  const res = await fetch('api/visitors');
  return handleJson(res);
}

export async function fetchQuizzes(): Promise<Quiz[]> {
  const res = await fetch('api/quizzes');
  return handleJson(res);
}

export async function createQuiz(
  payload: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Quiz> {
  const res = await fetch('api/quizzes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson(res);
}

export async function updateQuiz(
  id: string,
  payload: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Quiz> {
  const res = await fetch(`api/quizzes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson(res);
}

export async function deleteQuiz(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`api/quizzes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleJson(res);
}

export async function fetchMatchHistory(): Promise<FinishedMatchRecord[]> {
  const res = await fetch('api/history');
  return handleJson(res);
}

export async function deleteMatchHistoryRecord(
  id: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`api/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleJson(res);
}

export async function checkRoomExists(pin: string): Promise<boolean> {
  const res = await fetch(`api/rooms/${encodeURIComponent(pin)}`);
  const data = await handleJson<{ exists: boolean }>(res);
  return data.exists;
}

export function getQrSvgUrl(joinUrl: string): string {
  return `api/qr?text=${encodeURIComponent(joinUrl)}`;
}
