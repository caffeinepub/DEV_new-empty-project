import { createActor } from "@/backend";
import type { AuthStatus } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback, useEffect, useState } from "react";

const AUTH_KEY = "gmailer_authenticated";
const STATE_KEY = "gmailer_oauth_state";
const GOOGLE_CLIENT_ID =
  "776815084452-8t1kcrjouc2pp7c6s2r86k41c6cs5mqd.apps.googleusercontent.com";
const REDIRECT_URI = "https://new-empty-project-lcr.dev.caffeine.xyz";
const OAUTH_SCOPES = "https://www.googleapis.com/auth/gmail.send";
const LOGIN_HINT = "ggreif@gmail.com";

function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildOAuthUrl(): string {
  const existing = localStorage.getItem(STATE_KEY);
  const state = existing ?? generateState();
  if (!existing) localStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: OAUTH_SCOPES,
    state,
    login_hint: LOGIN_HINT,
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function parseTokenFromFragment(): {
  accessToken: string;
  state: string;
} | null {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const state = params.get("state");
  if (accessToken && state) return { accessToken, state };
  return null;
}

export function useAuthStatus() {
  const [authenticated, setAuthenticated] = useState<boolean>(
    () => localStorage.getItem(AUTH_KEY) === "true",
  );
  const [exchanging, setExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  const { actor } = useActor(createActor);

  const authStatus: AuthStatus = authenticated
    ? "authenticated"
    : "unauthenticated";
  const oauthUrl = buildOAuthUrl();

  // Handle implicit-flow callback: access_token arrives in the URL fragment.
  useEffect(() => {
    const result = parseTokenFromFragment();
    if (!result) return;

    const { accessToken, state } = result;
    const storedState = localStorage.getItem(STATE_KEY);

    // Clean up the fragment from the URL immediately.
    window.history.replaceState(null, "", window.location.pathname);

    if (state !== storedState) {
      setExchangeError(
        "State mismatch — possible CSRF attack. Please try again.",
      );
      return;
    }

    localStorage.removeItem(STATE_KEY);

    if (!actor) return;

    setExchanging(true);

    actor
      .handleOAuthCallback(accessToken, LOGIN_HINT)
      .then((res) => {
        if (res.__kind__ === "ok") {
          localStorage.setItem(AUTH_KEY, "true");
          setAuthenticated(true);
        } else {
          setExchangeError(`Authentication failed: ${res.err}`);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setExchangeError(`Authentication failed: ${msg}`);
      })
      .finally(() => setExchanging(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setAuthenticated(false);
  }, []);

  return { authStatus, oauthUrl, exchanging, exchangeError, logout };
}
