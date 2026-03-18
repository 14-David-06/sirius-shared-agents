/**
 * Tests para src/lib/security.ts
 *
 * Cubre: escapeAirtableValue, checkRateLimit, hasMinRole,
 *        getRoleFromPayload, validateOneDrivePath
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  escapeAirtableValue,
  checkRateLimit,
  hasMinRole,
  getRoleFromPayload,
  validateOneDrivePath,
  type AppRole,
} from "@/lib/security";

// ─── escapeAirtableValue ──────────────────────────────────────────────────────

describe("escapeAirtableValue", () => {
  it("retorna string vacío sin cambios", () => {
    expect(escapeAirtableValue("")).toBe("");
  });

  it("retorna texto plano sin cambios", () => {
    expect(escapeAirtableValue("Juan Pérez")).toBe("Juan Pérez");
  });

  it("escapa comillas simples", () => {
    expect(escapeAirtableValue("O'Brien")).toBe("O\\'Brien");
  });

  it("escapa múltiples comillas simples", () => {
    expect(escapeAirtableValue("it's a 'test'")).toBe("it\\'s a \\'test\\'");
  });

  it("escapa backslashes antes de comillas", () => {
    expect(escapeAirtableValue("path\\file")).toBe("path\\\\file");
  });

  it("escapa backslash seguido de comilla", () => {
    expect(escapeAirtableValue("test\\'end")).toBe("test\\\\\\'end");
  });

  it("elimina caracteres de control (null byte)", () => {
    expect(escapeAirtableValue("test\x00value")).toBe("testvalue");
  });

  it("elimina newlines y tabs", () => {
    expect(escapeAirtableValue("line1\nline2\ttab")).toBe("line1line2tab");
  });

  it("elimina carriage return", () => {
    expect(escapeAirtableValue("hello\r\nworld")).toBe("helloworld");
  });

  it("maneja combinación de control chars y comillas", () => {
    expect(escapeAirtableValue("\x00O'Brien\n")).toBe("O\\'Brien");
  });

  it("preserva caracteres Unicode (español)", () => {
    expect(escapeAirtableValue("María José Ñoño")).toBe("María José Ñoño");
  });

  it("preserva emojis", () => {
    expect(escapeAirtableValue("test 🚀 value")).toBe("test 🚀 value");
  });
});

// ─── checkRateLimit ───────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Usar keys únicos para evitar colisiones entre tests
    vi.useFakeTimers();
  });

  it("permite el primer intento", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(key, 5, 15 * 60 * 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterMs).toBe(0);
  });

  it("permite hasta maxAttempts intentos", () => {
    const key = `test-max-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit(key, 5, 15 * 60 * 1000);
      expect(result.allowed).toBe(true);
    }
    // 5to intento también debería ser permitido
    const fifth = checkRateLimit(key, 5, 15 * 60 * 1000);
    expect(fifth.allowed).toBe(true);
    expect(fifth.remaining).toBe(0);
  });

  it("bloquea después de exceder maxAttempts", () => {
    const key = `test-block-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 15 * 60 * 1000);
    }
    const blocked = checkRateLimit(key, 5, 15 * 60 * 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resetea después de la ventana de tiempo", () => {
    const key = `test-reset-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 1000); // ventana de 1 segundo
    }

    // Avanzar tiempo más allá de la ventana
    vi.advanceTimersByTime(1500);

    const result = checkRateLimit(key, 5, 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("usa defaults para maxAttempts y windowMs", () => {
    const key = `test-defaults-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // default maxAttempts = 5
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

// ─── hasMinRole ───────────────────────────────────────────────────────────────

describe("hasMinRole", () => {
  const roles: AppRole[] = ["Super Admin", "Admin Depto", "Avanzado", "Estándar", "Lectura"];

  it("Super Admin tiene acceso a todo", () => {
    for (const required of roles) {
      expect(hasMinRole("Super Admin", required)).toBe(true);
    }
  });

  it("Lectura solo tiene acceso a Lectura", () => {
    expect(hasMinRole("Lectura", "Lectura")).toBe(true);
    expect(hasMinRole("Lectura", "Estándar")).toBe(false);
    expect(hasMinRole("Lectura", "Avanzado")).toBe(false);
    expect(hasMinRole("Lectura", "Admin Depto")).toBe(false);
    expect(hasMinRole("Lectura", "Super Admin")).toBe(false);
  });

  it("Admin Depto tiene acceso hasta Admin Depto", () => {
    expect(hasMinRole("Admin Depto", "Lectura")).toBe(true);
    expect(hasMinRole("Admin Depto", "Estándar")).toBe(true);
    expect(hasMinRole("Admin Depto", "Avanzado")).toBe(true);
    expect(hasMinRole("Admin Depto", "Admin Depto")).toBe(true);
    expect(hasMinRole("Admin Depto", "Super Admin")).toBe(false);
  });

  it("cada rol tiene acceso a sí mismo", () => {
    for (const role of roles) {
      expect(hasMinRole(role, role)).toBe(true);
    }
  });

  it("la jerarquía es estricta — nivel inferior no accede a nivel superior", () => {
    expect(hasMinRole("Estándar", "Avanzado")).toBe(false);
    expect(hasMinRole("Avanzado", "Admin Depto")).toBe(false);
    expect(hasMinRole("Admin Depto", "Super Admin")).toBe(false);
  });
});

// ─── getRoleFromPayload ───────────────────────────────────────────────────────

describe("getRoleFromPayload", () => {
  it("retorna rol directo cuando es válido", () => {
    expect(getRoleFromPayload({ rol: "Super Admin" })).toBe("Super Admin");
    expect(getRoleFromPayload({ rol: "Admin Depto" })).toBe("Admin Depto");
    expect(getRoleFromPayload({ rol: "Avanzado" })).toBe("Avanzado");
    expect(getRoleFromPayload({ rol: "Estándar" })).toBe("Estándar");
    expect(getRoleFromPayload({ rol: "Lectura" })).toBe("Lectura");
  });

  it("mapea roles legacy del sistema anterior", () => {
    expect(getRoleFromPayload({ rol: "admin" })).toBe("Super Admin");
    expect(getRoleFromPayload({ rol: "rrhh" })).toBe("Admin Depto");
    expect(getRoleFromPayload({ rol: "empleado" })).toBe("Estándar");
  });

  it("retorna Lectura cuando no hay rol", () => {
    expect(getRoleFromPayload({})).toBe("Lectura");
  });

  it("retorna Lectura cuando el rol es undefined", () => {
    expect(getRoleFromPayload({ rol: undefined })).toBe("Lectura");
  });

  it("retorna Lectura para rol desconocido", () => {
    expect(getRoleFromPayload({ rol: "superuser" })).toBe("Lectura");
    expect(getRoleFromPayload({ rol: "root" })).toBe("Lectura");
  });
});

// ─── validateOneDrivePath ─────────────────────────────────────────────────────

describe("validateOneDrivePath", () => {
  it("acepta rutas válidas de Gestion del Ser", () => {
    expect(validateOneDrivePath("Gestion del Ser/01_VLC_VINCULACION_LABORAL/doc.pdf")).toBe(true);
    expect(validateOneDrivePath("Gestion del Ser/02_SPS_SALARIOS_PRESTACIONES/nomina.xlsx")).toBe(true);
    expect(validateOneDrivePath("Gestion del Ser/03_SST_SEGURIDAD_SALUD_TRABAJO/plan.pdf")).toBe(true);
    expect(validateOneDrivePath("Gestion del Ser/04_FYD_FORMACION_DESARROLLO/cert.pdf")).toBe(true);
    expect(validateOneDrivePath("Gestion del Ser/05_RL_RELACIONES_LABORALES/memo.docx")).toBe(true);
    expect(validateOneDrivePath("Gestion del Ser/06_CS_CULTURA_SIRIUS/evento.pptx")).toBe(true);
  });

  it("rechaza path vacío", () => {
    expect(validateOneDrivePath("")).toBe(false);
  });

  it("rechaza path traversal con ..", () => {
    expect(validateOneDrivePath("Gestion del Ser/01_VLC_VINCULACION_LABORAL/../../etc/passwd")).toBe(false);
    expect(validateOneDrivePath("../secreto")).toBe(false);
  });

  it("rechaza path con tilde (~)", () => {
    expect(validateOneDrivePath("~/Documents/hack")).toBe(false);
  });

  it("rechaza path con caracteres de control", () => {
    expect(validateOneDrivePath("Gestion del Ser/01_VLC_VINCULACION_LABORAL/\x00evil")).toBe(false);
  });

  it("rechaza rutas fuera de prefijos permitidos", () => {
    expect(validateOneDrivePath("Documents/personal.pdf")).toBe(false);
    expect(validateOneDrivePath("C:\\Windows\\System32\\config")).toBe(false);
    expect(validateOneDrivePath("/etc/passwd")).toBe(false);
  });

  it("rechaza rutas que empiezan similar pero no exacto", () => {
    expect(validateOneDrivePath("Gestion del Ser/07_OTRO_DIRECTORIO/file.pdf")).toBe(false);
  });
});
