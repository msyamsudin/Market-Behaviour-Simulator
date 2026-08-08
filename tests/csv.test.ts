import { describe, expect, it } from "vitest";
import { parseCSVTicks } from "../src/utils/csv";

const sample = `time,price,volume
1000,101.25,5
1001,101.30,2
1002,101.10,7
`;

describe("parseCSVTicks", () => {
  it("mengabaikan header dan mem-parse baris data", () => {
    expect(parseCSVTicks(sample)).toEqual([
      { time: 1000, price: 101.25, volume: 5 },
      { time: 1001, price: 101.3, volume: 2 },
      { time: 1002, price: 101.1, volume: 7 },
    ]);
  });

  it("melewati baris kosong dan malformed", () => {
    const text = "time,price,volume\n1,2,3\n\nnot-a-tick\n4,5\n6,7,8\n";
    expect(parseCSVTicks(text)).toEqual([
      { time: 1, price: 2, volume: 3 },
      { time: 6, price: 7, volume: 8 },
    ]);
  });

  it("mengembalikan array kosong untuk input kosong", () => {
    expect(parseCSVTicks("")).toEqual([]);
  });
});
