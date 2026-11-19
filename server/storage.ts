import fs from 'node:fs';
import path from 'node:path';
import { VISITOR_BASE_COUNT, formatVisitorCount } from '../src/shared/scoring.ts';
import type { FinishedMatchRecord, Quiz } from '../src/shared/types.ts';

interface StoreData {
  visitorCount: number;
  quizzes: Quiz[];
  matchHistory: FinishedMatchRecord[];
}

const SEED_QUIZZES: Quiz[] = [
  {
    id: 'seed-cultura-general',
    title: 'Cultura General & Ciencia Express',
    description:
      'Desafío ágil de ciencia, historia y geografía ideal para clases, dinámicas grupales o torneos en vivo.',
    category: 'Educación',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    questions: [
      {
        id: 'cg-1',
        prompt: '¿Qué planeta del sistema solar tiene el día más corto (rotación más rápida)?',
        options: ['Marte', 'Júpiter', 'Saturno', 'Mercurio'],
        correctIndex: 1,
        timeLimitSec: 20,
        pointsMode: 'standard',
      },
      {
        id: 'cg-2',
        prompt: '¿Qué gas compone aproximadamente el 78% de la atmósfera terrestre?',
        options: ['Oxígeno', 'Dióxido de carbono', 'Nitrógeno', 'Argón'],
        correctIndex: 2,
        timeLimitSec: 20,
        pointsMode: 'standard',
      },
      {
        id: 'cg-3',
        prompt: '¿En qué ciudad se encuentra el famoso Museo del Prado?',
        options: ['Barcelona', 'Madrid', 'Sevilla', 'Valencia'],
        correctIndex: 1,
        timeLimitSec: 15,
        pointsMode: 'standard',
      },
      {
        id: 'cg-4',
        prompt: '¡Ronda Doble! ¿Cuál es la velocidad aproximada de la luz en el vacío?',
        options: ['30.000 km/s', '150.000 km/s', '300.000 km/s', '1.000.000 km/s'],
        correctIndex: 2,
        timeLimitSec: 20,
        pointsMode: 'double',
      },
    ],
  },
  {
    id: 'seed-empresa-liderazgo',
    title: 'Innovación, Negocios & Productividad',
    description:
      'Dinámica corporativa para equipos, onboarding, reuniones all-hands y talleres de estrategia.',
    category: 'Empresas',
    createdAt: '2026-01-16T10:00:00.000Z',
    updatedAt: '2026-01-16T10:00:00.000Z',
    questions: [
      {
        id: 'emp-1',
        prompt: 'En metodologías ágiles, ¿qué mide principalmente el concepto de "Lead Time"?',
        options: [
          'Las horas de reunión semanal',
          'El tiempo desde que se solicita una tarea hasta su entrega',
          'El presupuesto total de marketing',
          'La cantidad de líneas de código',
        ],
        correctIndex: 1,
        timeLimitSec: 25,
        pointsMode: 'standard',
      },
      {
        id: 'emp-2',
        prompt: '¿Qué significa la sigla KPI en gestión empresarial?',
        options: [
          'Key Performance Indicator',
          'Knowledge Process Integration',
          'Key Product Investment',
          'Kinetic Project Index',
        ],
        correctIndex: 0,
        timeLimitSec: 20,
        pointsMode: 'standard',
      },
      {
        id: 'emp-3',
        prompt: '¿Cuál de estas métricas evalúa la lealtad y probabilidad de recomendación del cliente?',
        options: ['CAC', 'MRR', 'NPS (Net Promoter Score)', 'EBITDA'],
        correctIndex: 2,
        timeLimitSec: 20,
        pointsMode: 'double',
      },
    ],
  },
  {
    id: 'seed-eventos-show',
    title: 'Gran Show: Cine, Música & Cultura Pop',
    description:
      'Pensado para eventos presenciales, convenciones, fiestas y transmisiones en directo.',
    category: 'Eventos',
    createdAt: '2026-01-17T10:00:00.000Z',
    updatedAt: '2026-01-17T10:00:00.000Z',
    questions: [
      {
        id: 'ev-1',
        prompt: '¿Qué película animada ganó el primer Óscar de la historia en su categoría (2002)?',
        options: ['Toy Story 2', 'Shrek', 'Monsters, Inc.', 'Buscando a Nemo'],
        correctIndex: 1,
        timeLimitSec: 20,
        pointsMode: 'standard',
      },
      {
        id: 'ev-2',
        prompt: '¿Cuántas teclas blancas y negras tiene un piano estándar completo?',
        options: ['76 teclas', '84 teclas', '88 teclas', '92 teclas'],
        correctIndex: 2,
        timeLimitSec: 20,
        pointsMode: 'standard',
      },
      {
        id: 'ev-3',
        prompt: '¿Qué banda británica lanzó el legendario álbum "Abbey Road" en 1969?',
        options: ['The Rolling Stones', 'Queen', 'Pink Floyd', 'The Beatles'],
        correctIndex: 3,
        timeLimitSec: 15,
        pointsMode: 'double',
      },
    ],
  },
];

export class JsonStorage {
  private readonly filePath: string;
  private data: StoreData;

  constructor(dataDir = path.resolve(process.cwd(), 'data')) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'store.json');
    this.data = this.loadOrInit();
  }

  private loadOrInit(): StoreData {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<StoreData>;
        return {
          visitorCount: Math.max(
            VISITOR_BASE_COUNT,
            Number(parsed.visitorCount) || VISITOR_BASE_COUNT
          ),
          quizzes:
            Array.isArray(parsed.quizzes) && parsed.quizzes.length > 0
              ? parsed.quizzes
              : structuredClone(SEED_QUIZZES),
          matchHistory: Array.isArray(parsed.matchHistory)
            ? parsed.matchHistory
            : [],
        };
      } catch {
        // Fallback to clean seed if store file was corrupted
      }
    }

    const initial: StoreData = {
      visitorCount: VISITOR_BASE_COUNT,
      quizzes: structuredClone(SEED_QUIZZES),
      matchHistory: [],
    };
    this.writeFile(initial);
    return initial;
  }

  private writeFile(next: StoreData): void {
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  getVisitorStats(): { count: number; formatted: string } {
    return {
      count: this.data.visitorCount,
      formatted: formatVisitorCount(this.data.visitorCount),
    };
  }

  incrementVisitor(): { count: number; formatted: string } {
    this.data.visitorCount = Math.max(
      VISITOR_BASE_COUNT,
      this.data.visitorCount + 1
    );
    this.writeFile(this.data);
    return this.getVisitorStats();
  }

  listQuizzes(): Quiz[] {
    return [...this.data.quizzes].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  getQuiz(id: string): Quiz | undefined {
    return this.data.quizzes.find((q) => q.id === id);
  }

  createQuiz(quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>): Quiz {
    const now = new Date().toISOString();
    const created: Quiz = {
      ...quiz,
      id: `quiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.data.quizzes.unshift(created);
    this.writeFile(this.data);
    return created;
  }

  updateQuiz(
    id: string,
    patch: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>
  ): Quiz | null {
    const index = this.data.quizzes.findIndex((q) => q.id === id);
    if (index === -1) return null;
    const existing = this.data.quizzes[index];
    const updated: Quiz = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.data.quizzes[index] = updated;
    this.writeFile(this.data);
    return updated;
  }

  deleteQuiz(id: string): boolean {
    const prevLen = this.data.quizzes.length;
    this.data.quizzes = this.data.quizzes.filter((q) => q.id !== id);
    if (this.data.quizzes.length === prevLen) return false;
    this.writeFile(this.data);
    return true;
  }

  listMatchHistory(): FinishedMatchRecord[] {
    return [...this.data.matchHistory].sort((a, b) =>
      b.finishedAt.localeCompare(a.finishedAt)
    );
  }

  saveFinishedMatch(record: FinishedMatchRecord): FinishedMatchRecord {
    const existingIndex = this.data.matchHistory.findIndex(
      (item) => item.id === record.id
    );
    if (existingIndex >= 0) {
      this.data.matchHistory[existingIndex] = record;
    } else {
      this.data.matchHistory.unshift(record);
      if (this.data.matchHistory.length > 100) {
        this.data.matchHistory = this.data.matchHistory.slice(0, 100);
      }
    }
    this.writeFile(this.data);
    return record;
  }

  deleteFinishedMatch(id: string): boolean {
    const prevLen = this.data.matchHistory.length;
    this.data.matchHistory = this.data.matchHistory.filter(
      (item) => item.id !== id
    );
    if (this.data.matchHistory.length === prevLen) return false;
    this.writeFile(this.data);
    return true;
  }
}
