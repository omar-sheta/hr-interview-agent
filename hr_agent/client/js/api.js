const DEFAULT_HTTP_PORT = 8001;
const DEFAULT_HTTPS_PORT = 8002;

function buildBaseUrls(params) {
  const pageProtocol = window.location.protocol;
  const apiHost = params.api_host || window.location.hostname;
  const defaultPort = pageProtocol === 'https:' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;
  const apiPort = params.api_port || defaultPort;

  const primary = `${pageProtocol}//${apiHost}:${apiPort}`;
  let fallback = null;
  if (pageProtocol === 'https:' && !params.api_port) {
    fallback = `http://${apiHost}:${DEFAULT_HTTP_PORT}`;
  }
  return { primary, fallback };
}

export function createApiClient(params = {}) {
  let { primary, fallback } = buildBaseUrls(params);
  let activeBase = primary;

  async function request(path, options = {}, parseAs = 'json') {
    const bases = [activeBase];
    if (fallback && fallback !== activeBase) {
      bases.push(fallback);
    }

    let lastError = null;
    for (const base of bases) {
      const url = new URL(path, base).toString();
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(options.timeout ?? 15000),
        });

        if (!response.ok) {
          const detail = await safeParseError(response);
          throw new Error(detail || `Request failed with ${response.status}`);
        }

        if (base !== activeBase) {
          activeBase = base;
          fallback = null;
        }

        if (parseAs === 'json') {
          return response.json();
        }
        if (parseAs === 'blob') {
          return response.blob();
        }
        return response;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error('Unable to reach API server');
  }

  return {
    get baseUrl() {
      return activeBase;
    },
    get displayHost() {
      try {
        return new URL(activeBase).host;
      } catch {
        return activeBase;
      }
    },

    async fetchSession(sessionId) {
      return request(`/interview/${sessionId}`);
    },

    async startCandidateInterview(interviewId, candidateId) {
      return request(`/api/candidate/interviews/${interviewId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId }),
      });
    },

    async startFallbackInterview(payload) {
      return request('/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async synthesizeQuestion(text) {
      return request('/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }, 'blob');
    },

    async transcribeAudio(blob, sessionId, questionIndex) {
      const formData = new FormData();
      const extension = blob.type?.split('/').pop() || 'webm';
      const filename = blob.name || `response-${Date.now()}.${extension}`;
      formData.append('audio', blob, filename);
      if (sessionId) {
        formData.append('session_id', sessionId);
        formData.append('question_index', questionIndex);
      }
      return request('/transcribe', { method: 'POST', body: formData });
    },

    async submitResponse(sessionId, questionIndex, transcriptId) {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('question_index', questionIndex);
      if (transcriptId) {
        formData.append('transcript_id', transcriptId);
      }
      return request('/interview/submit', { method: 'POST', body: formData });
    },

    async submitSkip(sessionId, questionIndex) {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('question_index', questionIndex);
      return request('/interview/submit', { method: 'POST', body: formData });
    },

    async fetchResults(sessionId) {
      return request(`/interview/${sessionId}/results`);
    },
  };
}

async function safeParseError(response) {
  try {
    const payload = await response.json();
    return payload.detail || payload.message;
  } catch {
    return response.statusText;
  }
}
