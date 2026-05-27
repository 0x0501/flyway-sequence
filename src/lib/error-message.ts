type ErrorLike = {
	message?: string;
	status?: number;
	statusText?: string;
	error?: {
		message?: string;
		status?: number;
		statusText?: string;
	};
	data?: unknown;
	cause?: unknown;
};

function getMessageFromData(data: unknown): string | null {
	if (!data || typeof data !== "object") {
		return null;
	}

	if ("message" in data && typeof data.message === "string") {
		return data.message;
	}

	if ("error" in data && typeof data.error === "object" && data.error) {
		const nestedError = data.error as { message?: unknown };
		if (typeof nestedError.message === "string") {
			return nestedError.message;
		}
	}

	return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
	if (!error || typeof error !== "object") {
		return fallback;
	}

	const errorLike = error as ErrorLike;

	return (
		getMessageFromData(errorLike.data) ??
		getMessageFromData(errorLike.cause) ??
		errorLike.error?.message ??
		errorLike.message ??
		fallback
	);
}
