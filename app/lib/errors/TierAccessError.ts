export class TierAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TierAccessError";
  }
}
