import { createActor } from "@/backend";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { useFriends } from "@/hooks/useFriends";
import type { AppView } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback, useState } from "react";

export default function App() {
  const { authStatus, oauthUrl, exchanging, exchangeError, logout } =
    useAuthStatus();
  const { friends, addFriend, removeFriend } = useFriends();
  const { actor } = useActor(createActor);

  const [view, setView] = useState<AppView>(
    authStatus === "authenticated" ? "location" : "oauth",
  );
  const [location, setLocation] = useState("");
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [friendError, setFriendError] = useState("");

  // Sync view when auth status changes
  const effectiveView: AppView =
    authStatus === "unauthenticated"
      ? "oauth"
      : view === "oauth"
        ? "location"
        : view;

  const handleSendNotification = useCallback(async () => {
    if (!location.trim()) return;
    setSending(true);
    setSendResult("idle");
    try {
      if (!actor) {
        setSendResult("error");
        return;
      }
      await actor.sendArrivalNotification(location.trim(), "");
      setSendResult("success");
      setLocation("");
    } catch {
      setSendResult("error");
    } finally {
      setSending(false);
    }
  }, [location, actor]);

  const handleAddFriend = useCallback(() => {
    const email = newFriendEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFriendError("Please enter a valid email address.");
      return;
    }
    addFriend(email);
    setNewFriendEmail("");
    setFriendError("");
  }, [newFriendEmail, addFriend]);

  return (
    <Layout>
      {/* OAuth view */}
      {effectiveView === "oauth" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 gap-8">
          {/* Hero compass */}
          <div className="relative flex items-center justify-center">
            <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center shadow-elevation">
              <svg
                width="72"
                height="72"
                viewBox="0 0 72 72"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="36"
                  cy="36"
                  r="30"
                  stroke="oklch(0.48 0.16 220)"
                  strokeWidth="3"
                  fill="oklch(0.48 0.16 220 / 0.08)"
                />
                <circle cx="36" cy="36" r="5" fill="oklch(0.48 0.16 220)" />
                <polygon
                  points="36,12 33,34 36,30 39,34"
                  fill="oklch(0.55 0.22 25)"
                />
                <polygon
                  points="36,60 33,38 36,42 39,38"
                  fill="oklch(0.52 0.04 230)"
                />
                <polygon
                  points="60,36 38,33 42,36 38,39"
                  fill="oklch(0.52 0.04 230)"
                />
                <polygon
                  points="12,36 34,33 30,36 34,39"
                  fill="oklch(0.52 0.04 230)"
                />
                <text
                  x="36"
                  y="10"
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="oklch(0.48 0.16 220)"
                >
                  N
                </text>
              </svg>
            </div>
          </div>

          <div className="text-center max-w-sm">
            <h2 className="text-3xl font-display font-bold text-foreground mb-2">
              Welcome to Gmailer
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Send arrival notifications to your friends via Gmail. Let them
              know you've arrived safely — one click, every time you land.
            </p>
          </div>

          {/* Exchanging / error states */}
          {exchanging && (
            <div
              className="flex items-center gap-3 text-sm text-muted-foreground bg-card border border-border rounded-xl px-5 py-4 shadow-subtle w-full max-w-sm"
              data-ocid="oauth.loading_state"
            >
              <svg
                className="animate-spin w-5 h-5 shrink-0 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="60"
                  strokeDashoffset="20"
                />
              </svg>
              Verifying your Google account…
            </div>
          )}

          {exchangeError && (
            <div
              className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-5 py-4 w-full max-w-sm"
              data-ocid="oauth.error_state"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {exchangeError}
            </div>
          )}

          <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-subtle flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="gmail-account"
                className="text-sm font-medium text-foreground"
              >
                Gmail account
              </label>
              <Input
                id="gmail-account"
                value="ggreif@gmail.com"
                readOnly
                data-ocid="oauth.email_input"
                className="bg-muted/50 text-muted-foreground cursor-default"
              />
            </div>
            <Button
              asChild
              className="w-full font-semibold"
              disabled={exchanging}
              data-ocid="oauth.connect_button"
            >
              <a href={oauthUrl}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mr-2"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Connect Gmail
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-xs">
            We only request permission to send emails on your behalf. Your
            credentials are never stored on our servers.
          </p>
        </div>
      )}

      {/* Location view */}
      {effectiveView === "location" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-6">
          {/* Map pin icon */}
          <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center shadow-subtle">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                fill="oklch(0.68 0.18 45)"
                fillOpacity="0.9"
              />
              <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-display font-bold text-foreground mb-1">
              Where did you arrive?
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your current location to notify your friends
            </p>
          </div>

          <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-subtle flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="location"
                className="text-sm font-medium text-foreground"
              >
                Current location
              </label>
              <Input
                id="location"
                placeholder="e.g. Tokyo, Japan"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setSendResult("idle");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSendNotification()}
                data-ocid="location.input"
                className="text-base"
              />
            </div>

            {friends.length === 0 && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                No friends added yet.{" "}
                <button
                  type="button"
                  onClick={() => setView("friends")}
                  className="text-primary underline underline-offset-2 hover:no-underline"
                  data-ocid="location.manage_friends_link"
                >
                  Add friends
                </button>{" "}
                to send notifications.
              </p>
            )}

            {friends.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Will notify{" "}
                <span className="font-medium text-foreground">
                  {friends.length}
                </span>{" "}
                {friends.length === 1 ? "friend" : "friends"}
              </p>
            )}

            <Button
              onClick={handleSendNotification}
              disabled={!location.trim() || sending || friends.length === 0}
              className="w-full font-semibold"
              data-ocid="location.send_button"
            >
              {sending ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="60"
                      strokeDashoffset="20"
                    />
                  </svg>
                  Sending…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 21l21-9L2 3v7l15 2-15 2v7z"
                      fill="currentColor"
                    />
                  </svg>
                  Send Arrival Notification
                </span>
              )}
            </Button>

            {sendResult === "success" && (
              <div
                className="flex items-center gap-2 text-sm text-primary bg-primary/8 rounded-lg px-3 py-2"
                data-ocid="location.success_state"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Notifications sent successfully!
              </div>
            )}
            {sendResult === "error" && (
              <div
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-lg px-3 py-2"
                data-ocid="location.error_state"
              >
                Failed to send. Please try again.
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setView("friends")}
              className="text-sm text-primary hover:underline underline-offset-2 transition-smooth"
              data-ocid="location.manage_friends_button"
            >
              Manage friends ({friends.length})
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-smooth"
              data-ocid="location.logout_button"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Friends view */}
      {effectiveView === "friends" && (
        <div className="flex-1 flex flex-col items-center px-4 py-10 gap-6 max-w-sm mx-auto w-full">
          <div className="w-full flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView("location")}
              className="text-muted-foreground hover:text-foreground transition-smooth p-1 -ml-1 rounded-md"
              aria-label="Go back"
              data-ocid="friends.back_button"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">
                Friends
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage your notification recipients
              </p>
            </div>
          </div>

          {/* Add friend */}
          <div className="w-full bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col gap-3">
            <label
              htmlFor="add-friend-email"
              className="text-sm font-medium text-foreground"
            >
              Add a friend
            </label>
            <div className="flex gap-2">
              <Input
                id="add-friend-email"
                placeholder="friend@example.com"
                value={newFriendEmail}
                onChange={(e) => {
                  setNewFriendEmail(e.target.value);
                  setFriendError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                type="email"
                data-ocid="friends.add_input"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddFriend}
                variant="outline"
                className="shrink-0 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-smooth"
                data-ocid="friends.add_button"
              >
                Add
              </Button>
            </div>
            {friendError && (
              <p
                className="text-xs text-destructive"
                data-ocid="friends.field_error"
              >
                {friendError}
              </p>
            )}
          </div>

          {/* Friends list */}
          <div className="w-full flex flex-col gap-2">
            {friends.length === 0 ? (
              <div
                className="text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-xl"
                data-ocid="friends.empty_state"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mx-auto mb-2 opacity-40"
                  aria-hidden="true"
                >
                  <path
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                No friends yet. Add someone above!
              </div>
            ) : (
              friends.map((email, i) => (
                <div
                  key={email}
                  className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 shadow-xs"
                  data-ocid={`friends.item.${i + 1}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary uppercase">
                        {email[0]}
                      </span>
                    </div>
                    <span className="text-sm text-foreground truncate">
                      {email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFriend(email)}
                    className="text-muted-foreground hover:text-destructive transition-smooth shrink-0 ml-2 p-1 rounded-md"
                    aria-label={`Remove ${email}`}
                    data-ocid={`friends.delete_button.${i + 1}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {friends.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {friends.length}{" "}
              {friends.length === 1 ? "recipient" : "recipients"} configured
            </Badge>
          )}
        </div>
      )}
    </Layout>
  );
}
