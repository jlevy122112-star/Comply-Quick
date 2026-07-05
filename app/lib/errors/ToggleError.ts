export class ToggleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToggleError";
  }
}

