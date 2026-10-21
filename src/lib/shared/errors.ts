export class InvalidOptionError extends Error {
  override readonly name = "InvalidOptionError"
  readonly option: string
  readonly value: unknown

  constructor(option: string, value: unknown, expected: string) {
    super(`Expected ${option} to be ${expected}, received ${String(value)}`)
    this.option = option
    this.value = value
  }
}

export class StoreError extends Error {
  override readonly name = "StoreError"

  constructor(cause: unknown) {
    super("The rate limit store failed", { cause })
  }
}

export class StoreTimeoutError extends Error {
  override readonly name = "StoreTimeoutError"
  readonly timeout: number

  constructor(timeout: number) {
    super(`The rate limit store did not answer within ${timeout} ms`)
    this.timeout = timeout
  }
}

export class InvalidReplyError extends Error {
  override readonly name = "InvalidReplyError"
  readonly reply: unknown

  constructor(reply: unknown) {
    super("The store returned an unexpected reply to a rate limit script")
    this.reply = reply
  }
}
