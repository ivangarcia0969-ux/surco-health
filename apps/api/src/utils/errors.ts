export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number = 400,
    public details?: unknown,
  ) {
    super(code);
    this.name = 'AppError';
  }
}
