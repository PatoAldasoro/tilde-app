import { describe, expect, it } from "vitest";
import { documentKind, parseDriveLink } from "./documents";

describe("parseDriveLink", () => {
  it("acepta links de Google Docs y detecta el tipo y el id", () => {
    expect(parseDriveLink("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit")).toEqual({
      url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit",
      driveFileId: "1AbCdEfGhIjKlMnOp",
      kind: "doc",
    });
    expect(parseDriveLink("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit#gid=0")?.kind).toBe("sheet");
    expect(parseDriveLink("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit")?.kind).toBe("slides");
  });

  it("acepta links de Drive: archivos, carpetas y el formato ?id=", () => {
    expect(parseDriveLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing")).toMatchObject({
      driveFileId: "1AbCdEfGhIjKlMnOp",
      kind: "file",
    });
    expect(parseDriveLink("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp")).toMatchObject({
      driveFileId: "1AbCdEfGhIjKlMnOp",
      kind: "folder",
    });
    expect(parseDriveLink("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp")?.driveFileId).toBe("1AbCdEfGhIjKlMnOp");
  });

  it("tolera espacios alrededor", () => {
    expect(parseDriveLink("  https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit  ")).not.toBeNull();
  });

  it("rechaza otros dominios, http y texto que no es un link", () => {
    for (const bad of [
      "https://example.com/doc",
      "http://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit",
      "https://docs.google.com.evil.com/document/d/1AbCdEfGhIjKlMnOp",
      "https://evil.com/?u=https://docs.google.com/document/d/x",
      "docs.google.com/document/d/1AbCdEfGhIjKlMnOp",
      "javascript:alert(1)",
      "",
    ]) {
      expect(parseDriveLink(bad), bad).toBeNull();
    }
  });
});

describe("documentKind", () => {
  it("prioriza el tipo MIME que entrega el Picker", () => {
    const url = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view";
    expect(documentKind({ url, mime_type: "application/pdf" })).toBe("pdf");
    expect(documentKind({ url, mime_type: "image/png" })).toBe("image");
    expect(documentKind({ url, mime_type: "application/vnd.google-apps.spreadsheet" })).toBe("sheet");
    expect(documentKind({ url, mime_type: "application/zip" })).toBe("file");
  });

  it("sin MIME usa la URL", () => {
    expect(documentKind({ url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit", mime_type: null })).toBe("doc");
    expect(documentKind({ url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", mime_type: null })).toBe("file");
  });
});
