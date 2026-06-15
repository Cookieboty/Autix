import {
  fetchEventSource,
  type FetchEventSourceInit,
} from '@microsoft/fetch-event-source';
import {
  getApiBaseUrl,
  getAuth,
  refreshAuthSession,
} from '@autix/shared-lib';

function withAuthorization(headers: HeadersInit | undefined, token: string | null): Headers {
  const nextHeaders = new Headers(headers);
  if (token) nextHeaders.set('Authorization', `Bearer ${token}`);
  return nextHeaders;
}

export function authFetchEventSource(
  input: RequestInfo,
  init: FetchEventSourceInit,
): Promise<void> {
  const apiUrl = getApiBaseUrl();

  return fetchEventSource(input, {
    ...init,
    fetch: async (requestInput, requestInit) => {
      const token = await getAuth().getAccessToken();
      const response = await fetch(requestInput, {
        ...requestInit,
        headers: withAuthorization(requestInit?.headers, token),
      });

      if (response.status !== 401) return response;

      let nextToken: string | null;
      try {
        nextToken = await refreshAuthSession(apiUrl, {
          staleAccessToken: token,
        });
      } catch {
        return response;
      }
      if (!nextToken) return response;

      return fetch(requestInput, {
        ...requestInit,
        headers: withAuthorization(requestInit?.headers, nextToken),
      });
    },
  });
}
