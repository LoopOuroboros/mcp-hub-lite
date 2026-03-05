import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http } from '@utils/http';
import type { SessionState } from '@shared-types/session.types';

export const useSessionStore = defineStore('session', () => {
  const sessions = ref<SessionState[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchSessions() {
    loading.value = true;
    error.value = null;
    try {
      const response = await http.get<{ success: boolean; data: SessionState[]; count: number }>(
        '/web/sessions'
      );
      if (response.success) {
        sessions.value = response.data;
      } else {
        throw new Error('Failed to fetch sessions');
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to fetch sessions';
      } else {
        error.value = 'Failed to fetch sessions';
      }
      console.error('Failed to fetch sessions:', e);
    } finally {
      loading.value = false;
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      const response = await http.delete<{ success: boolean; message: string }>(
        `/web/sessions/${sessionId}`
      );
      if (response.success) {
        // Refresh the session list after deletion
        await fetchSessions();
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to delete session';
      } else {
        error.value = 'Failed to delete session';
      }
      console.error('Failed to delete session:', e);
      throw e;
    }
  }

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    deleteSession
  };
});
