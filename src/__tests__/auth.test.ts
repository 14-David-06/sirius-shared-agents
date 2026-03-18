/**
 * Tests para src/lib/auth.ts
 *
 * Cubre: hashPassword, verifyPassword, signJWT, verifyJWT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
} from "@/lib/auth";

const TEST_SECRET = "test-jwt-secret-for-vitest-only";

// ─── Password Hashing (bcrypt) ───────────────────────────────────────────────

describe("Password Hashing", () => {
  it("genera un hash diferente al password original", async () => {
    const password = "MiContraseña123!";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
  });

  it("genera hashes diferentes para el mismo password (salt)", async () => {
    const password = "MiContraseña123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });

  it("verifica password correcto contra su hash", async () => {
    const password = "ContraseñaSegura456!";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("rechaza password incorrecto", async () => {
    const hash = await hashPassword("ContraseñaReal");
    const isValid = await verifyPassword("ContraseñaFalsa", hash);
    expect(isValid).toBe(false);
  });

  it("maneja caracteres especiales en password", async () => {
    const password = "¡ÑOÑO@#$%^&*()_+😀";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });
});

// ─── JWT Sign & Verify ───────────────────────────────────────────────────────

describe("JWT", () => {
  const basePayload = {
    sub: "rec123ABC",
    cedula: "1234567890",
    nombre: "Juan Pérez",
    rol: "Super Admin",
  };

  describe("signJWT", () => {
    it("genera un token con 3 partes separadas por punto", () => {
      const token = signJWT(basePayload, TEST_SECRET);
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });

    it("genera tokens diferentes para payloads diferentes", () => {
      const token1 = signJWT(basePayload, TEST_SECRET);
      const token2 = signJWT({ ...basePayload, cedula: "0987654321" }, TEST_SECRET);
      expect(token1).not.toBe(token2);
    });

    it("genera tokens diferentes con secrets diferentes", () => {
      const token1 = signJWT(basePayload, "secret-1");
      const token2 = signJWT(basePayload, "secret-2");
      expect(token1).not.toBe(token2);
    });

    it("no contiene caracteres no URL-safe", () => {
      const token = signJWT(basePayload, TEST_SECRET);
      expect(token).not.toMatch(/[+/=]/);
    });
  });

  describe("verifyJWT", () => {
    it("verifica un token válido y retorna el payload", () => {
      const token = signJWT(basePayload, TEST_SECRET);
      const payload = verifyJWT(token, TEST_SECRET);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe("rec123ABC");
      expect(payload!.cedula).toBe("1234567890");
      expect(payload!.nombre).toBe("Juan Pérez");
      expect(payload!.rol).toBe("Super Admin");
      expect(payload!.iat).toBeTypeOf("number");
      expect(payload!.exp).toBeTypeOf("number");
    });

    it("retorna null con secret incorrecto", () => {
      const token = signJWT(basePayload, TEST_SECRET);
      const payload = verifyJWT(token, "wrong-secret");
      expect(payload).toBeNull();
    });

    it("retorna null con token malformado", () => {
      expect(verifyJWT("not.a.jwt", TEST_SECRET)).toBeNull();
      expect(verifyJWT("", TEST_SECRET)).toBeNull();
      expect(verifyJWT("only-one-part", TEST_SECRET)).toBeNull();
      expect(verifyJWT("two.parts", TEST_SECRET)).toBeNull();
    });

    it("retorna null con token manipulado", () => {
      const token = signJWT(basePayload, TEST_SECRET);
      const parts = token.split(".");
      // Modificar payload
      parts[1] = parts[1] + "X";
      const tampered = parts.join(".");
      expect(verifyJWT(tampered, TEST_SECRET)).toBeNull();
    });

    it("retorna null con token expirado", () => {
      // Token que expira en 1 segundo
      const token = signJWT(basePayload, TEST_SECRET, 1);

      // Verificar que funciona antes de expirar
      const validPayload = verifyJWT(token, TEST_SECRET);
      expect(validPayload).not.toBeNull();

      // Avanzar tiempo para que expire
      vi.useFakeTimers();
      vi.advanceTimersByTime(2000);

      const expiredPayload = verifyJWT(token, TEST_SECRET);
      expect(expiredPayload).toBeNull();

      vi.useRealTimers();
    });

    it("incluye iat y exp correctos", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = signJWT(basePayload, TEST_SECRET, 3600);
      const after = Math.floor(Date.now() / 1000);

      const payload = verifyJWT(token, TEST_SECRET);
      expect(payload).not.toBeNull();
      expect(payload!.iat).toBeGreaterThanOrEqual(before);
      expect(payload!.iat).toBeLessThanOrEqual(after);
      expect(payload!.exp).toBe(payload!.iat + 3600);
    });
  });
});
