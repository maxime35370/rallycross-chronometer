import { RscPayload } from "../rsc-Cmvt9txp.js";

//#region src/extra/browser.d.ts
declare function hydrate(): Promise<void>;
declare function fetchRSC(request: string | URL | Request): Promise<RscPayload["root"]>;
//#endregion
export { fetchRSC, hydrate };