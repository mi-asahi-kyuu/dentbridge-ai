/**
 * Only transport/service availability failures should affect the connection
 * badge. A 4xx response such as "no usable speech" or "unsafe model output"
 * means the server was reached successfully and the current turn should be
 * rejected without reconnecting the microphone.
 */
export function shouldRetryHttpStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}
