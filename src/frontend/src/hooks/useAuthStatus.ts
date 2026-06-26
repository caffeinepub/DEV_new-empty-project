import { createActor } from "@/backend";
import type { AuthStatus } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback, useEffect, useState } from "react";

const AUTH_KEY = "gmailer_authenticated";
const STATE_KEY = "gmailer_oauth_state";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = "http://localhost";
const OAUTH_SCOPES = "https://www.googleapis.com/auth/gmail.send";
const LOGIN_HINT = "ggreif@gmail.com";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildOAuthUrl(): string {
  const state = generateState();
  localStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    scope: OAUTH_SCOPES,
    state,
    login_hint: LOGIN_HINT,
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function parseCodeFromQuery(): { code: string; state: string } | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (code && state) return { code, state };
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

  // Handle authorization code callback
  useEffect(() => {
    const result = parseCodeFromQuery();
    if (!result) return;

    const { code, state } = result;
    const storedState = localStorage.getItem(STATE_KEY);

    // Clean up query params from URL immediately
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

    // Exchange the authorization code for a real access token in the frontend.
    // This is the standard approach for SPAs with a Web application OAuth client.
    fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    })
      .then(async (resp) => {
        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`Token exchange failed: ${errBody}`);
        }
        return resp.json() as Promise<{
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        }>;
      })
      .then((tokenData) => {
        const { access_token } = tokenData;
        if (!access_token) throw new Error("No access_token in response");
        return actor.handleOAuthCallback(access_token, LOGIN_HINT);
      })
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
