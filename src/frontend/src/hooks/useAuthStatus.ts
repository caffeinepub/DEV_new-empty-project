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

const TAG = "[Gmail OAuth]";

/** Redact a secret to its length + first 8 chars only. */
function redact(token: string): string {
  if (!token) return "<empty>";
  const prefix = token.slice(0, 8);
  return `<len=${token.length} prefix=${prefix}>`;
}

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
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.info(`${TAG} buildOAuthUrl — constructed authorization URL`, {
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: OAUTH_SCOPES,
    state: redact(state),
    login_hint: LOGIN_HINT,
    prompt: "consent",
    url,
  });
  return url;
}

function parseTokenFromFragment(): {
  accessToken: string;
  state: string;
} | null {
  const hash = window.location.hash;
  console.info(`${TAG} parseTokenFromFragment — inspecting URL fragment`, {
    hashLength: hash ? hash.length : 0,
    hasHash: !!hash && hash.length >= 2,
  });
  if (!hash || hash.length < 2) {
    console.info(
      `${TAG} parseTokenFromFragment — no fragment present, nothing to parse`,
    );
    return null;
  }
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const state = params.get("state");
  const foundToken = !!accessToken;
  const foundState = !!state;
  console.info(`${TAG} parseTokenFromFragment — parsed fragment params`, {
    accessTokenFound: foundToken,
    accessToken: foundToken ? redact(accessToken!) : null,
    stateFound: foundState,
    state: foundState ? redact(state!) : null,
  });
  if (accessToken && state) return { accessToken, state };
  console.warn(
    `${TAG} parseTokenFromFragment — fragment present but missing access_token or state`,
    { accessTokenFound: foundToken, stateFound: foundState },
  );
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
  // CRITICAL: the actor-readiness check MUST happen BEFORE the fragment is
  // wiped. If the actor is null on first mount, we return early WITHOUT
  // touching the URL so the effect re-runs when the actor becomes available
  // and the token is still in the fragment. The fragment is only wiped
  // AFTER handleOAuthCallback has been successfully called.
  useEffect(() => {
    console.info(`${TAG} useEffect entry — checking for OAuth callback`, {
      actorReady: !!actor,
      actor: actor ? "<instance>" : null,
    });
    const result = parseTokenFromFragment();
    if (!result) {
      console.info(`${TAG} useEffect — no token in fragment, exiting`);
      return;
    }

    const { accessToken, state } = result;
    const storedState = localStorage.getItem(STATE_KEY);

    // Actor readiness FIRST — preserve the fragment for retry on next run.
    if (!actor) {
      console.warn(
        `${TAG} useEffect — actor is null; preserving URL fragment for retry on next render. Token remains in URL.`,
        { token: redact(accessToken), state: redact(state) },
      );
      return;
    }

    // State mismatch check — also BEFORE wiping the fragment, so a retry is
    // possible if the user re-initiates the flow.
    if (state !== storedState) {
      console.error(
        `${TAG} useEffect — state mismatch detected (possible CSRF). Aborting.`,
        {
          receivedState: redact(state),
          storedState: storedState ? redact(storedState) : null,
        },
      );
      setExchangeError(
        "State mismatch — possible CSRF attack. Please try again.",
      );
      return;
    }

    localStorage.removeItem(STATE_KEY);

    setExchanging(true);
    console.info(
      `${TAG} useEffect — sending access token to server via handleOAuthCallback`,
      {
        token: redact(accessToken),
        loginHint: LOGIN_HINT,
      },
    );

    actor
      .handleOAuthCallback(accessToken, LOGIN_HINT)
      .then((res) => {
        console.info(`${TAG} handleOAuthCallback — server responded`, {
          resultKind: res.__kind__,
          ...(res.__kind__ === "err" ? { err: res.err } : {}),
        });
        if (res.__kind__ === "ok") {
          console.info(
            `${TAG} handleOAuthCallback — success; setting localStorage ${AUTH_KEY}=true and marking authenticated`,
          );
          localStorage.setItem(AUTH_KEY, "true");
          setAuthenticated(true);
          // Only NOW is it safe to wipe the fragment — the token has been
          // delivered to the canister's tokenStore.
          console.info(
            `${TAG} useEffect — wiping URL fragment (token delivered to server)`,
          );
          window.history.replaceState(null, "", window.location.pathname);
        } else {
          console.error(`${TAG} handleOAuthCallback — server returned error`, {
            err: res.err,
          });
          setExchangeError(`Authentication failed: ${res.err}`);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${TAG} handleOAuthCallback — promise rejected`, {
          message: msg,
          error: err,
        });
        setExchangeError(`Authentication failed: ${msg}`);
      })
      .finally(() => setExchanging(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor]);

  const logout = useCallback(() => {
    console.info(
      `${TAG} logout — clearing localStorage auth flag (note: backend tokenStore is NOT cleared by logout)`,
      { authKey: AUTH_KEY },
    );
    localStorage.removeItem(AUTH_KEY);
    setAuthenticated(false);
  }, []);

  return { authStatus, oauthUrl, exchanging, exchangeError, logout };
}
