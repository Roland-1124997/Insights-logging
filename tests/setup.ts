import { vi } from "vitest";

export const defineNitroPlugin = vi.fn((plugin) => plugin);
export const useRuntimeConfig = vi.fn(() => ({
	logging: {
		limit: 2,
		fail2ban: { window: 60_000, duration: 60_000 },
		include: [] as string[],
		exclude: [] as string[],
	},
	production: true,
}));

export const getRequestIP = vi.fn();
export const getRequestURL = vi.fn();
export const getQuery = vi.fn();

export const createError = vi.fn((error) => error);
export const finish = vi.fn();
export const useCreateRequestLogger = vi.fn(async () => ({ finish }));

export const defineEventHandler = vi.fn((handler) => handler);
export const setResponseStatus = vi.fn();

export const createEvent = (ip = "127.0.0.1") =>
	({
		context: { starttime: 100, requestId: "request-1", requestIp: ip },
		node: { req: { method: "GET" }, res: { statusCode: 200 } },
	}) as any;

vi.mock("h3", () => ({ getRequestURL, getQuery }));
vi.stubGlobal("performance", { now: vi.fn(() => 100) });
vi.stubGlobal("createError", createError);

vi.stubGlobal("useRuntimeConfig", useRuntimeConfig);
vi.stubGlobal("useCreateRequestLogger", useCreateRequestLogger);

vi.stubGlobal("getQuery", getQuery);
vi.stubGlobal("getRequestIP", getRequestIP);
vi.stubGlobal("getRequestURL", getRequestURL);

vi.stubGlobal("setResponseStatus", setResponseStatus);

vi.stubGlobal("defineNitroPlugin", defineNitroPlugin);
vi.stubGlobal("defineEventHandler", defineEventHandler);

