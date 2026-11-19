import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestIP, getRequestURL, finish, useCreateRequestLogger, createEvent } from "../setup";
import { FetchError } from "ofetch";

const hooks = new Map<string, (...args: any[]) => any>();
vi.mock("../../server/utils/logger/index", () => ({ useCreateRequestLogger }));

describe("catch plugin", () => {
	beforeEach(async () => {
		vi.resetModules();
		hooks.clear();

		finish.mockClear();
		getRequestIP.mockReturnValue("127.0.0.1");
		getRequestURL.mockReturnValue({ pathname: "/api/users" });

		const { default: plugin } = await import("../../server/plugins/catch");
		plugin({ hooks: { hook: (name: string, handler: (...args: any[]) => any) => hooks.set(name, handler) } } as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("happy paths", () => {
		describe("request initialization", () => {
			it("should initialize request timing, id and client IP", () => {
				// arrange
				const event = createEvent();

				// act
				hooks.get("request")!(event);

				// assert
				expect(event.context.starttime).toBeTypeOf("number");
				expect(event.context.requestId).toEqual(expect.any(String));
				expect(event.context.requestIp).toBe("127.0.0.1");
				expect(event.context.blocked).toBe(false);
			});

			it("should mark a previously banned IP as blocked", async () => {
				
				// arrange
				const firstEvent = createEvent();
				const secondEvent = createEvent();
				const thirdEvent = createEvent();

				// act
				await hooks.get("error")!({ statusCode: 404 }, { event: firstEvent });
				await hooks.get("error")!({ statusCode: 404 }, { event: secondEvent });
				hooks.get("request")!(thirdEvent);

				// assert
				expect(thirdEvent.context.blocked).toBe(true);
			});

			it("should allow an IP after its ban expires", async () => {
				
				// arrange
				const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
				const firstEvent = createEvent();
				const secondEvent = createEvent();
				const thirdEvent = createEvent();

				// act
				await hooks.get("error")!({ statusCode: 404 }, { event: firstEvent });
				await hooks.get("error")!({ statusCode: 404 }, { event: secondEvent });

				now.mockReturnValue(61_000);
				hooks.get("request")!(thirdEvent);

				// assert
				expect(thirdEvent.context.blocked).toBe(false);
			});
		});

		describe("response handling", () => {
			it("should log successful responses", async () => {
				// arrange
				const event = createEvent();

				// act
				await hooks.get("beforeResponse")!(event, { body: { ok: true } });

				// assert
				expect(useCreateRequestLogger).toHaveBeenCalledWith(event);
				expect(finish).toHaveBeenCalledOnce();
			});

			it("should not block an IP after a single tracked failure", async () => {
				// arrange
				const event = createEvent();

				// act
				await hooks.get("error")!({ statusCode: 404 }, { event });

				// assert
				expect(event.context.failTracked).toBe(true);
				expect(event.context.blocked).toBeUndefined();
			});

			it("should finish logging when an error has no status code", async () => {
				// arrange
				const event = createEvent();
				event.node.res.statusCode = 500;

				// act
				await hooks.get("error")!({}, { event });

				// assert
				expect(finish).toHaveBeenCalledOnce();
			});
		});
	});

	describe("unhappy paths", () => {
		it("should stop request initialization when no client IP is available", () => {
			
			// arrange
			getRequestIP.mockReturnValue(undefined);
			const event = { context: {}, node: {} } as any;

			// act
			hooks.get("request")!(event);

			// assert
			expect(event.context.starttime).toBeTypeOf("number");
			expect(event.context.requestIp).toBeUndefined();
			expect(event.context.blocked).toBeUndefined();
		});

		describe("error handling", () => {
			it("should ignore errors without an event", async () => {
				
				// arrange & act
				await hooks.get("error")!({ statusCode: 500 }, {});

				// assert
				expect(finish).not.toHaveBeenCalled();
			});

			it("should log errors without tracking when no client IP is available", async () => {
				
				// arrange
				const event = createEvent();
				event.context.requestIp = undefined;

				// act
				await hooks.get("error")!({ statusCode: 404 }, { event });

				// assert
				expect(event.context.failTracked).toBe(true);
				expect(finish).toHaveBeenCalledOnce();
				expect(getRequestURL).not.toHaveBeenCalled();
			});

			it("should log 404 errors", async () => {
				const event = createEvent();

				await hooks.get("error")!({ statusCode: 404 }, { event });

				expect(event.context.failTracked).toBe(true);
				expect(finish).toHaveBeenCalledOnce();
			});

			it("should log 500 errors", async () => {
				
				// arrange
				const event = createEvent();

				// act
				await hooks.get("error")!({ statusCode: 500 }, { event });

				// assert
				expect(event.context.failTracked).toBe(true);
				expect(finish).toHaveBeenCalledOnce();
			});

			it("should track failures on auth endpoints", async () => {
				// arrange
				getRequestURL.mockReturnValue({ pathname: "/api/auth" });
				const firstEvent = createEvent();
				const secondEvent = createEvent();
				const thirdEvent = createEvent();

				// act
				await hooks.get("error")!({ statusCode: 401 }, { event: firstEvent });

				getRequestURL.mockReturnValue({ pathname: "/api/auth/login" });
				await hooks.get("error")!({ statusCode: 403 }, { event: secondEvent });

				hooks.get("request")!(thirdEvent);

				// assert
				expect(thirdEvent.context.blocked).toBe(true);
			});

			it("should not track client failures outside auth endpoints", async () => {
				// arrange
				getRequestURL.mockReturnValue({ pathname: "/api/users" });
				const event = createEvent();
				
				// act
				await hooks.get("error")!({ statusCode: 401 }, { event });

				// assert
				expect(event.context.blocked).toBeUndefined();
			});

			describe("request blocking", () => {
				it("should block an IP after repeated tracked failures", async () => {
					// arrange
					const event = createEvent();
					const secondEvent = createEvent();

					// act
					await hooks.get("error")!({ statusCode: 404 }, { event });
					await hooks.get("error")!({ statusCode: 404 }, { event: secondEvent });

					// assert
					expect(event.context.failTracked).toBe(true);
					expect(event.context.blocked).toBeUndefined();
					expect(secondEvent.context.failTracked).toBe(true);
					expect(secondEvent.context.blocked).toBe(true);
				});
			});
		});

		describe("response handling", () => {
			it("should preserve the response status message", async () => {
				// arrange
				const event = createEvent();
				const response = { body: { status: { message: "Bad request" }, message: "Fallback" } };
				event.node.res.statusCode = 400;

				// act & assert
				await expect(
					hooks.get("beforeResponse")!(event, response),
				).rejects.toEqual({
					statusCode: 400,
					statusMessage: "Bad request",
				});
			});

			it("should use the response message when no status message exists", async () => {
				// arrange
				const event = createEvent();
				const response = { body: { message: "Bad request" } };
				event.node.res.statusCode = 400;

				// act & assert
				await expect(hooks.get("beforeResponse")!(event, response)).rejects.toEqual({
					statusCode: 400,
					statusMessage: "Bad request",
				});
			});

			it("should use fallback status messages for failed responses", async () => {
				// arrange
				const event = createEvent();
				event.node.res.statusCode = 500;

				// act & assert
				await expect(hooks.get("beforeResponse")!(event, { body: {} })).rejects.toEqual({
					statusCode: 500,
					statusMessage: "Internal Server Error",
				});
			});

			it("should skip logging FetchError responses", async () => {
				
				// arrange
				const event = createEvent();
				const response = new FetchError("fetch failed");

				// act
				await hooks.get("beforeResponse")!(event, { body: response });

				// assert
				expect(finish).not.toHaveBeenCalled();
			});

			it("should ignore missing events", async () => {
				// act & assert
				await expect(hooks.get("beforeResponse")!(undefined, { body: undefined })).resolves.toBeUndefined();
			});

			it("should not track an error twice", async () => {
				// arrange
				const event = createEvent();
				event.context.failTracked = true;

				// act
				await hooks.get("error")!({ statusCode: 404 }, { event });

				// assert
				expect(event.context.failTracked).toBe(true);
				expect(getRequestURL).not.toHaveBeenCalled();
			});
		});
	});
});
