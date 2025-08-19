import { ReactFormState } from "react-dom/client";

//#region src/extra/ssr.d.ts
declare function renderHtml(rscStream: ReadableStream<Uint8Array>, options?: {
  formState?: ReactFormState;
  nonce?: string;
  debugNoJs?: boolean;
}): Promise<Response>;
//#endregion
export { renderHtml };