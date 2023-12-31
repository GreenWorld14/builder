import Promise from '../classes/promise.class';
import serverOnlyRequire from './server-only-require.function';

export interface SimplifiedFetchOptions {
  body?: string;
  headers?: { [key: string]: string };
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  credentials?: 'include';
  mode?: RequestMode;
}

export interface SimpleFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  clone: () => any;
  text: () => Promise<string>;
  json: () => Promise<any>;
  blob: () => Promise<Blob>;
  headers: {
    keys: () => string[];
    entries: () => [string, string][];
    get: (n: string) => string;
    has: (n: string) => boolean;
  };
}

function promiseResolve<T>(value: T) {
  return new Promise<T>(resolve => resolve(value));
}

// Adapted from https://raw.githubusercontent.com/developit/unfetch/master/src/index.mjs
function tinyFetch(url: string, options: SimplifiedFetchOptions = {}) {
  return new Promise<SimpleFetchResponse>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open(options.method || 'get', url, true);

    if (options.headers) {
      for (const i in options.headers) {
        request.setRequestHeader(i, options.headers[i]);
      }
    }

    request.withCredentials = options.credentials === 'include';

    request.onload = () => {
      resolve(response());
    };

    request.onerror = reject;

    request.send(options.body);

    function response() {
      const keys: string[] = [];
      const all: [string, string][] = [];
      const headers: { [key: string]: string } = {};
      let header: string | undefined = undefined;

      request
        .getAllResponseHeaders()
        .replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm, (_match, _key, value) => {
          let key = _key;
          keys.push((key = key.toLowerCase()));
          all.push([key, value]);
          header = headers[key];
          headers[key] = header ? `${header},${value}` : value;
          return '';
        });

      return {
        ok: ((request.status / 100) | 0) === 2, // 200-299
        status: request.status,
        statusText: request.statusText,
        url: request.responseURL,
        clone: response,
        text: () => promiseResolve(request.responseText),
        json: () => promiseResolve(request.responseText).then(JSON.parse),
        blob: () => promiseResolve(new Blob([request.response])),
        headers: {
          keys: () => keys,
          entries: () => all,
          get: (n: string) => headers[n.toLowerCase()],
          has: (n: string) => n.toLowerCase() in headers,
        },
      };
    }
  });
}

export function getFetch() {
  // If fetch is defined, in the browser, via polyfill, or in a Cloudflare worker, use it.
  let _fetch: typeof fetch | undefined = undefined;
  if (globalThis.fetch) {
    _fetch ??= globalThis.fetch as any;
  } else if (typeof window === 'undefined') {
    // If fetch is not defined, in a Node.js environment, use node-fetch.
    try {
      // node-fetch@^3 is ESM only, and will throw error on require.
      _fetch ??= serverOnlyRequire('node-fetch');
    } catch (e) {
      // If node-fetch is not installed, use tiny-fetch.
      console.warn(
        'node-fetch is not installed. consider polyfilling fetch or installing node-fetch.'
      );
      console.warn(e);
    }
  }

  // Otherwise, use tiny-fetch.
  return _fetch ?? tinyFetch;
}
