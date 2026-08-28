import { AppError } from "../../../shared/domain/errors.js";

export function JobNotFoundError(jobId: number): AppError {
    return new AppError(`Job with ID ${jobId} not found`, 404);
}

export function JobNotEditableError(status: string): AppError {
    return new AppError(`Job in status '${status}' cannot be modified`, 409);
}

export function JobValidationError(message: string): AppError {
    return new AppError(message, 400);
}

export function JobNotAvailableError(jobId: number, message?: string): AppError {
    return new AppError(message ?? `Job with ID ${jobId} is not available for application`, 409);
}

export function JobAlreadyAppliedError(jobId: number, engineerId: number): AppError {
    return new AppError(`Engineer with ID ${engineerId} has already applied to job ${jobId}`, 409);
}

export function JobApplicationNotFoundError(applicationId: number): AppError {
    return new AppError(`Job application with ID ${applicationId} not found`, 404);
}

export function JobApplicationInvalidStateError(status: string, message?: string): AppError {
    return new AppError(message ?? `Job application cannot be processed in status '${status}'`, 422);
}

export function InvalidJobApplicationActionError(action?: string): AppError {
    return new AppError(action ? `Invalid application action '${action}'` : "Invalid application action", 400);
}
