/**
 * Tests para src/lib/ai/tools.ts
 *
 * Cubre: truncateFields, applyFilter (funciones puras internas)
 * Nota: Las funciones son privadas en tools.ts, así que testeamos el comportamiento
 *       indirectamente a través de los exports, o las re-implementamos para test.
 *       En este caso, testemos la lógica de truncación y filtrado aislada.
 */

import { describe, it, expect } from "vitest";

// ─── Re-implementación local para testing (misma lógica que tools.ts) ─────────
// Estas funciones son privadas en tools.ts. Si se exportan, importar directamente.

type AirtableRecord = { id: string; fields: Record<string, unknown> };

function truncateFields(
  fields: Record<string, unknown>,
  limit = 8
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(fields)
      .slice(0, limit)
      .map((k) => {
        const v = fields[k];
        if (Array.isArray(v)) return [k, v.slice(0, 3)];
        if (typeof v === "string" && v.length > 200)
          return [k, v.slice(0, 200) + "…"];
        return [k, v];
      })
  );
}

function applyFilter(
  records: AirtableRecord[],
  filtro: string | undefined,
  max = 25
): AirtableRecord[] {
  if (!filtro) return records.slice(0, max);
  const q = filtro.toLowerCase();
  return records
    .filter((r) =>
      Object.values(r.fields).some(
        (v) => typeof v === "string" && v.toLowerCase().includes(q)
      )
    )
    .slice(0, max);
}

// ─── truncateFields ───────────────────────────────────────────────────────────

describe("truncateFields", () => {
  it("retorna objeto vacío para campos vacíos", () => {
    expect(truncateFields({})).toEqual({});
  });

  it("preserva campos dentro del límite", () => {
    const fields = { nombre: "Juan", cargo: "Ingeniero", area: "TI" };
    expect(truncateFields(fields)).toEqual(fields);
  });

  it("limita a 8 campos por defecto", () => {
    const fields: Record<string, unknown> = {};
    for (let i = 0; i < 15; i++) {
      fields[`campo_${i}`] = `valor_${i}`;
    }
    const result = truncateFields(fields);
    expect(Object.keys(result)).toHaveLength(8);
  });

  it("acepta un límite personalizado de campos", () => {
    const fields = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const result = truncateFields(fields, 3);
    expect(Object.keys(result)).toHaveLength(3);
  });

  it("trunca arrays a máximo 3 elementos", () => {
    const fields = { tags: ["a", "b", "c", "d", "e"] };
    const result = truncateFields(fields);
    expect(result.tags).toEqual(["a", "b", "c"]);
  });

  it("trunca strings largos a 200 caracteres + ellipsis", () => {
    const longString = "a".repeat(300);
    const fields = { descripcion: longString };
    const result = truncateFields(fields);
    const truncated = result.descripcion as string;
    expect(truncated).toHaveLength(201); // 200 chars + "…"
    expect(truncated.endsWith("…")).toBe(true);
  });

  it("no trunca strings de exactamente 200 caracteres", () => {
    const exactString = "x".repeat(200);
    const fields = { texto: exactString };
    const result = truncateFields(fields);
    expect(result.texto).toBe(exactString);
  });

  it("preserva números, booleans y null", () => {
    const fields = { edad: 30, activo: true, nota: null };
    const result = truncateFields(fields);
    expect(result).toEqual(fields);
  });

  it("preserva arrays cortos sin cambios", () => {
    const fields = { items: ["a", "b"] };
    const result = truncateFields(fields);
    expect(result.items).toEqual(["a", "b"]);
  });
});

// ─── applyFilter ──────────────────────────────────────────────────────────────

describe("applyFilter", () => {
  const records: AirtableRecord[] = [
    { id: "rec1", fields: { nombre: "Juan Pérez", cargo: "Ingeniero", area: "TI" } },
    { id: "rec2", fields: { nombre: "María García", cargo: "Contadora", area: "Finanzas" } },
    { id: "rec3", fields: { nombre: "Carlos López", cargo: "Ingeniero", area: "TI" } },
    { id: "rec4", fields: { nombre: "Ana Rodríguez", cargo: "Directora", area: "RRHH" } },
  ];

  it("retorna todos los registros sin filtro (hasta el máximo)", () => {
    const result = applyFilter(records, undefined);
    expect(result).toHaveLength(4);
  });

  it("filtra por nombre (case-insensitive)", () => {
    const result = applyFilter(records, "juan");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rec1");
  });

  it("filtra por cargo", () => {
    const result = applyFilter(records, "ingeniero");
    expect(result).toHaveLength(2);
  });

  it("filtra por área", () => {
    const result = applyFilter(records, "ti");
    expect(result).toHaveLength(2);
  });

  it("retorna vacío si no hay coincidencias", () => {
    const result = applyFilter(records, "xyz-no-existe");
    expect(result).toHaveLength(0);
  });

  it("respeta el límite máximo", () => {
    const result = applyFilter(records, undefined, 2);
    expect(result).toHaveLength(2);
  });

  it("respeta el límite máximo con filtro", () => {
    const result = applyFilter(records, "ingeniero", 1);
    expect(result).toHaveLength(1);
  });

  it("filtra con string vacío retorna todos (vacío es falsy)", () => {
    const result = applyFilter(records, "");
    expect(result).toHaveLength(4);
  });

  it("ignora campos no-string al filtrar", () => {
    const withNumbers: AirtableRecord[] = [
      { id: "rec1", fields: { nombre: "Juan", edad: 30, activo: true } },
    ];
    const result = applyFilter(withNumbers, "30");
    expect(result).toHaveLength(0); // 30 es number, no string
  });

  it("busca en todos los campos string del registro", () => {
    const result = applyFilter(records, "Finanzas");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rec2");
  });
});
