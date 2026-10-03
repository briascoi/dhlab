import { expect, test } from "vitest";
import worker from "../worker/index";

const env = { ASSETS: { fetch: async () => new Response("app") } } as never;
const pedir = (ruta: string) => worker.fetch(new Request(`https://dhlab.app${ruta}`) as never, env);

test("la API responde en /v1/ y lo demás va a los assets", async () => {
  expect(await (await pedir("/v1/estado")).json()).toEqual({ ok: true });
  expect((await pedir("/v1/otra")).status).toBe(404);
  expect(await (await pedir("/")).text()).toBe("app");
});
