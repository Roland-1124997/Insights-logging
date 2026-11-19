import { beforeEach, describe, expect, it, vi } from "vitest";
import { setResponseStatus } from "../setup";

describe("blocker middleware", () => {
	beforeEach(() => {
		vi.resetModules();
		setResponseStatus.mockClear();
	});

	describe("unhappy paths", () => {
		it("should return a forbidden response for blocked requests", async () => {
			// arrange
			const { default: blocker } = await import("../../server/middleware/blocker");

			// act
			const response = blocker({ context: { blocked: true } } as any);

			// assert
			expect(setResponseStatus).toHaveBeenCalledWith(expect.anything(), 403);
			expect(response).toEqual({
				status: { code: 403, success: false, message: "Forbidden" },
			});
		});
	});

	describe("happy paths", () => {
		it("should leave allowed requests untouched", async () => {
			// arrange
			const { default: blocker } = await import("../../server/middleware/blocker");

			// act & assert
			expect(blocker({ context: { blocked: false } } as any)).toBeUndefined();
			expect(setResponseStatus).not.toHaveBeenCalled();
		});
	});
});
