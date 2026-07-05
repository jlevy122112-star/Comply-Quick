export class UIComponentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UIComponentError";
  }
}
