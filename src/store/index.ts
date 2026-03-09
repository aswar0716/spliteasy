import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Friend, HistoryEntry, JournalEntry } from '../types';
import { Colors } from '../theme';

const KEYS = {
  friends: '@spliteasy/friends',
  history: '@spliteasy/history',
  journal: '@spliteasy/journal',
  geminiKey: '@spliteasy/geminiKey',
};

type AppStore = {
  friends: Friend[];
  history: HistoryEntry[];
  journal: JournalEntry[];
  geminiKey: string;
  hydrated: boolean;

  addFriend: (name: string) => void;
  removeFriend: (id: string) => void;
  renameFriend: (id: string, name: string) => void;

  addHistory: (entry: HistoryEntry) => void;
  removeHistory: (id: string) => void;

  addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'date'>) => void;
  updateJournalEntry: (id: string, patch: Partial<JournalEntry>) => void;
  removeJournalEntry: (id: string) => void;

  setGeminiKey: (key: string) => void;

  hydrate: () => Promise<void>;
};

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function persist(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const useStore = create<AppStore>((set, get) => ({
  friends: [],
  history: [],
  journal: [],
  geminiKey: '',
  hydrated: false,

  addFriend: (name: string) => {
    const { friends } = get();
    const color = Colors.friendColors[friends.length % Colors.friendColors.length];
    const newFriend: Friend = { id: genId(), name: name.trim(), color };
    const updated = [...friends, newFriend];
    set({ friends: updated });
    persist(KEYS.friends, updated);
  },

  removeFriend: (id: string) => {
    const updated = get().friends.filter(f => f.id !== id);
    set({ friends: updated });
    persist(KEYS.friends, updated);
  },

  renameFriend: (id: string, name: string) => {
    const updated = get().friends.map(f =>
      f.id === id ? { ...f, name: name.trim() } : f,
    );
    set({ friends: updated });
    persist(KEYS.friends, updated);
  },

  addHistory: (entry: HistoryEntry) => {
    const updated = [entry, ...get().history];
    set({ history: updated });
    persist(KEYS.history, updated);
  },

  removeHistory: (id: string) => {
    const updated = get().history.filter(h => h.id !== id);
    set({ history: updated });
    persist(KEYS.history, updated);
  },

  addJournalEntry: (entry) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: genId(),
      date: new Date().toISOString(),
    };
    const updated = [newEntry, ...get().journal];
    set({ journal: updated });
    persist(KEYS.journal, updated);
  },

  updateJournalEntry: (id, patch) => {
    const updated = get().journal.map(j =>
      j.id === id ? { ...j, ...patch } : j,
    );
    set({ journal: updated });
    persist(KEYS.journal, updated);
  },

  removeJournalEntry: (id: string) => {
    const updated = get().journal.filter(j => j.id !== id);
    set({ journal: updated });
    persist(KEYS.journal, updated);
  },

  setGeminiKey: (key: string) => {
    set({ geminiKey: key });
    AsyncStorage.setItem(KEYS.geminiKey, key);
  },

  hydrate: async () => {
    const [friends, history, journal, geminiKeyRaw] = await Promise.all([
      load<Friend[]>(KEYS.friends, []),
      load<HistoryEntry[]>(KEYS.history, []),
      load<JournalEntry[]>(KEYS.journal, []),
      AsyncStorage.getItem(KEYS.geminiKey),
    ]);
    set({ friends, history, journal, geminiKey: geminiKeyRaw ?? '', hydrated: true });
  },
}));
