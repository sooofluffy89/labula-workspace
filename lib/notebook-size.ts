export const MAX_NOTEBOOK_PAYLOAD_BYTES = 750_000;
// Transport envelopes can contain a command ID as well as the notebook itself.
export const MAX_NOTEBOOK_REQUEST_BYTES = 800_000;
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
export class NotebookCapacityError extends Error {}
export function serializeNotebook(value: unknown): string {
  const payload = JSON.stringify(value);
  if (utf8Bytes(payload) > MAX_NOTEBOOK_PAYLOAD_BYTES) {
    throw new NotebookCapacityError('The shared kitchen list has reached its storage limit (750 KB). Your draft is kept. Ask the owner to reduce unused alternative names before trying again.');
  }
  return payload;
}
