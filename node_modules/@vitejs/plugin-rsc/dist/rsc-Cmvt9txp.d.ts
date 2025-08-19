import { ReactFormState } from "react-dom/client";

//#region src/extra/rsc.d.ts
type RscPayload = {
  root: React.ReactNode;
  formState?: ReactFormState;
  returnValue?: unknown;
};
declare function renderRequest(request: Request, root: React.ReactNode, options?: {
  nonce?: string;
}): Promise<Response>;
//#endregion
export { RscPayload, renderRequest };