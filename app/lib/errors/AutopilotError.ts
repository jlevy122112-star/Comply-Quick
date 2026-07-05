export class AutopilotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutopilotError";
  }
}
