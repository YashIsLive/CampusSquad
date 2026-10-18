import { describe, expect, it } from "vitest";
import { makeToken, parse } from "@/lib/trusted-device";

const uid = "3f1d2c4b-0000-4000-8000-000000000001";
const other = "3f1d2c4b-0000-4000-8000-000000000002";

describe("trusted device tokens", () => {
  it("accepts a token it signed, until it expires", () => {
    const exp = Date.now() + 60_000;
    const token = makeToken(uid, exp);
    expect(parse(token).map((t) => t.userId)).toEqual([uid]);
    expect(parse(token, exp + 1)).toEqual([]);
  });

  it("rejects forged or edited tokens", () => {
    const exp = Date.now() + 60_000;
    const token = makeToken(uid, exp);
    const [, , sig] = token.split(".");
    // Same signature, someone else's id.
    expect(parse(`${other}.${exp}.${sig}`)).toEqual([]);
    // Same id, extended expiry.
    expect(parse(`${uid}.${exp + 10 ** 9}.${sig}`)).toEqual([]);
    expect(parse(`${uid}.${exp}.not-a-signature`)).toEqual([]);
    expect(parse("garbage")).toEqual([]);
  });

  it("keeps several accounts on one browser", () => {
    const exp = Date.now() + 60_000;
    const raw = [makeToken(uid, exp), makeToken(other, exp)].join("~");
    expect(parse(raw).map((t) => t.userId)).toEqual([uid, other]);
  });
});
