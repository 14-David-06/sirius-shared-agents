# Sirius Shared Agents — Sistema de Desarrollo Multi-Agente

Infraestructura de agentes de desarrollo para **Sirius Gestión del Ser**, construida sobre Claude Code CLI + Pixel Agents.

## Estructura

```
.
├── CLAUDE.md                          # Instrucciones globales (leído por Claude Code)
├── .claude/
│   ├── settings.json                  # Permisos y configuración
│   ├── agents/                        # 5 agentes de desarrollo
│   │   ├── backend-dev.md             # APIs, Airtable CRUD, AI agents, security
│   │   ├── frontend-dev.md            # React 19, Tailwind 4, glass-morphism UI
│   │   ├── qa-tester.md              # Tests Vitest, code review, OWASP
│   │   ├── docs-writer.md            # Documentación técnica en español
│   │   └── devops.md                  # CI/CD, Docker, deployment
│   └── skills/                        # Conocimiento de dominio
│       ├── airtable-patterns.md       # fetchAllRecords, escapeAirtableValue, soft-delete
│       ├── api-conventions.md         # JWT auth, RBAC, SSE streaming, route patterns
│       └── hr-domain.md              # Modelo de datos HR, reglas colombianas
├── src/__tests__/                     # Tests Vitest
│   ├── security.test.ts              # escapeAirtableValue, RBAC, rate limiter
│   ├── auth.test.ts                  # JWT sign/verify, password hashing
│   └── tools.test.ts                # Tool execution, filtering, truncation
├── .github/workflows/ci.yml          # CI: lint → typecheck → test → build
├── Dockerfile                         # Multi-stage (deps → build → runtime)
├── docker-compose.yml                 # Orquestación local
├── vitest.config.ts                   # Configuración Vitest
└── tsconfig.json                      # TypeScript config
```

## Uso

### 1. Setup

```bash
# Instalar Claude Code CLI
irm https://claude.ai/install.ps1 | iex

# Instalar Pixel Agents en VS Code
code --install-extension pablodelucca.pixel-agents
```

### 2. Integrar con el proyecto

Copiar los archivos al root de `sirius-gestion-del-ser`:

```bash
# Copiar estructura de agentes
cp -r CLAUDE.md .claude/ ../sirius-gestion-del-ser/

# Copiar tests y configuración
cp -r vitest.config.ts src/__tests__/ ../sirius-gestion-del-ser/

# Copiar CI/CD y Docker
cp -r .github/ Dockerfile docker-compose.yml .dockerignore ../sirius-gestion-del-ser/
```

Instalar dependencias de testing en el proyecto:

```bash
cd ../sirius-gestion-del-ser
npm install -D vitest @vitejs/plugin-react jsdom
```

### 3. Usar un agente

```bash
cd ../sirius-gestion-del-ser

# Usar el agente backend para crear un endpoint
claude "Usa el backend-dev subagent para crear el endpoint de nómina"

# Usar el agente QA para ejecutar tests
claude "Usa el qa-tester subagent para revisar la seguridad de src/lib/security.ts"

# Usar docs-writer para documentar
claude "Usa el docs-writer subagent para documentar src/lib/ai/agents.ts"
```

### 4. Pixel Agents (visualización)

En VS Code con Pixel Agents instalado:
1. Click **+ Agent** para spawnar una terminal Claude Code
2. Cada agente aparece como un personaje pixel art animado
3. Los personajes muestran estado: escribiendo, leyendo, esperando

## Agentes

| # | Agente | Scope | Model | Propósito |
|---|---|---|---|---|
| 1 | backend-dev | `src/app/api/**`, `src/lib/**` | sonnet | APIs, Airtable, security |
| 2 | frontend-dev | `src/app/dashboard/**`, `src/components/**` | sonnet | React 19, Tailwind 4, UI |
| 3 | qa-tester | Todo el proyecto | sonnet | Tests, code review, OWASP |
| 4 | docs-writer | `docs/**`, README, CHANGELOG | haiku | Documentación en español |
| 5 | devops | `.github/**`, Docker, infra | sonnet | CI/CD, deployment |

## Verificación

- [ ] `claude --version` confirma CLI instalado
- [ ] Panel Pixel Agents visible en VS Code
- [ ] `claude` lee CLAUDE.md correctamente
- [ ] `npx vitest run` pasa sin errores
- [ ] GitHub Actions CI pipeline pasa
- [ ] `npm run build` exitoso
