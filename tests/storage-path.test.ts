import { expect, it } from "vitest";
import { knownPathFromUrl, rememberUrlPath } from "../lib/dash-storage";
import { storagePathFromUrl } from "../components/dashboard-v2/storagePath";

it("parses Firebase download URLs", () => {
  expect(storagePathFromUrl("https://firebasestorage.googleapis.com/o/src%2Fprojects-imgs%2Fdemo%2Ficon?alt=media&token=abc"))
    .toBe("src/projects-imgs/demo/icon");
});

it("resolves Convex storage URLs only when their path is known", () => {
  const url = "https://example.convex.cloud/api/storage/kh123abc";
  expect(knownPathFromUrl(url)).toBeNull();
  expect(storagePathFromUrl(url)).toBeNull();

  rememberUrlPath(url, "src/projects-imgs/demo/icon");
  expect(knownPathFromUrl(url + "?v=2")).toBe("src/projects-imgs/demo/icon");
  expect(storagePathFromUrl(url)).toBe("src/projects-imgs/demo/icon");
});
